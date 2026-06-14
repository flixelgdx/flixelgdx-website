/**
 * Walks site/static/templates and writes:
 *   1. site/static/templates/index.json   -- list of template IDs for browser discovery
 *   2. site/static/templates/<id>/template.json -- enriched with a computed `files` section
 *
 * File discovery per template + language merges three layers in order:
 *   1. templates/common/          (global shared files; language-discriminator segments stripped)
 *   2. templates/<id>/common/     (template-local overrides; language-discriminator segments stripped)
 *   3. templates/<id>/<language>/ (language-specific source files)
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
 * @returns {Map<string, string>}
 */
function layerMap(layerRoot, fetchPrefix, targetLang) {
  const m = new Map();
  if (!fs.existsSync(layerRoot)) return m;
  for (const rel of walkFiles(layerRoot)) {
    const posixRel = rel.split(path.sep).join('/');
    const segments = posixRel.split('/');
    const discIdx = langDiscriminatorIndex(segments);
    if (discIdx !== -1) {
      if (segments[discIdx] !== targetLang) continue;
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
  const merged = new Map();
  for (const layer of layers) {
    for (const [k, v] of layer) merged.set(k, v);
  }
  return merged;
}

function listTemplateDirs() {
  if (!fs.existsSync(STATIC_TEMPLATES)) {
    console.warn('No static/templates yet; writing empty index.');
    return [];
  }
  return fs
    .readdirSync(STATIC_TEMPLATES, {withFileTypes: true})
    .filter((d) => d.isDirectory() && d.name !== 'common')
    .map((d) => d.name)
    .filter((name) => fs.existsSync(path.join(STATIC_TEMPLATES, name, 'template.json')));
}

function main() {
  const templateDirs = listTemplateDirs();
  const globalCommonRoot = path.join(STATIC_TEMPLATES, 'common');
  const globalCommonPrefix = 'templates/common';
  const ids = [];

  for (const id of templateDirs) {
    const manifestPath = path.join(STATIC_TEMPLATES, id, 'template.json');
    const raw = fs.readFileSync(manifestPath, 'utf8');
    const meta = JSON.parse(raw);
    if (meta.id !== id) {
      throw new Error(`template.json folder "${id}" must match "id" field (got ${meta.id})`);
    }

    const langs = Array.isArray(meta.languages) ? meta.languages : [];
    /** @type {Record<string, {path: string, fetch: string}[]>} */
    const files = {};

    for (const lang of langs) {
      const langRoot = path.join(STATIC_TEMPLATES, id, lang);
      if (!fs.existsSync(langRoot)) continue;

      const merged = mergeLayers([
        layerMap(globalCommonRoot, globalCommonPrefix, lang),
        layerMap(path.join(STATIC_TEMPLATES, id, 'common'), `templates/${id}/common`, lang),
        layerMap(langRoot, `templates/${id}/${lang}`, lang),
      ]);

      files[lang] = [...merged.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([pathRel, fetch]) => ({path: pathRel, fetch}));
    }

    const enriched = {
      id: meta.id,
      name: meta.name,
      description: meta.description,
      languages: langs.filter((lang) => files[lang]?.length),
      variables: meta.variables ?? [],
      files,
    };

    fs.writeFileSync(manifestPath, JSON.stringify(enriched, null, 2) + '\n', 'utf8');
    console.log(`  Wrote ${id}/template.json (${Object.keys(files).join(', ')})`);
    ids.push(id);
  }

  const indexPath = path.join(STATIC_TEMPLATES, 'index.json');
  fs.writeFileSync(indexPath, JSON.stringify({templates: ids}, null, 2) + '\n', 'utf8');
  console.log(`Wrote index.json (${ids.length} template(s)).`);
}

main();
