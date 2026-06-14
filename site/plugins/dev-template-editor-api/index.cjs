/**
 * Dev-only REST API for editing files under site/static/templates.
 * Registered from docusaurus.config only when NODE_ENV === 'development'.
 */
const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

/** @param {string} siteDir */
function templatesRoot(siteDir) {
  return path.join(siteDir, 'static', 'templates');
}

/** @param {string} rel */
function assertSafeRel(rel) {
  if (typeof rel !== 'string' || !rel) {
    const err = new Error('path required');
    err.statusCode = 400;
    throw err;
  }
  const norm = path.posix.normalize(rel.replace(/\\/g, '/'));
  if (norm.startsWith('..') || norm.includes('/..') || norm.includes('../')) {
    const err = new Error('invalid path');
    err.statusCode = 400;
    throw err;
  }
  return norm;
}

/**
 * @param {string} siteDir
 * @param {string} templateId
 * @returns {string}
 */
function templateBase(siteDir, templateId) {
  if (templateId === 'common') {
    return path.join(templatesRoot(siteDir), 'common');
  }
  const id = assertSafeRel(templateId);
  return path.join(templatesRoot(siteDir), id);
}

/**
 * @param {string} fullPath
 * @param {string} root
 */
function assertUnderRoot(fullPath, root) {
  const resolved = path.resolve(fullPath);
  const rootResolved = path.resolve(root);
  if (!resolved.startsWith(rootResolved + path.sep) && resolved !== rootResolved) {
    const err = new Error('path escapes template root');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * @param {string} dir
 * @returns {object}
 */
function buildTree(dir, relBase = '') {
  const name = relBase ? path.basename(relBase) : path.basename(dir);
  const st = fs.statSync(dir);
  if (!st.isDirectory()) {
    return {type: 'file', name, path: relBase || name};
  }
  const children = fs
    .readdirSync(dir, {withFileTypes: true})
    .filter((d) => !d.name.startsWith('.'))
    .sort((a, b) => {
      if (a.isDirectory() === b.isDirectory()) return a.name.localeCompare(b.name);
      return a.isDirectory() ? -1 : 1;
    })
    .map((d) => {
      const childRel = relBase ? `${relBase}/${d.name}` : d.name;
      const full = path.join(dir, d.name);
      if (d.isDirectory()) {
        return buildTree(full, childRel);
      }
      return {type: 'file', name: d.name, path: childRel};
    });
  return {type: 'dir', name, path: relBase || '', children};
}

/**
 * @param {string} siteDir
 */
function listTemplates(siteDir) {
  const root = templatesRoot(siteDir);
  if (!fs.existsSync(root)) return {templates: []};
  const out = [];
  const commonPath = path.join(root, 'common');
  if (fs.existsSync(commonPath) && fs.statSync(commonPath).isDirectory()) {
    out.push({
      id: 'common',
      isCommon: true,
      manifest: null,
      tree: buildTree(commonPath),
    });
  }
  for (const ent of fs.readdirSync(root, {withFileTypes: true})) {
    if (!ent.isDirectory()) continue;
    if (ent.name === 'common') continue;
    const tp = path.join(root, ent.name, 'template.json');
    if (!fs.existsSync(tp)) continue;
    let manifest = null;
    try {
      manifest = JSON.parse(fs.readFileSync(tp, 'utf8'));
    } catch {
      manifest = {parseError: true};
    }
    const base = path.join(root, ent.name);
    out.push({
      id: ent.name,
      isCommon: false,
      manifest,
      tree: buildTree(base),
    });
  }
  out.sort((a, b) => {
    if (a.isCommon !== b.isCommon) return a.isCommon ? -1 : 1;
    return a.id.localeCompare(b.id);
  });
  return {templates: out};
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function rebuildTemplates(siteDir) {
  const script = path.join(siteDir, 'scripts', 'build-template-catalog.mjs');
  if (!fs.existsSync(script)) return {ok: false, error: 'script missing'};
  const r = spawnSync(process.execPath, [script], {
    cwd: siteDir,
    encoding: 'utf8',
    env: {...process.env},
  });
  if (r.status !== 0) {
    return {ok: false, error: r.stderr || r.stdout || `exit ${r.status}`};
  }
  return {ok: true};
}

/**
 * @param {import('@docusaurus/types').LoadContext} context
 */
module.exports = function devTemplateEditorApiPlugin(context) {
  const siteDir = context.siteDir;
  const baseUrl = context.siteConfig.baseUrl || '/';
  const apiPrefix = `${baseUrl.replace(/\/$/, '')}/api/dev`.replace(/\/+/g, '/');

  return {
    name: 'dev-template-editor-api',
    configureWebpack(_config, isServer) {
      if (isServer || process.env.NODE_ENV !== 'development') {
        return {};
      }
      return {
        devServer: {
          setupMiddlewares(middlewares, devServer) {
            const app = devServer.app;
            if (!app) return middlewares;

            app.use((req, res, next) => {
              if (process.env.NODE_ENV !== 'development') {
                next();
                return;
              }
              if (!req.url || !req.url.startsWith(apiPrefix)) {
                next();
                return;
              }

              const u = new URL(req.url, 'http://localhost');
              const routePath = u.pathname;

              try {
                if (req.method === 'GET' && routePath === `${apiPrefix}/templates`) {
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(listTemplates(siteDir)));
                  return;
                }

                const fileRead = new RegExp(
                  `^${escapeRegex(apiPrefix)}/templates/([^/]+)/file$`
                );
                const mRead = routePath.match(fileRead);
                if (req.method === 'GET' && mRead) {
                  const id = decodeURIComponent(mRead[1]);
                  const rel = u.searchParams.get('path') || '';
                  const safe = assertSafeRel(rel);
                  const base = templateBase(siteDir, id);
                  const full = path.join(base, ...safe.split('/'));
                  assertUnderRoot(full, base);
                  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) {
                    res.statusCode = 404;
                    res.end('not found');
                    return;
                  }
                  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
                  res.end(fs.readFileSync(full, 'utf8'));
                  return;
                }

                const mWrite = routePath.match(fileRead);
                if (req.method === 'POST' && mWrite) {
                  void (async () => {
                    const id = decodeURIComponent(mWrite[1]);
                    const rel = u.searchParams.get('path') || '';
                    const safe = assertSafeRel(rel);
                    const base = templateBase(siteDir, id);
                    const full = path.join(base, ...safe.split('/'));
                    assertUnderRoot(full, base);
                    const body = await readBody(req);
                    fs.mkdirSync(path.dirname(full), {recursive: true});
                    fs.writeFileSync(full, body, 'utf8');
                    const rebuild = rebuildTemplates(siteDir);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ok: true, rebuild}));
                  })().catch((e) => {
                    res.statusCode = e.statusCode || 500;
                    res.end(e.message || String(e));
                  });
                  return;
                }

                const mkdirRe = new RegExp(
                  `^${escapeRegex(apiPrefix)}/templates/([^/]+)/mkdir$`
                );
                const mMkdir = routePath.match(mkdirRe);
                if (req.method === 'POST' && mMkdir) {
                  const id = decodeURIComponent(mMkdir[1]);
                  const rel = u.searchParams.get('path') || '';
                  const safe = assertSafeRel(rel);
                  const base = templateBase(siteDir, id);
                  const full = path.join(base, ...safe.split('/'));
                  assertUnderRoot(full, base);
                  fs.mkdirSync(full, {recursive: true});
                  const rebuild = rebuildTemplates(siteDir);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ok: true, rebuild}));
                  return;
                }

                const delRe = new RegExp(
                  `^${escapeRegex(apiPrefix)}/templates/([^/]+)/file$`
                );
                const mDel = routePath.match(delRe);
                if (req.method === 'DELETE' && mDel) {
                  const id = decodeURIComponent(mDel[1]);
                  const rel = u.searchParams.get('path') || '';
                  const safe = assertSafeRel(rel);
                  const base = templateBase(siteDir, id);
                  const full = path.join(base, ...safe.split('/'));
                  assertUnderRoot(full, base);
                  if (!fs.existsSync(full)) {
                    res.statusCode = 404;
                    res.end('not found');
                    return;
                  }
                  const st = fs.statSync(full);
                  if (st.isDirectory()) {
                    fs.rmSync(full, {recursive: true});
                  } else {
                    fs.unlinkSync(full);
                  }
                  const rebuild = rebuildTemplates(siteDir);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ok: true, rebuild}));
                  return;
                }

                const mvRe = new RegExp(
                  `^${escapeRegex(apiPrefix)}/templates/([^/]+)/mv$`
                );
                const mMv = routePath.match(mvRe);
                if (req.method === 'POST' && mMv) {
                  void (async () => {
                    const id = decodeURIComponent(mMv[1]);
                    const body = await readBody(req);
                    const {from, to} = JSON.parse(body || '{}');
                    const fromSafe = assertSafeRel(from);
                    const toSafe = assertSafeRel(to);
                    const base = templateBase(siteDir, id);
                    const fullFrom = path.join(base, ...fromSafe.split('/'));
                    const fullTo = path.join(base, ...toSafe.split('/'));
                    assertUnderRoot(fullFrom, base);
                    assertUnderRoot(fullTo, base);
                    fs.mkdirSync(path.dirname(fullTo), {recursive: true});
                    fs.renameSync(fullFrom, fullTo);
                    const rebuild = rebuildTemplates(siteDir);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ok: true, rebuild}));
                  })().catch((e) => {
                    res.statusCode = e.statusCode || 500;
                    res.end(e.message || String(e));
                  });
                  return;
                }

                if (req.method === 'POST' && routePath === `${apiPrefix}/templates/create`) {
                  void (async () => {
                    const body = await readBody(req);
                    const data = JSON.parse(body || '{}');
                    const {
                      id,
                      name,
                      description,
                      languages,
                      variables,
                      mode,
                      sourceId,
                    } = data;
                    if (!id || typeof id !== 'string') {
                      res.statusCode = 400;
                      res.end('id required');
                      return;
                    }
                    assertSafeRel(id);
                    const dest = path.join(templatesRoot(siteDir), id);
                    if (fs.existsSync(dest)) {
                      res.statusCode = 409;
                      res.end('template already exists');
                      return;
                    }
                    if (mode === 'copy' && sourceId) {
                      const src = templateBase(siteDir, sourceId);
                      if (!fs.existsSync(src)) {
                        res.statusCode = 400;
                        res.end('source missing');
                        return;
                      }
                      fs.cpSync(src, dest, {recursive: true});
                    } else {
                      fs.mkdirSync(dest, {recursive: true});
                      const globalCommon = path.join(templatesRoot(siteDir), 'common');
                      const destCommon = path.join(dest, 'common');
                      if (fs.existsSync(globalCommon)) {
                        fs.cpSync(globalCommon, destCommon, {recursive: true});
                      } else {
                        fs.mkdirSync(destCommon, {recursive: true});
                      }
                      for (const lang of languages || []) {
                        if (['java', 'kotlin', 'groovy'].includes(lang)) {
                          fs.mkdirSync(path.join(dest, lang), {recursive: true});
                        }
                      }
                    }
                    const manifest = {
                      id,
                      name: name || id,
                      description: description || '',
                      languages: Array.isArray(languages) ? languages : ['java'],
                      variables: Array.isArray(variables) ? variables : ['GAME', 'PACKAGE', 'PACKAGE_PATH'],
                    };
                    fs.writeFileSync(
                      path.join(dest, 'template.json'),
                      JSON.stringify(manifest, null, 2) + '\n',
                      'utf8'
                    );
                    const rebuild = rebuildTemplates(siteDir);
                    res.setHeader('Content-Type', 'application/json');
                    res.end(JSON.stringify({ok: true, id, rebuild}));
                  })().catch((e) => {
                    res.statusCode = 500;
                    res.end(e.message || String(e));
                  });
                  return;
                }

                if (req.method === 'POST' && routePath === `${apiPrefix}/templates/rebuild`) {
                  const rebuild = rebuildTemplates(siteDir);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify(rebuild));
                  return;
                }

                const delTemplateRe = new RegExp(
                  `^${escapeRegex(apiPrefix)}/templates/([^/]+)$`
                );
                const mDelTemplate = routePath.match(delTemplateRe);
                if (req.method === 'DELETE' && mDelTemplate) {
                  const id = decodeURIComponent(mDelTemplate[1]);
                  if (id === 'common') {
                    res.statusCode = 400;
                    res.end('cannot delete reserved template');
                    return;
                  }
                  assertSafeRel(id);
                  const tp = path.join(templatesRoot(siteDir), id);
                  assertUnderRoot(tp, templatesRoot(siteDir));
                  if (!fs.existsSync(tp)) {
                    res.statusCode = 404;
                    res.end('not found');
                    return;
                  }
                  fs.rmSync(tp, {recursive: true});
                  const rebuild = rebuildTemplates(siteDir);
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ok: true, rebuild}));
                  return;
                }

                res.statusCode = 404;
                res.end('not found');
              } catch (e) {
                res.statusCode = /** @type {Error & {statusCode?: number}} */ (e).statusCode || 500;
                res.end(/** @type {Error} */ (e).message || String(e));
              }
            });

            return middlewares;
          },
        },
      };
    },
  };
};

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
