import {useState, type JSX} from 'react';
import type {TemplateManifest} from './types';
import styles from './TemplateEditor.module.css';

export function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}

type TagInputProps = {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
};

export function TagInput({values, onChange, placeholder}: TagInputProps): JSX.Element {
  const [draft, setDraft] = useState('');

  function add() {
    const t = draft.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '');
    if (!t || values.includes(t)) {
      setDraft('');
      return;
    }
    onChange([...values, t]);
    setDraft('');
  }

  return (
    <div className={styles.tagInput}>
      <div className={styles.tags}>
        {values.map((v) => (
          <span key={v} className={styles.tag}>
            {v}
            <button
              type="button"
              className={styles.tagRemove}
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}
      </div>
      <div className={styles.tagRow}>
        <input
          className={styles.input}
          value={draft}
          placeholder={placeholder ?? 'VARIABLE_NAME'}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className={styles.btn} onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}

type ManifestFormProps = {
  manifest: TemplateManifest;
  onManifestChange: (m: TemplateManifest) => void;
};

export function ManifestForm({manifest, onManifestChange}: ManifestFormProps): JSX.Element {
  return (
    <div className={styles.manifestForm}>
      <label className={styles.field}>
        <span>id</span>
        <input
          className={styles.input}
          value={manifest.id}
          onChange={(e) => onManifestChange({...manifest, id: e.target.value})}
        />
      </label>
      <label className={styles.field}>
        <span>name</span>
        <input
          className={styles.input}
          value={manifest.name}
          onChange={(e) => onManifestChange({...manifest, name: e.target.value})}
        />
      </label>
      <label className={styles.field}>
        <span>description</span>
        <textarea
          className={styles.textarea}
          value={manifest.description}
          onChange={(e) => onManifestChange({...manifest, description: e.target.value})}
        />
      </label>
      <fieldset className={styles.fieldset}>
        <legend>languages</legend>
        {(['java', 'kotlin'] as const).map((lang) => (
          <label key={lang} className={styles.check}>
            <input
              type="checkbox"
              checked={manifest.languages.includes(lang)}
              onChange={(e) => {
                const next = e.target.checked
                  ? [...manifest.languages, lang]
                  : manifest.languages.filter((l) => l !== lang);
                onManifestChange({...manifest, languages: next});
              }}
            />
            {lang}
          </label>
        ))}
      </fieldset>
      <label className={styles.field}>
        <span>variables</span>
        <TagInput
          values={manifest.variables}
          onChange={(variables) => onManifestChange({...manifest, variables})}
        />
      </label>
    </div>
  );
}
