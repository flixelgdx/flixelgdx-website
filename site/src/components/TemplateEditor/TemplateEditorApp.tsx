import {useCallback, useEffect, useMemo, useRef, useState, type JSX} from 'react';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Layout from '@theme/Layout';
import {
  createTemplate,
  deleteTemplatePath,
  fetchTemplateList,
  mkdirTemplate,
  mvTemplatePath,
  readTemplateFile,
  rebuildCatalog,
  writeTemplateFile,
} from './devApi';
import {ManifestForm} from './ManifestForm';
import {NewTemplateWizard, type WizardPayload} from './NewTemplateWizard';
import {TreePanel} from './TreePanel';
import type {TemplateListEntry, TemplateManifest} from './types';
import styles from './TemplateEditor.module.css';

function insertAtCursor(el: HTMLTextAreaElement, snippet: string) {
  const start = el.selectionStart;
  const end = el.selectionEnd;
  const v = el.value;
  el.value = `${v.slice(0, start)}${snippet}${v.slice(end)}`;
  const pos = start + snippet.length;
  el.selectionStart = el.selectionEnd = pos;
}

export default function TemplateEditorApp(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const baseUrl = siteConfig.baseUrl;
  const [templates, setTemplates] = useState<TemplateListEntry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [editorText, setEditorText] = useState('');
  const originalTextRef = useRef('');
  const [dirty, setDirty] = useState(false);
  const [rawManifest, setRawManifest] = useState(false);
  const [manifestDraft, setManifestDraft] = useState<TemplateManifest | null>(null);
  const [manifestRaw, setManifestRaw] = useState('');
  const [manifestDirty, setManifestDirty] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [wizardOpen, setWizardOpen] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const manifestTaRef = useRef<HTMLTextAreaElement>(null);

  const selected = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [templates, selectedId]
  );

  const isManifestFile =
    selectedPath === 'template.json' && selected && !selected.isCommon;

  const placeholderVars = useMemo(() => {
    if (manifestDraft?.variables?.length) return manifestDraft.variables;
    const m = selected?.manifest;
    if (m && Array.isArray(m.variables) && m.variables.length) return m.variables;
    return ['GAME', 'PACKAGE', 'PACKAGE_PATH'];
  }, [manifestDraft, selected]);

  const refresh = useCallback(async () => {
    const data = await fetchTemplateList(baseUrl);
    setTemplates(data.templates);
    return data.templates;
  }, [baseUrl]);

  useEffect(() => {
    void refresh()
      .then((list) => {
        if (!selectedId && list.length) {
          const first = list.find((t) => !t.isCommon) ?? list[0];
          setSelectedId(first.id);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [refresh, selectedId]);

  useEffect(() => {
    if (!selectedId || !selectedPath) return;
    setError(null);
    void readTemplateFile(baseUrl, selectedId, selectedPath)
      .then((text) => {
        setEditorText(text);
        originalTextRef.current = text;
        setDirty(false);
        setManifestRaw(text);
        setManifestDirty(false);
        setRawManifest(false);
        if (selectedPath === 'template.json' && selected && !selected.isCommon) {
          try {
            setManifestDraft(JSON.parse(text) as TemplateManifest);
          } catch {
            setManifestDraft(null);
          }
        } else {
          setManifestDraft(null);
        }
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [baseUrl, selectedId, selectedPath, selected]);

  async function save() {
    if (!selectedId || !selectedPath) return;
    setStatus('Saving…');
    setError(null);
    try {
      let body = editorText;
      if (isManifestFile) {
        if (rawManifest) {
          body = manifestRaw;
          JSON.parse(body);
        } else if (manifestDraft) {
          body = JSON.stringify(manifestDraft, null, 2) + '\n';
        }
      }
      await writeTemplateFile(baseUrl, selectedId, selectedPath, body);
      originalTextRef.current = body;
      setEditorText(body);
      setManifestRaw(body);
      setDirty(false);
      setManifestDirty(false);
      if (isManifestFile && manifestDraft && !rawManifest) {
        setManifestDraft(JSON.parse(body) as TemplateManifest);
      }
      setStatus('Saved (catalog rebuilt by server).');
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStatus('');
    }
  }

  async function handleCreate(payload: WizardPayload) {
    await createTemplate(baseUrl, payload);
    const list = await refresh();
    setSelectedId(payload.id);
    setSelectedPath('template.json');
    setWizardOpen(false);
    if (!list.find((t) => t.id === payload.id)) {
      setError('Created but list refresh failed');
    }
  }

  async function handleAddFile() {
    if (!selectedId) return;
    const name = window.prompt('New file path (relative to template root), e.g. java/core/foo.txt');
    if (!name) return;
    await writeTemplateFile(baseUrl, selectedId, name, '');
    await refresh();
    setSelectedPath(name);
  }

  async function handleAddFolder() {
    if (!selectedId) return;
    const name = window.prompt('New folder path (relative), e.g. java/extra');
    if (!name) return;
    await mkdirTemplate(baseUrl, selectedId, name);
    await refresh();
  }

  async function handleDelete() {
    if (!selectedId || !selectedPath) return;
    if (!window.confirm(`Delete ${selectedPath}?`)) return;
    await deleteTemplatePath(baseUrl, selectedId, selectedPath);
    setSelectedPath(null);
    setEditorText('');
    await refresh();
  }

  async function handleRename() {
    if (!selectedId || !selectedPath) return;
    const to = window.prompt('New path (relative)', selectedPath);
    if (!to || to === selectedPath) return;
    await mvTemplatePath(baseUrl, selectedId, selectedPath, to);
    setSelectedPath(to);
    await refresh();
  }

  const manifestUnsaved =
    isManifestFile &&
    manifestDraft &&
    (rawManifest ? manifestRaw !== originalTextRef.current : manifestDirty);

  return (
    <Layout title="Template editor" description="Dev-only FlixelGDX template editor">
      <div className={styles.page}>
        <div className={styles.banner}>
          <strong>Development only</strong> — this page and its API exist only when{' '}
          <code>NODE_ENV=development</code>. Never ship or link this in production docs.
        </div>
        <div className={styles.toolbar}>
          <h1 className={styles.title}>Template editor</h1>
          <button type="button" className={styles.btn} onClick={() => void refresh()}>
            Refresh tree
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => setWizardOpen(true)}>
            New template
          </button>
          <button
            type="button"
            className={styles.btn}
            onClick={() =>
              void rebuildCatalog(baseUrl)
                .then(() => setStatus('catalog.json rebuilt'))
                .catch((e) => setError(String(e)))
            }
          >
            Rebuild catalog only
          </button>
        </div>
        {error && <div className={styles.error}>{error}</div>}
        {status && <div className={styles.status}>{status}</div>}
        <div className={styles.panels}>
          <aside className={styles.left}>
            <h2 className={styles.h2}>Templates</h2>
            <ul className={styles.templateList}>
              {templates.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`${styles.templateBtn} ${selectedId === t.id ? styles.templateBtnOn : ''}`}
                    onClick={() => {
                      setSelectedId(t.id);
                      setSelectedPath(null);
                      setEditorText('');
                      setRawManifest(false);
                      setDirty(false);
                    }}
                  >
                    {t.isCommon ? 'common (global)' : t.manifest?.name ?? t.id}
                  </button>
                </li>
              ))}
            </ul>
            {selected && (
              <TreePanel
                root={selected.tree}
                selectedPath={selectedPath}
                onSelectFile={setSelectedPath}
                onAddFile={() => void handleAddFile()}
                onAddFolder={() => void handleAddFolder()}
                onDelete={() => void handleDelete()}
                onRename={() => void handleRename()}
              />
            )}
          </aside>
          <main className={styles.right}>
            {!selectedPath && <p className={styles.muted}>Select a file from the tree.</p>}

            {selectedPath && isManifestFile && manifestDraft && (
              <>
                <div className={styles.editorHeader}>
                  <span className={styles.fileTab}>
                    template.json
                    {manifestUnsaved ? <span className={styles.dot} title="Unsaved" /> : null}
                  </span>
                  <label className={styles.toggleRaw}>
                    <input
                      type="checkbox"
                      checked={rawManifest}
                      onChange={(e) => {
                        const on = e.target.checked;
                        setRawManifest(on);
                        if (on) {
                          setManifestRaw(JSON.stringify(manifestDraft, null, 2) + '\n');
                          setManifestDirty(true);
                        } else {
                          try {
                            setManifestDraft(JSON.parse(manifestRaw) as TemplateManifest);
                            setManifestDirty(false);
                          } catch {
                            /* stay raw until valid */
                          }
                        }
                      }}
                    />
                    View raw JSON
                  </label>
                  <button
                    type="button"
                    className={styles.btnPrimary}
                    onClick={() => void save()}
                    disabled={!manifestUnsaved}
                  >
                    Save manifest
                  </button>
                </div>
                {rawManifest && (
                  <>
                    <div className={styles.placeholderBar}>
                      <span className={styles.phLabel}>Insert placeholder:</span>
                      {placeholderVars.map((v) => (
                        <button
                          key={v}
                          type="button"
                          className={styles.phBtn}
                          onClick={() => {
                            const el = manifestTaRef.current;
                            if (!el) return;
                            insertAtCursor(el, `{{${v}}}`);
                            setManifestRaw(el.value);
                            setManifestDirty(true);
                          }}
                        >
                          {`{{${v}}}`}
                        </button>
                      ))}
                    </div>
                    <textarea
                      ref={manifestTaRef}
                      className={styles.code}
                      spellCheck={false}
                      value={manifestRaw}
                      onChange={(e) => {
                        setManifestRaw(e.target.value);
                        setManifestDirty(e.target.value !== originalTextRef.current);
                      }}
                    />
                  </>
                )}
                {!rawManifest && (
                  <ManifestForm
                    manifest={manifestDraft}
                    onManifestChange={(m) => {
                      setManifestDraft(m);
                      setManifestDirty(true);
                    }}
                  />
                )}
              </>
            )}

            {selectedPath && isManifestFile && !manifestDraft && (
              <>
                <div className={styles.editorHeader}>
                  <span className={styles.fileTab}>
                    template.json (invalid JSON)
                    {editorText !== originalTextRef.current ? (
                      <span className={styles.dot} title="Unsaved" />
                    ) : null}
                  </span>
                  <button type="button" className={styles.btnPrimary} onClick={() => void save()}>
                    Save raw
                  </button>
                </div>
                <p className={styles.warn}>Parse error — edit raw JSON, then save.</p>
                <textarea
                  className={styles.code}
                  spellCheck={false}
                  value={editorText}
                  onChange={(e) => {
                    setEditorText(e.target.value);
                    setDirty(e.target.value !== originalTextRef.current);
                  }}
                />
              </>
            )}

            {selectedPath && !isManifestFile && (
              <>
                <div className={styles.editorHeader}>
                  <span className={styles.fileTab}>
                    {selectedPath}
                    {dirty ? <span className={styles.dot} title="Unsaved" /> : null}
                  </span>
                  <div className={styles.placeholderBar}>
                    <span className={styles.phLabel}>Insert placeholder:</span>
                    {placeholderVars.map((v) => (
                      <button
                        key={v}
                        type="button"
                        className={styles.phBtn}
                        onClick={() => {
                          const el = taRef.current;
                          if (!el) return;
                          insertAtCursor(el, `{{${v}}}`);
                          setEditorText(el.value);
                          setDirty(el.value !== originalTextRef.current);
                        }}
                      >
                        {`{{${v}}}`}
                      </button>
                    ))}
                  </div>
                  <button type="button" className={styles.btnPrimary} onClick={() => void save()}>
                    Save file
                  </button>
                </div>
                <textarea
                  ref={taRef}
                  className={styles.code}
                  spellCheck={false}
                  value={editorText}
                  onChange={(e) => {
                    setEditorText(e.target.value);
                    setDirty(e.target.value !== originalTextRef.current);
                  }}
                />
              </>
            )}
          </main>
        </div>
        <NewTemplateWizard
          open={wizardOpen}
          onClose={() => setWizardOpen(false)}
          templates={templates}
          onCreate={handleCreate}
        />
      </div>
    </Layout>
  );
}
