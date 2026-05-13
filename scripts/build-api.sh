#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Generate the FlixelGDX API reference (one tree per module) and drop the
# result under `site/api/<module>/` ready for Docusaurus to consume.
#
# Pipeline:
#   1. Sparse-clone Java sources from flixelgdx/flixelgdx@master into
#      build/flixelgdx-src/  (≈ 3 MB instead of the whole repo).
#   2. Run `./gradlew :dokka:dokkaGfmAll` to render five GFM trees under
#      build/dokka-out/{core, lwjgl3, teavm, android, ios}. Each uses
#      `kotlin-as-java-plugin` so signatures come out as real Java
#      (`public class Foo extends Bar implements Baz`).
#   3. Run `scripts/postprocess_api.py` which restructures the folders
#      into a short nested layout, rewrites internal links, inlines each
#      member's full doc onto the owning class page, adds View-Source
#      buttons, etc. (see the script's docstring for the full list).
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
# 1. Sparse checkout — pull ONLY Java source dirs from each module.
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
# 2. Run Dokka per-module (kotlin-as-java-plugin + GFM).
# ----------------------------------------------------------------------------
echo "==> Running Dokka GFM via bundled Gradle wrapper"
rm -rf "${OUT_DIR}"
(cd "${ROOT}" && ./gradlew --no-daemon -q :dokka:dokkaGfmAll)

if [ ! -d "${OUT_DIR}" ]; then
  echo "!! Dokka did not produce output at ${OUT_DIR}" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# 3. Restructure + post-process. Backup index.md so the hand-written
#    landing page survives the wipe.
# ----------------------------------------------------------------------------
INDEX_BACKUP=""
if [ -f "${SITE_API_DIR}/index.md" ]; then
  INDEX_BACKUP="$(mktemp)"
  cp "${SITE_API_DIR}/index.md" "${INDEX_BACKUP}"
fi
mkdir -p "${SITE_API_DIR}"
# Wipe per-module subtrees (the Python script also does this, but doing
# it here means stale modules from a previous run also get cleared).
find "${SITE_API_DIR}" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

python3 "${ROOT}/scripts/postprocess_api.py" "${OUT_DIR}" "${SITE_API_DIR}" "${SRC_DIR}"

if [ -n "${INDEX_BACKUP}" ]; then
  cp "${INDEX_BACKUP}" "${SITE_API_DIR}/index.md"
  rm -f "${INDEX_BACKUP}"
fi

echo "==> Done. API markdown is now under ${SITE_API_DIR}/"
