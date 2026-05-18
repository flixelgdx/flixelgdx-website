import {useEffect, useState} from 'react';
import type {TemplateListEntry} from './types';
import {slugFromName, TagInput} from './ManifestForm';
import styles from './TemplateEditor.module.css';

export interface WizardPayload {
  id: string;
  name: string;
  description: string;
  languages: string[];
  variables: string[];
  mode: 'blank' | 'copy';
  sourceId?: string;
}

interface NewTemplateWizardProps {
  open: boolean;
  onClose: () => void;
  templates: TemplateListEntry[];
  onCreate: (payload: WizardPayload) => Promise<void>;
}

const DEFAULT_VARS = ['GAME', 'PACKAGE', 'PACKAGE_PATH'];

export function NewTemplateWizard({open, onClose, templates, onCreate}: NewTemplateWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [id, setId] = useState('');
  const [idTouched, setIdTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [languages, setLanguages] = useState<string[]>(['java', 'kotlin', 'groovy']);
  const [variables, setVariables] = useState<string[]>(DEFAULT_VARS);
  const [mode, setMode] = useState<'blank' | 'copy'>('blank');
  const [sourceId, setSourceId] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selectableSources = templates.filter((t) => !t.isCommon);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setName('');
    setId('');
    setIdTouched(false);
    setDescription('');
    setLanguages(['java', 'kotlin', 'groovy']);
    setVariables([...DEFAULT_VARS]);
    setMode('blank');
    setSourceId(templates.filter((t) => !t.isCommon)[0]?.id ?? '');
    setErr(null);
    setBusy(false);
  }, [open]);

  if (!open) return null;

  function close() {
    onClose();
  }

  function syncIdFromName(n: string) {
    if (!idTouched) setId(slugFromName(n));
  }

  const previewLines: string[] = [];
  previewLines.push(`${id}/template.json`);
  previewLines.push(`${id}/common/`);
  for (const lang of languages) {
    previewLines.push(`${id}/${lang}/`);
  }
  if (mode === 'copy' && sourceId) {
    previewLines.push(`(plus all files copied from ${sourceId}, then template.json overwritten)`);
  }

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      await onCreate({
        id,
        name,
        description,
        languages,
        variables,
        mode,
        sourceId: mode === 'copy' ? sourceId : undefined,
      });
      close();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wizardOverlay} role="dialog" aria-modal="true">
      <div className={styles.wizard}>
        <header className={styles.wizardHeader}>
          <h2>New template</h2>
          <button type="button" className={styles.btnGhost} onClick={close}>
            Close
          </button>
        </header>
        <div className={styles.wizardSteps}>Step {step} of 3</div>
        {err && <div className={styles.error}>{err}</div>}
        {step === 1 && (
          <div className={styles.wizardBody}>
            <label className={styles.field}>
              <span>name</span>
              <input
                className={styles.input}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  syncIdFromName(e.target.value);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>id (slug)</span>
              <input
                className={styles.input}
                value={id}
                onChange={(e) => {
                  setIdTouched(true);
                  setId(e.target.value);
                }}
              />
            </label>
            <label className={styles.field}>
              <span>description</span>
              <textarea
                className={styles.textarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <fieldset className={styles.fieldset}>
              <legend>languages</legend>
              {(['java', 'kotlin', 'groovy'] as const).map((lang) => (
                <label key={lang} className={styles.check}>
                  <input
                    type="checkbox"
                    checked={languages.includes(lang)}
                    onChange={(e) => {
                      setLanguages(
                        e.target.checked
                          ? [...languages, lang]
                          : languages.filter((l) => l !== lang)
                      );
                    }}
                  />
                  {lang}
                </label>
              ))}
            </fieldset>
            <label className={styles.field}>
              <span>variables</span>
              <TagInput values={variables} onChange={setVariables} />
            </label>
            <div className={styles.wizardNav}>
              <button type="button" className={styles.btnPrimary} onClick={() => setStep(2)}>
                Next
              </button>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className={styles.wizardBody}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="start"
                checked={mode === 'blank'}
                onChange={() => setMode('blank')}
              />
              Blank — empty folder scaffold (language roots + common)
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="start"
                checked={mode === 'copy'}
                onChange={() => setMode('copy')}
              />
              Copy from existing template
            </label>
            {mode === 'copy' && (
              <select
                className={styles.select}
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
              >
                {selectableSources.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.manifest?.name ?? t.id}
                  </option>
                ))}
              </select>
            )}
            <div className={styles.wizardNav}>
              <button type="button" className={styles.btn} onClick={() => setStep(1)}>
                Back
              </button>
              <button type="button" className={styles.btnPrimary} onClick={() => setStep(3)}>
                Next
              </button>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className={styles.wizardBody}>
            <p className={styles.previewTitle}>Preview</p>
            <pre className={styles.preview}>{previewLines.join('\n')}</pre>
            <div className={styles.wizardNav}>
              <button type="button" className={styles.btn} onClick={() => setStep(2)}>
                Back
              </button>
              <button
                type="button"
                className={styles.btnPrimary}
                disabled={busy || !id.trim()}
                onClick={() => void submit()}
              >
                Create
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
