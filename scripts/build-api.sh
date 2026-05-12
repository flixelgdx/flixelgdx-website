#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Generate the FlixelGDX API reference from the framework's Java sources.
#
# Pipeline:
#   1. Sparse-checkout ONLY the Java source folders out of
#      flixelgdx/flixelgdx@master into build/flixelgdx-src/. We never download
#      Gradle scripts, tests, doc images or any other blobs, so the working
#      tree stays at ~3 MB.
#   2. Invoke the bundled Gradle wrapper to run `:dokka:dokkaGfm`. The wrapper
#      and the Dokka project ship inside this repository — contributors do
#      NOT need to install Gradle, Dokka, or the FlixelGDX framework.
#   3. Massage the generated Markdown tree into the layout Docusaurus expects
#      under site/api/, prepending YAML front-matter so each page renders
#      with our theme.
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
# ----------------------------------------------------------------------------
# Directories only — git sparse-checkout cone mode does not accept file
# patterns. The framework's README and llms.txt are not needed for Dokka.
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

if [ -n "${FRAMEWORK_REF}" ]; then
  echo "==> Checking out pinned ref ${FRAMEWORK_REF}"
  git -C "${SRC_DIR}" fetch --filter=blob:none --depth 1 origin "${FRAMEWORK_REF}" || true
  git -C "${SRC_DIR}" checkout --quiet "${FRAMEWORK_REF}"
else
  git -C "${SRC_DIR}" checkout --quiet "origin/${FRAMEWORK_BRANCH}"
fi

echo "==> Working tree size:"
du -sh "${SRC_DIR}" 2>/dev/null || true

# ----------------------------------------------------------------------------
# 2. Run the bundled Dokka build.
# ----------------------------------------------------------------------------
echo "==> Running Dokka GFM via bundled Gradle wrapper"
rm -rf "${OUT_DIR}"
(cd "${ROOT}" && ./gradlew --no-daemon -q :dokka:dokkaGfm)

# Dokka emits the module under a kebab-cased directory derived from the
# moduleName property ("FlixelGDX" -> "-flixel-g-d-x"). Pick whichever single
# subdirectory it produced so we don't hard-code that mangled name.
DOKKA_INNER="$(find "${OUT_DIR}" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
if [ -z "${DOKKA_INNER}" ]; then
  echo "!! Dokka did not produce a module directory under ${OUT_DIR}" >&2
  exit 1
fi
echo "==> Dokka rendered into ${DOKKA_INNER}"

# ----------------------------------------------------------------------------
# 3. Massage output for Docusaurus.
# ----------------------------------------------------------------------------
echo "==> Massaging output for Docusaurus"
STAGE="${SITE_API_DIR}.staging"
rm -rf "${STAGE}"
mkdir -p "${STAGE}"
cp -R "${DOKKA_INNER}/." "${STAGE}/"

python3 - "${STAGE}" <<'PY'
# Post-process Dokka's GFM so it parses cleanly as MDX.
#
# Dokka emits some HTML inside table cells (notably bare <br> and {} curly
# braces in javadoc snippets) that MDX rejects. We do a minimal sanitization
# pass: self-close <br>, escape stray { / } inside table data, and prepend
# a Docusaurus YAML front-matter block.
import os, re, sys

root = sys.argv[1]

BR_RE = re.compile(r'<br\s*>', re.IGNORECASE)
HEADING_RE = re.compile(r'^#\s+(.*?)\s*$', re.MULTILINE)


def escape_curly_braces(text: str) -> str:
    """MDX treats `{` / `}` as JSX expression delimiters. Dokka never wants
    that — it just passes raw javadoc text like `{@value #FOO}` through.
    Escape every stray curly brace except inside code spans (`...`) and
    fenced code blocks (```...```)."""
    out = []
    in_fence = False
    for line in text.splitlines(keepends=True):
        if line.lstrip().startswith('```'):
            in_fence = not in_fence
            out.append(line)
            continue
        if in_fence:
            out.append(line)
            continue
        # Outside fences: split on inline code spans so we leave them alone.
        parts = re.split(r'(`[^`]*`)', line)
        for i, p in enumerate(parts):
            if i % 2 == 0:  # not inside a code span
                p = p.replace('{', r'\{').replace('}', r'\}')
            parts[i] = p
        out.append(''.join(parts))
    return ''.join(out)


for base, dirs, files in os.walk(root):
    for f in files:
        if not f.endswith('.md'):
            continue
        p = os.path.join(base, f)
        with open(p, 'r', encoding='utf-8') as fh:
            text = fh.read()
        if text.startswith('---\n'):
            continue

        # Sanitize: self-close <br>, escape stray curlies everywhere outside
        # code spans / fenced blocks.
        text = BR_RE.sub('<br />', text)
        text = escape_curly_braces(text)

        m = HEADING_RE.search(text)
        title = m.group(1).strip() if m else os.path.splitext(f)[0]
        # Strip any inline markdown / HTML from the title so YAML stays valid.
        title = re.sub(r'\[(.*?)\]\([^)]*\)', r'\1', title)
        title = re.sub(r'<[^>]+>', '', title).strip()
        title = title.replace('"', "'")
        fm = (
            "---\n"
            f"title: \"{title}\"\n"
            "hide_title: false\n"
            f"sidebar_label: \"{title}\"\n"
            "---\n\n"
        )
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
cp -R "${STAGE}/." "${SITE_API_DIR}/"
rm -rf "${STAGE}"
if [ -n "${INDEX_BACKUP}" ]; then
  cp "${INDEX_BACKUP}" "${SITE_API_DIR}/index.md"
  rm -f "${INDEX_BACKUP}"
fi

echo "==> Done. API markdown is now under ${SITE_API_DIR}/"
