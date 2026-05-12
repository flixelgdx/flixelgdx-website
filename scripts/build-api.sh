#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Generate the FlixelGDX API reference from the framework's Java sources.
#
# This script:
#   1. Clones (or refreshes) the flixelgdx/flixelgdx master branch into
#      build/flixelgdx-src.
#   2. Drops a self-contained Dokka GFM build under build/dokka-runner that
#      pulls in every flixelgdx-* module's `src/main` directory as a Dokka
#      source-root and outputs GitHub-Flavoured Markdown.
#   3. Runs Dokka via the standalone Gradle build, producing a tree of
#      `Class.md`/`package.md` files.
#   4. Massages the generated tree into the layout Docusaurus expects under
#      site/api/, prepending YAML front-matter so the docs render with our
#      red/black, Javadoc-flavoured theme.
#
# We intentionally use Dokka's `dokka-gradle-plugin` + `dokka-gfm-plugin`
# in a *separate* tiny Gradle build so we do not have to fork the framework's
# own build script. Java sources are analyzed via Dokka's built-in Java
# support (which produces Java-flavoured signatures in the GFM output).
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

echo "==> Preparing build directories"
mkdir -p "${BUILD_DIR}"

if [ -d "${SRC_DIR}/.git" ]; then
  echo "==> Refreshing existing framework checkout"
  git -C "${SRC_DIR}" fetch --depth 1 origin "${FRAMEWORK_BRANCH}"
  git -C "${SRC_DIR}" reset --hard "origin/${FRAMEWORK_BRANCH}"
else
  echo "==> Cloning ${FRAMEWORK_REPO} (${FRAMEWORK_BRANCH})"
  rm -rf "${SRC_DIR}"
  git clone --depth 1 --branch "${FRAMEWORK_BRANCH}" "${FRAMEWORK_REPO}" "${SRC_DIR}"
fi

# Collect modules.
MODULES=()
for dir in "${SRC_DIR}"/flixelgdx-*; do
  [ -d "${dir}/src/main" ] || continue
  MODULES+=("$(basename "${dir}")")
done

if [ "${#MODULES[@]}" -eq 0 ]; then
  echo "!! No flixelgdx-* modules with src/main found, aborting."
  exit 1
fi

echo "==> Found modules: ${MODULES[*]}"

echo "==> Writing self-contained Dokka build"
mkdir -p "${DOKKA_DIR}"
cat > "${DOKKA_DIR}/settings.gradle.kts" <<'EOF'
rootProject.name = "flixelgdx-api-docs"
EOF

# Build module blocks for build.gradle.kts.
MODULE_BLOCKS=""
for mod in "${MODULES[@]}"; do
  src_main="${SRC_DIR}/${mod}/src/main"
  # Pick java or kotlin sub-folder; prefer "java", fall back to first child.
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
  echo "!! Dokka did not produce output at ${OUT_DIR}"
  exit 1
fi

echo "==> Massaging output for Docusaurus"
rm -rf "${SITE_API_DIR}.staging"
mkdir -p "${SITE_API_DIR}.staging"
# Copy module subtrees, drop Dokka's own top-level index (we keep our own).
for mod in "${MODULES[@]}"; do
  if [ -d "${OUT_DIR}/${mod}" ]; then
    cp -R "${OUT_DIR}/${mod}" "${SITE_API_DIR}.staging/${mod}"
  fi
done

# Add Docusaurus YAML front-matter to every generated markdown file, otherwise
# Docusaurus picks up the first line as a heading and the routing slug becomes
# unstable when packages are renamed.
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
        # Skip if already has frontmatter
        if text.startswith('---\n'):
            continue
        # Title = first markdown heading, fallback to filename
        m = re.search(r'^#\s+(.*?)\s*$', text, re.MULTILINE)
        title = m.group(1).strip() if m else os.path.splitext(f)[0]
        title = title.replace('"', "'")
        fm = f"---\ntitle: \"{title}\"\nhide_title: false\nsidebar_label: \"{title}\"\n---\n\n"
        with open(p, 'w', encoding='utf-8') as fh:
            fh.write(fm + text)
PY

echo "==> Replacing site/api content"
# Preserve the hand-written index.md so we keep the welcome content
mkdir -p "${SITE_API_DIR}"
INDEX_BACKUP=""
if [ -f "${SITE_API_DIR}/index.md" ]; then
  INDEX_BACKUP="$(mktemp)"
  cp "${SITE_API_DIR}/index.md" "${INDEX_BACKUP}"
fi
# Remove old module dirs (anything other than index.md)
find "${SITE_API_DIR}" -mindepth 1 -maxdepth 1 ! -name "index.md" -exec rm -rf {} +
cp -R "${SITE_API_DIR}.staging/." "${SITE_API_DIR}/"
rm -rf "${SITE_API_DIR}.staging"
if [ -n "${INDEX_BACKUP}" ]; then
  cp "${INDEX_BACKUP}" "${SITE_API_DIR}/index.md"
  rm -f "${INDEX_BACKUP}"
fi

echo "==> Done. API markdown is now under ${SITE_API_DIR}/"
