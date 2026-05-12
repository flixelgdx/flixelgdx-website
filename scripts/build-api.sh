#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Generate the FlixelGDX API reference from the framework's Java sources.
#
# Pipeline:
#   1. Use `git clone --filter=blob:none --no-checkout` + `git sparse-checkout`
#      to pull ONLY the Java source folders (and a couple of metadata files)
#      out of flixelgdx/flixelgdx@master. We never download Gradle scripts,
#      tests, gradle wrappers, doc images or any other blobs, which keeps the
#      working tree tiny (a few MB) instead of cloning the whole repo.
#   2. Drop a small, self-contained Dokka build under build/dokka-runner that
#      points its source-roots at the sparse checkout and uses the official
#      Dokka GFM plugin to emit GitHub-Flavoured Markdown.
#   3. Massage the generated tree into the layout Docusaurus expects under
#      site/api/, prepending YAML front-matter so the docs render with our
#      theme.
#
# Knobs:
#   FLIXELGDX_REPO    Git URL of the framework (default: GitHub HTTPS).
#   FLIXELGDX_BRANCH  Branch / tag to read (default: master).
#   FLIXELGDX_REF     Explicit commit SHA. Overrides FLIXELGDX_BRANCH when set.
# ----------------------------------------------------------------------------
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BUILD_DIR="${ROOT}/build"
SRC_DIR="${BUILD_DIR}/flixelgdx-src"
DOKKA_DIR="${BUILD_DIR}/dokka-runner"
OUT_DIR="${BUILD_DIR}/dokka-out"
SITE_API_DIR="${ROOT}/site/api"

FRAMEWORK_REPO="${FLIXELGDX_REPO:-https://github.com/flixelgdx/flixelgdx.git}"
FRAMEWORK_BRANCH="${FLIXELGDX_BRANCH:-master}"
FRAMEWORK_REF="${FLIXELGDX_REF:-}"

echo "==> Preparing build directories"
mkdir -p "${BUILD_DIR}"

# ----------------------------------------------------------------------------
# 1. Sparse checkout — pull ONLY Java source dirs + the framework's own README
#    and llms.txt (so we can show contextual prose at the top of the API).
#
# `--filter=blob:none` tells git to defer file downloads to checkout time, so
# the initial clone only fetches commit metadata. The follow-up sparse-checkout
# init+set narrows what `git checkout` will materialise to disk.
# ----------------------------------------------------------------------------
SPARSE_PATHS=(
  "flixelgdx-core/src/main"
  "flixelgdx-common/src/main"
  "flixelgdx-jvm/src/main"
  "flixelgdx-lwjgl3/src/main"
  "flixelgdx-android/src/main"
  "flixelgdx-ios/src/main"
  "flixelgdx-teavm/src/main"
  "flixelgdx-teavm-plugin/src/main"
  "flixelgdx-logging-plugin/src/main"
  "README.md"
  "llms.txt"
)

if [ ! -d "${SRC_DIR}/.git" ]; then
  echo "==> Sparse-cloning ${FRAMEWORK_REPO} (${FRAMEWORK_REF:-${FRAMEWORK_BRANCH}})"
  rm -rf "${SRC_DIR}"
  git clone --filter=blob:none --no-checkout --depth 1 \
    --branch "${FRAMEWORK_BRANCH}" "${FRAMEWORK_REPO}" "${SRC_DIR}"
  git -C "${SRC_DIR}" sparse-checkout init --cone
  git -C "${SRC_DIR}" sparse-checkout set "${SPARSE_PATHS[@]}"
else
  echo "==> Refreshing existing framework checkout"
  git -C "${SRC_DIR}" sparse-checkout set "${SPARSE_PATHS[@]}" || true
  git -C "${SRC_DIR}" fetch --filter=blob:none --depth 1 origin "${FRAMEWORK_BRANCH}"
fi

# Land the requested ref (or branch tip) into the working tree.
if [ -n "${FRAMEWORK_REF}" ]; then
  echo "==> Checking out pinned ref ${FRAMEWORK_REF}"
  git -C "${SRC_DIR}" fetch --filter=blob:none --depth 1 origin "${FRAMEWORK_REF}" || true
  git -C "${SRC_DIR}" checkout --quiet "${FRAMEWORK_REF}"
else
  git -C "${SRC_DIR}" checkout --quiet "origin/${FRAMEWORK_BRANCH}"
fi

echo "==> Working tree size (should be small):"
du -sh "${SRC_DIR}" 2>/dev/null || true

# ----------------------------------------------------------------------------
# 2. Generate the Dokka GFM build script.
# ----------------------------------------------------------------------------
MODULES=()
for dir in "${SRC_DIR}"/flixelgdx-*; do
  [ -d "${dir}/src/main" ] || continue
  MODULES+=("$(basename "${dir}")")
done

if [ "${#MODULES[@]}" -eq 0 ]; then
  echo "!! No flixelgdx-* modules with src/main found, aborting." >&2
  exit 1
fi

echo "==> Modules: ${MODULES[*]}"

echo "==> Writing self-contained Dokka build"
mkdir -p "${DOKKA_DIR}"
cat > "${DOKKA_DIR}/settings.gradle.kts" <<'EOF'
rootProject.name = "flixelgdx-api-docs"
EOF

MODULE_BLOCKS=""
for mod in "${MODULES[@]}"; do
  src_main="${SRC_DIR}/${mod}/src/main"
  if [ -d "${src_main}/java" ]; then
    rel="${src_main}/java"
  elif [ -d "${src_main}/kotlin" ]; then
    rel="${src_main}/kotlin"
  else
    rel="$(find "${src_main}" -maxdepth 1 -mindepth 1 -type d | head -n1)"
  fi
  [ -z "${rel}" ] && continue
  MODULE_BLOCKS+="
    register(\"${mod}\") {
      displayName.set(\"${mod}\")
      sourceRoots.from(file(\"${rel}\"))
      jdkVersion.set(17)
      noStdlibLink.set(true)
      noJdkLink.set(false)
      reportUndocumented.set(false)
    }"
done

cat > "${DOKKA_DIR}/build.gradle.kts" <<EOF
plugins {
  id("org.jetbrains.dokka") version "1.9.20"
}

repositories { mavenCentral() }

dependencies {
  dokkaGfmPlugin("org.jetbrains.dokka:gfm-plugin:1.9.20")
}

tasks.dokkaGfm {
  outputDirectory.set(file("${OUT_DIR}"))
  moduleName.set("FlixelGDX")
  dokkaSourceSets {
${MODULE_BLOCKS}
  }
}
EOF

echo "==> Running Dokka GFM"
pushd "${DOKKA_DIR}" >/dev/null
rm -rf "${OUT_DIR}"
gradle --no-daemon -q dokkaGfm
popd >/dev/null

if [ ! -d "${OUT_DIR}" ]; then
  echo "!! Dokka did not produce output at ${OUT_DIR}" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# 3. Massage output for Docusaurus.
# ----------------------------------------------------------------------------
echo "==> Massaging output for Docusaurus"
rm -rf "${SITE_API_DIR}.staging"
mkdir -p "${SITE_API_DIR}.staging"
for mod in "${MODULES[@]}"; do
  if [ -d "${OUT_DIR}/${mod}" ]; then
    cp -R "${OUT_DIR}/${mod}" "${SITE_API_DIR}.staging/${mod}"
  fi
done

python3 - "${SITE_API_DIR}.staging" <<'PY'
import os, re, sys
root = sys.argv[1]
for base, dirs, files in os.walk(root):
    for f in files:
        if not f.endswith('.md'):
            continue
        p = os.path.join(base, f)
        with open(p, 'r', encoding='utf-8') as fh:
            text = fh.read()
        if text.startswith('---\n'):
            continue
        m = re.search(r'^#\s+(.*?)\s*$', text, re.MULTILINE)
        title = m.group(1).strip() if m else os.path.splitext(f)[0]
        title = title.replace('"', "'")
        fm = f"---\ntitle: \"{title}\"\nhide_title: false\nsidebar_label: \"{title}\"\n---\n\n"
        with open(p, 'w', encoding='utf-8') as fh:
            fh.write(fm + text)
PY

echo "==> Replacing site/api content"
mkdir -p "${SITE_API_DIR}"
INDEX_BACKUP=""
if [ -f "${SITE_API_DIR}/index.md" ]; then
  INDEX_BACKUP="$(mktemp)"
  cp "${SITE_API_DIR}/index.md" "${INDEX_BACKUP}"
fi
find "${SITE_API_DIR}" -mindepth 1 -maxdepth 1 ! -name "index.md" -exec rm -rf {} +
cp -R "${SITE_API_DIR}.staging/." "${SITE_API_DIR}/"
rm -rf "${SITE_API_DIR}.staging"
if [ -n "${INDEX_BACKUP}" ]; then
  cp "${INDEX_BACKUP}" "${SITE_API_DIR}/index.md"
  rm -f "${INDEX_BACKUP}"
fi

echo "==> Done. API markdown is now under ${SITE_API_DIR}/"
