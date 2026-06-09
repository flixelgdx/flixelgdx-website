/**
 * Walks site/static/templates and writes site/static/templates/catalog.json
 * for the browser project generator. Merges layers per template + language:
 *   1. templates/common/
 *   2. templates/<id>/common/
 *   3. templates/<id>/<language>/
 * Later layers override earlier paths. Missing language folders are skipped.
 *
 * Run via: npm run build-templates (from site/)
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STATIC_TEMPLATES = path.resolve(__dirname, '../static/templates');

function walkFiles(dir, baseRel = '') {
  /** @type {string[]} */
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === '.DS_Store') continue;
    const full = path.join(dir, name);
    const rel = path.posix.join(baseRel.replace(/\\/g, '/'), name);
    const st = fs.statSync(full);
    if (st.isDirectory()) out.push(...walkFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

const LANG_DIRS = new Set(['java', 'kotlin']);

/**
 * If a path contains a language-discriminator segment (exactly 'java' or 'kotlin', appearing
 * before any 'src' segment), returns its index. Otherwise returns -1.
 * This lets common/ subfolders like lwjgl3/java/src/... be language-specific while
 * paths like lwjgl3/src/main/java/... are treated as shared.
 * @param {string[]} segments
 * @returns {number}
 */
function langDiscriminatorIndex(segments) {
  for (let i = 0; i < segments.length; i++) {
    if (segments[i] === 'src') return -1;
    if (LANG_DIRS.has(segments[i])) return i;
  }
  return -1;
}

/**
 * @param {string} layerRoot absolute path to layer root on disk
 * @param {string} fetchPrefix URL path segment after static/, e.g. "templates/common"
 * @param {string} targetLang the language being built for, e.g. "java" or "kotlin"
 */
function layerMap(layerRoot, fetchPrefix, targetLang) {
  /** @type {Map<string, string>} */
  const m = new Map();
  if (!fs.existsSync(layerRoot)) return m;
  for (const rel of walkFiles(layerRoot)) {
    const posixRel = rel.split(path.sep).join('/');
    const segments = posixRel.split('/');
    const discIdx = langDiscriminatorIndex(segments);
    if (discIdx !== -1) {
      // Language-specific file: skip if it doesn't match the target language.
      if (segments[discIdx] !== targetLang) continue;
      // Strip the language-discriminator segment from the output path.
      const stripped = [...segments.slice(0, discIdx), ...segments.slice(discIdx + 1)].join('/');
      const fetch = `${fetchPrefix}/${posixRel}`.replace(/\/+/g, '/');
      m.set(stripped, fetch);
    } else {
      const fetch = `${fetchPrefix}/${posixRel}`.replace(/\/+/g, '/');
      m.set(posixRel, fetch);
    }
  }
  return m;
}

function mergeLayers(layers) {
  /** @type {Map<string, string>} */
  const merged = new Map();
  for (const layer of layers) {
    for (const [k, v] of layer) merged.set(k, v);
  }
  return merged;
}

function listTemplateDirs() {
  if (!fs.existsSync(STATIC_TEMPLATES)) {
    console.warn('No static/templates yet; writing empty catalog.');
    return [];
  }
  return fs
    .readdirSync(STATIC_TEMPLATES, {withFileTypes: true})
    .filter((d) => d.isDirectory() && d.name !== 'common')
    .map((d) => d.name)
    .filter((name) => {
      const tp = path.join(STATIC_TEMPLATES, name, 'template.json');
      return fs.existsSync(tp);
    });
}

function main() {
  const templateDirs = listTemplateDirs();
  /** @type {unknown[]} */
  const templates = [];

  const globalCommonRoot = path.join(STATIC_TEMPLATES, 'common');
  const globalCommonPrefix = 'templates/common';

  for (const id of templateDirs) {
    const manifestPath = path.join(STATIC_TEMPLATES, id, 'template.json');
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const meta = JSON.parse(raw);
    if (meta.id !== id) {
      throw new Error(
        `template.json folder "${id}" must match "id" field (got ${meta.id})`
      );
    }

    const langs = Array.isArray(meta.languages) ? meta.languages : [];
    /** @type {Record<string, {path: string, fetch: string}[]>} */
    const files = {};

    for (const lang of langs) {
      const langRoot = path.join(STATIC_TEMPLATES, id, lang);
      if (!fs.existsSync(langRoot)) {
        continue;
      }
      const l1 = layerMap(globalCommonRoot, globalCommonPrefix, lang);
      const l2 = layerMap(
        path.join(STATIC_TEMPLATES, id, 'common'),
        `templates/${id}/common`,
        lang
      );
      const l3 = layerMap(langRoot, `templates/${id}/${lang}`, lang);
      const merged = mergeLayers([l1, l2, l3]);
      files[lang] = [...merged.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pathRel, fetch]) => ({path: pathRel, fetch}));
    }

    templates.push({
      id: meta.id,
      name: meta.name,
      description: meta.description,
      languages: langs.filter((lang) => files[lang]?.length),
      variables: meta.variables ?? [],
      files,
    });
  }

  const catalog = {version: 1, templates};
  const outPath = path.join(STATIC_TEMPLATES, 'catalog.json');
  fs.mkdirSync(STATIC_TEMPLATES, {recursive: true});
  fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
  console.log(
    `Wrote ${outPath} (${templates.length} template(s), ${templateDirs.length} scanned).`
  );
}

main();
