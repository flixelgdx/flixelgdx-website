#!/usr/bin/env bash
# ----------------------------------------------------------------------------
# Generate the FlixelGDX API reference (one tree per module) and drop the
# result under `site/api/<module>/` ready for Docusaurus to consume.
#
# Pipeline:
#   1. Shallow-clone flixelgdx/flixelgdx@master into build/flixelgdx-src/
#      (depth 1, no history). A shallow clone is used rather than a sparse
#      checkout because DocletMD must run inside the framework's own Gradle
#      build to get a fully resolved compile classpath (libGDX, etc.).
#   2. Apply scripts/docletmd-init.gradle to the framework's Gradle build via
#      the -I flag. DocletMD auto-wires to each module's source set and
#      classpath, so all dependencies are resolved correctly.
#   3. Copy each per-module tree to site/api/<module>/, preserving any
#      hand-written index.md at the root of site/api/.
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
OUT_DIR="${BUILD_DIR}/docletmd-out"
SITE_API_DIR="${ROOT}/site/api"

FRAMEWORK_REPO="${FLIXELGDX_REPO:-https://github.com/flixelgdx/flixelgdx.git}"
FRAMEWORK_BRANCH="${FLIXELGDX_BRANCH:-master}"
FRAMEWORK_REF="${FLIXELGDX_REF:-}"

echo "==> Preparing build directories"
mkdir -p "${BUILD_DIR}"

# ----------------------------------------------------------------------------
# 1. Shallow clone -- depth 1, full working tree so Gradle files are present.
# ----------------------------------------------------------------------------
# If the checkout exists but lacks gradlew (e.g. a leftover sparse checkout),
# wipe it so the full shallow clone runs below.
if [ -d "${SRC_DIR}/.git" ] && [ ! -f "${SRC_DIR}/gradlew" ]; then
  echo "==> Stale sparse checkout detected -- re-cloning"
  rm -rf "${SRC_DIR}"
fi

if [ ! -d "${SRC_DIR}/.git" ]; then
  echo "==> Cloning ${FRAMEWORK_REPO} (depth 1, branch ${FRAMEWORK_BRANCH})"
  git clone --depth 1 --branch "${FRAMEWORK_BRANCH}" "${FRAMEWORK_REPO}" "${SRC_DIR}"
else
  echo "==> Updating existing framework checkout"
  git -C "${SRC_DIR}" fetch --depth 1 origin "${FRAMEWORK_BRANCH}"
  git -C "${SRC_DIR}" checkout --quiet "FETCH_HEAD"
fi

if [ -n "${FRAMEWORK_REF}" ]; then
  echo "==> Checking out pinned ref ${FRAMEWORK_REF}"
  git -C "${SRC_DIR}" fetch --depth 1 origin "${FRAMEWORK_REF}"
  git -C "${SRC_DIR}" checkout --quiet "FETCH_HEAD"
fi

echo "==> Working tree size:"
du -sh "${SRC_DIR}" 2>/dev/null || true

# ----------------------------------------------------------------------------
# 2. Run DocletMD via the framework's own Gradle build.
#    The init script applies DocletMD to each module and wires its classpath.
# ----------------------------------------------------------------------------
echo "==> Running DocletMD via framework Gradle wrapper"
rm -rf "${OUT_DIR}"
chmod +x "${SRC_DIR}/gradlew"
(cd "${SRC_DIR}" && ./gradlew \
    -I "${ROOT}/scripts/docletmd-init.gradle" \
    -PdocletmdOutDir="${OUT_DIR}" \
    --no-daemon -q \
    :flixelgdx-core:generateDocletMD \
    :flixelgdx-lwjgl3:generateDocletMD \
    :flixelgdx-teavm:generateDocletMD)

if [ ! -d "${OUT_DIR}" ]; then
  echo "!! DocletMD did not produce output at ${OUT_DIR}" >&2
  exit 1
fi

# ----------------------------------------------------------------------------
# 3. Copy per-module trees to site/api/, preserving any hand-written index.md.
# ----------------------------------------------------------------------------

# Walk down a directory while each level has exactly one child directory and
# no files. The result is the package prefix that can be stripped so the
# sidebar root starts at the first directory with real content (multiple
# children or actual files).
strip_prefix_of() {
  local dir="$1"
  local prefix=""
  while true; do
    local count
    count=$(ls -1 "$dir" 2>/dev/null | wc -l)
    if [ "$count" -ne 1 ]; then break; fi
    local entry
    entry=$(ls -1 "$dir")
    if [ ! -d "$dir/$entry" ]; then break; fi
    prefix="${prefix}${entry}/"
    dir="$dir/$entry"
  done
  echo "$prefix"
}

INDEX_BACKUP=""
if [ -f "${SITE_API_DIR}/index.md" ]; then
  INDEX_BACKUP="$(mktemp)"
  cp "${SITE_API_DIR}/index.md" "${INDEX_BACKUP}"
fi

mkdir -p "${SITE_API_DIR}"
# Wipe per-module subtrees so stale classes from a previous run are removed.
find "${SITE_API_DIR}" -mindepth 1 -maxdepth 1 -type d -exec rm -rf {} +

for slug in core lwjgl3 teavm; do
  src="${OUT_DIR}/${slug}"
  if [ -d "${src}" ]; then
    prefix=$(strip_prefix_of "${src}")
    actual_src="${src}/${prefix%/}"
    mkdir -p "${SITE_API_DIR}/${slug}"
    cp -r "${actual_src}/." "${SITE_API_DIR}/${slug}/"
    echo "  -> site/api/${slug}/ (stripped ${prefix:-<nothing>})"
  fi
done

if [ -n "${INDEX_BACKUP}" ]; then
  cp "${INDEX_BACKUP}" "${SITE_API_DIR}/index.md"
  rm -f "${INDEX_BACKUP}"
fi

# Generate _category_.json in every package subdirectory so that folder nodes
# sort above class-file nodes in the Docusaurus autogenerated sidebar. Folders
# get position -1; unpositioned docs sort after all positioned items.
echo "==> Generating _category_.json for sidebar ordering"
find "${SITE_API_DIR}" -mindepth 2 -type d | while IFS= read -r dir; do
  dirname=$(basename "${dir}")
  printf '{"label":"%s","position":-1}\n' "${dirname}" > "${dir}/_category_.json"
done

echo "==> Done. API markdown is now under ${SITE_API_DIR}/"
