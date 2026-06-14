import {useEffect, useMemo, useState, type JSX, type ReactNode} from 'react';
import BrowserOnly from '@docusaurus/BrowserOnly';
import useDocusaurusContext from '@docusaurus/useDocusaurusContext';
import Hint from '../Hint';
import styles from './ProjectGenerator.module.css';
import {
  buildZipFromTemplates,
  loadTemplateCatalog,
  type TemplateCatalog,
} from './fileBasedGenerator';
import {
  type DependencySource,
  type GeneratorOptions,
  type IDE,
  type JdkVendor,
  type Language,
  type Platform,
  stripVersionPrefix,
  validateOptions,
} from './generatorOptions';
import {GRADLE_WRAPPER_JAR_BASE64} from './gradleWrapperJar';
import {GRADLEW_SH, GRADLEW_BAT} from './gradleWrapperScripts';
import JdkSetupGuide from './JdkSetupGuide';


const HINTS = {
  expert:
    "For advanced developers who want more controls over their game's configs and setup.",
  jdk: {
    temurin:
      'Eclipse Temurin (Adoptium). The standard, well-tested HotSpot JVM — recommended option.',
    graalvm:
      "Oracle's GraalVM. Fast JIT, optional native-image AOT. Great if you want short startup times or to bundle a single executable later.",
    corretto:
      "Amazon Corretto. Long-term-supported HotSpot build with security patches from AWS — a safe pick for production servers and CI.",
    zulu:
      'Azul Zulu. Broad coverage of JDK versions, including older LTS releases. Handy when you need to match a legacy environment.',
  },
  gameName:
    "The name shown on the Window title bar when your game is running. Spaces are fine.",
  gameId:
    'A short, lowercase identifier used in Gradle and as the artifact name. Letters, numbers, dashes only.',
  packageName:
    'The Java/Kotlin package your code lives in. Convention: reversed domain, e.g. com.you.game.',
  language: {
    java: 'The classic and standard option.',
    kotlin:
      'Modern, concise JVM language with null safety and great IDE support. Mixes seamlessly with Java.',
  },
  ide: {
    idea:
      'JetBrains IntelliJ IDEA. Generates a run configuration that points at the desktop launcher.',
    eclipse:
      'Eclipse with the Buildship Gradle plugin. Drops a matching `.classpath` and `.project`.',
    vscode:
      'Visual Studio Code with the Java Extension Pack. Adds `launch.json` and `settings.json`.',
    none: 'Skip IDE-specific files. You can always import the Gradle project later.',
  },
  java:
    'The Java source/target version. FlixelGDX requires Java 17 as a minimum — older versions are blocked.',
  flixelVersion:
    'The framework version Gradle will resolve through Maven Central.',
  languageDisabled: 'Pick a template first.',
  templateFallback: 'Starter layouts are loaded from the templates folder on the site.',
  platformsLabel:
    'Pick the launcher modules to scaffold. Android and iOS are coming soon and are currently disabled.',
  heap:
    'Default max heap in megabytes. FlixelGDX games can comfortably run in 16 MB on most hardware.',
  jvmFlags:
    'Extra JVM flags appended to the desktop launcher (e.g. -XX:+UseG1GC, -ea).',
  gradleConfig:
    'Free-form Groovy appended to the bottom of the root build.gradle. Use for repos, plugins, etc.',
  dependencySource:
    'Where Gradle resolves FlixelGDX. Maven Central (default) pulls stable releases; JitPack pulls snapshots or a specific commit/branch.',
  jitpackRef:
    'JitPack only. A commit hash or branch (e.g. master-SNAPSHOT) to resolve instead of the selected release. Leave empty to use the selected version.',
  compositeBuildPath:
    'For framework developers. Absolute path to a local FlixelGDX clone; adds an includeBuild so Gradle builds the framework from source instead of downloading it.',
  platforms: {
    desktop:
      'LWJGL3 desktop launcher (Windows / macOS / Linux). The default and most polished target.',
    web: 'TeaVM browser launcher. Compiles your JVM bytecode to JavaScript for the web.',
    android: 'Android backend — not supported yet. Coming soon.',
    ios: 'iOS backend — not supported yet. Coming soon.',
  },
} as const;

// Oldest release the generator offers. Everything before v0.4.0 (and the old
// `master-SNAPSHOT`) is wire-incompatible with v0.4.0+ and is hidden.
const MIN_SUPPORTED_VERSION = [0, 4, 0] as const;
const FALLBACK_VERSIONS = ['v0.4.0'];

/**
 * True when a release tag is FlixelGDX v0.4.0 or newer. A leading `v` and any
 * prerelease suffix are ignored; non-numeric tags (e.g. `master-SNAPSHOT`) are
 * rejected.
 */
function isSupportedVersion(tag: string): boolean {
  const m = stripVersionPrefix(tag).match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return false;
  const parts = [Number(m[1]), Number(m[2]), Number(m[3])];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] !== MIN_SUPPORTED_VERSION[i]) return parts[i] > MIN_SUPPORTED_VERSION[i];
  }
  return true; // exactly the minimum supported version
}

/**
 * Fetches selectable framework versions from the GitHub releases API, keeping
 * only v0.4.0+. Falls back to {@link FALLBACK_VERSIONS} when the request fails,
 * is rate-limited, or returns no supported releases.
 */
async function fetchVersions(): Promise<string[]> {
  try {
    const res = await fetch(
      'https://api.github.com/repos/flixelgdx/flixelgdx/releases'
    );
    if (!res.ok) throw new Error(`http ${res.status}`);
    const data: Array<{tag_name: string; prerelease: boolean}> = await res.json();
    if (!Array.isArray(data)) throw new Error('empty');
    const supported = data.map((r) => r.tag_name).filter(isSupportedVersion);
    if (supported.length === 0) throw new Error('no supported versions');
    return supported;
  } catch {
    return FALLBACK_VERSIONS;
  }
}

const VENDOR_LABELS: Record<JdkVendor, string> = {
  temurin: 'Eclipse Temurin (Adoptium)',
  graalvm: 'GraalVM Community',
  corretto: 'Amazon Corretto',
  zulu: 'Azul Zulu',
};

/** The hoverable circular `?` badge used next to most form labels. */
function HelpIcon({tip}: {tip: ReactNode}): JSX.Element {
  return (
    <Hint tip={tip}>
      <span className={styles.helpIcon} aria-label="help">
        ?
      </span>
    </Hint>
  );
}

/** A numbered settings section (e.g. "1. Identity"). `title` may include a HelpIcon. */
function Panel({title, children}: {title: ReactNode; children: ReactNode}): JSX.Element {
  return (
    <div className={styles.panel}>
      <h3 className={styles.panelTitle}>{title}</h3>
      {children}
    </div>
  );
}

const DEFAULT_OPTIONS: GeneratorOptions = {
  gameName: 'My Cool Game',
  gameId: 'my-cool-game',
  packageName: 'com.example.mycoolgame',
  language: 'java',
  javaVersion: 17,
  flixelVersion: '',
  ide: 'idea',
  template: '',
  platforms: ['desktop'],
  jdkVendor: 'temurin',
  expert: false,
  heapMb: 16,
  jvmFlags: '',
  gradleConfig: '',
  dependencySource: 'mavenCentral',
  jitpackRef: '',
  compositeBuildPath: '',
};

/** Decodes the base64-embedded Gradle wrapper JAR into raw bytes for the zip. */
function decodeWrapperJar(): Uint8Array {
  const binary = atob(GRADLE_WRAPPER_JAR_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function GeneratorBody(): JSX.Element {
  const {siteConfig} = useDocusaurusContext();
  const baseUrl = siteConfig.baseUrl;
  const [opts, setOpts] = useState<GeneratorOptions>(DEFAULT_OPTIONS);
  const [versions, setVersions] = useState<string[]>(FALLBACK_VERSIONS);
  const [versionPickedByUser, setVersionPickedByUser] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [catalog, setCatalog] = useState<TemplateCatalog | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchVersions().then((v) => {
      if (alive) setVersions(v);
    });
    return () => {
      alive = false;
    };
  }, []);

  // When the version list changes, always snap to the newest unless the user
  // has already made a manual selection that still exists in the new list.
  useEffect(() => {
    if (!versions.length) return;
    setOpts((p) => {
      if (versionPickedByUser && versions.includes(p.flixelVersion)) return p;
      return {...p, flixelVersion: versions[0]};
    });
  }, [versions, versionPickedByUser]);

  useEffect(() => {
    let alive = true;
    loadTemplateCatalog(baseUrl)
      .then((c) => {
        if (!alive) return;
        setCatalog(c);
        setCatalogError(null);
      })
      .catch((e: Error) => {
        if (!alive) return;
        setCatalogError(e.message ?? String(e));
        setCatalog(null);
      });
    return () => {
      alive = false;
    };
  }, [baseUrl]);

  useEffect(() => {
    if (!catalog?.templates.length) return;
    setOpts((p) => {
      if (p.template && catalog.templates.some((t) => t.id === p.template)) return p;
      return {...p, template: catalog.templates[0].id};
    });
  }, [catalog]);

  useEffect(() => {
    if (!catalog) return;
    const t = catalog.templates.find((x) => x.id === opts.template);
    if (!t?.languages.length) return;
    if (!t.languages.includes(opts.language)) {
      setOpts((p) => ({...p, language: t.languages[0] as Language}));
    }
  }, [catalog, opts.template, opts.language]);

  const set = <K extends keyof GeneratorOptions>(k: K, v: GeneratorOptions[K]) =>
    setOpts((prev) => ({...prev, [k]: v}));

  const togglePlatform = (p: Platform) => {
    setOpts((prev) => {
      const has = prev.platforms.includes(p);
      const next = has
        ? prev.platforms.filter((x) => x !== p)
        : [...prev.platforms, p];
      return {...prev, platforms: next};
    });
  };

  const error = useMemo(() => validateOptions(opts), [opts]);

  const selectedTemplate = catalog?.templates.find((t) => t.id === opts.template);

  // Builds the project zip from the selected templates, injects the Gradle
  // wrapper (jar + scripts), triggers the browser download, and reports run
  // hints (or any error) back through the status line.
  async function download() {
    if (error || !catalog) return;
    setStatus('Bundling your project…');
    try {
      const blob = await buildZipFromTemplates(baseUrl, opts, catalog);
      const {default: JSZip} = await import('jszip');
      const {saveAs} = await import('file-saver');
      const zip = new JSZip();
      const outer = await JSZip.loadAsync(blob);
      for (const [relPath, file] of Object.entries(outer.files)) {
        if (file.dir) continue;
        const content = await file.async('uint8array');
        zip.file(relPath, content);
      }
      zip.file('gradle/wrapper/gradle-wrapper.jar', decodeWrapperJar());
      zip.file('gradlew', GRADLEW_SH, {unixPermissions: 0o755});
      zip.file('gradlew.bat', GRADLEW_BAT);
      const outBlob = await zip.generateAsync({type: 'blob', platform: 'UNIX'});
      saveAs(outBlob, `${opts.gameId}.zip`);
      const runHints: string[] = [];
      if (opts.platforms.includes('desktop'))
        runHints.push('./gradlew :lwjgl3:run for desktop');
      if (opts.platforms.includes('web'))
        runHints.push('./gradlew :teavm:run for web');
      setStatus(
        `Downloaded! Unzip then run ${runHints.join('; ')} — Gradle installs the toolchain on first build.`
      );
    } catch (e) {
      setStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return (
    <div className={`${styles.wrap} flx-generator-boundary`}>
      <div>
        {catalogError && (
          <div className={styles.error} role="alert">
            Could not load project templates ({catalogError}). Try refreshing the page.
          </div>
        )}
        <Panel title="1. Identity">
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gameName">
                Game name <HelpIcon tip={HINTS.gameName} />
              </label>
              <input
                id="gameName"
                className={styles.input}
                value={opts.gameName}
                onChange={(e) => set('gameName', e.target.value)}
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="gameId">
                Game id <HelpIcon tip={HINTS.gameId} />
              </label>
              <input
                id="gameId"
                className={styles.input}
                value={opts.gameId}
                onChange={(e) =>
                  set('gameId', e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '-'))
                }
              />
            </div>
          </div>
          <div className={styles.field} style={{marginTop: '1rem'}}>
            <label className={styles.label} htmlFor="pkg">
              Package name <HelpIcon tip={HINTS.packageName} />
            </label>
            <input
              id="pkg"
              className={styles.input}
              value={opts.packageName}
              onChange={(e) => set('packageName', e.target.value.toLowerCase())}
            />
          </div>
        </Panel>

        <Panel title="2. Language & runtime">
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>
                Language{' '}
                <HelpIcon
                  tip={
                    selectedTemplate
                      ? HINTS.language[opts.language]
                      : HINTS.languageDisabled
                  }
                />
              </label>
              <select
                className={styles.select}
                value={opts.language}
                onChange={(e) => set('language', e.target.value as Language)}
                disabled={!selectedTemplate}
              >
                {(selectedTemplate?.languages ?? ['java', 'kotlin']).map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === 'java' ? 'Java' : 'Kotlin'}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                Java version <HelpIcon tip={HINTS.java} />
              </label>
              <select
                className={styles.select}
                value={opts.javaVersion}
                onChange={(e) => set('javaVersion', parseInt(e.target.value, 10))}
              >
                {[17, 21, 22, 23].map((v) => (
                  <option key={v} value={v}>{`Java ${v}`}</option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.row} style={{marginTop: '1rem'}}>
            <div className={styles.field}>
              <label className={styles.label}>
                FlixelGDX version{' '}
                <HelpIcon tip={HINTS.flixelVersion} />
              </label>
              <select
                className={styles.select}
                value={opts.flixelVersion}
                onChange={(e) => { set('flixelVersion', e.target.value); setVersionPickedByUser(true); }}
              >
                {versions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label className={styles.label}>
                IDE{' '}
                <HelpIcon tip={HINTS.ide[opts.ide]} />
              </label>
              <select
                className={styles.select}
                value={opts.ide}
                onChange={(e) => set('ide', e.target.value as IDE)}
              >
                <option value="idea">IntelliJ IDEA</option>
                <option value="eclipse">Eclipse</option>
                <option value="vscode">VS Code</option>
                <option value="none">Skip IDE files</option>
              </select>
            </div>
          </div>
          <div className={styles.field} style={{marginTop: '1rem'}}>
            <label className={styles.label}>
              JDK vendor{' '}
              <HelpIcon tip={HINTS.jdk[opts.jdkVendor]} />
              {opts.jdkVendor === 'temurin' && (
                <span className={styles.recommend} title="Recommended for FlixelGDX">
                  Recommended
                </span>
              )}
            </label>
            <select
              className={styles.select}
              value={opts.jdkVendor}
              onChange={(e) => set('jdkVendor', e.target.value as JdkVendor)}
            >
              <option value="temurin">Eclipse Temurin (Adoptium) — standard HotSpot</option>
              <option value="graalvm">GraalVM Community — fast startup, AOT-ready</option>
              <option value="corretto">Amazon Corretto — LTS HotSpot</option>
              <option value="zulu">Azul Zulu — broad version coverage</option>
            </select>
          </div>
          <div className={styles.subnote} style={{marginTop: '0.75rem'}}>
            Gradle will auto-download a matching JDK on first build using the
            Foojay Toolchains Resolver — you only need a Gradle-compatible
            bootstrap JDK on PATH (any modern JDK 8+ works).
          </div>
        </Panel>

        <Panel title="3. Template & platforms">
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>
                Template{' '}
                <HelpIcon
                  tip={selectedTemplate?.description ?? HINTS.templateFallback}
                />
              </label>
              <select
                className={styles.select}
                value={opts.template}
                onChange={(e) => set('template', e.target.value)}
                disabled={!catalog?.templates.length}
              >
                {(catalog?.templates ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className={styles.field} style={{marginTop: '1rem'}}>
            <span className={styles.label}>
              Platforms{' '}
              <HelpIcon tip={HINTS.platformsLabel} />
            </span>
            <div className={styles.checks}>
              {(
                [
                  {id: 'desktop', label: 'Desktop (LWJGL3)', disabled: false},
                  {id: 'web', label: 'Web (TeaVM)', disabled: false},
                  {id: 'android', label: 'Android — coming soon', disabled: true},
                  {id: 'ios', label: 'iOS — coming soon', disabled: true},
                ] as const
              ).map((p) => (
                <Hint key={p.id} tip={HINTS.platforms[p.id]}>
                  <label
                    className={`${styles.check} ${p.disabled ? styles.disabled : ''}`}
                  >
                    <input
                      type="checkbox"
                      disabled={p.disabled}
                      checked={opts.platforms.includes(p.id as Platform)}
                      onChange={() => togglePlatform(p.id as Platform)}
                    />
                    {p.label}
                  </label>
                </Hint>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="4. JDK setup">
          <p style={{margin: '0 0 0.5rem', fontSize: '0.9rem', color: 'var(--flx-text-muted)'}}>
            Pick your operating system to see step-by-step instructions for
            installing the JDK you chose above. The generated project's Gradle
            wrapper can then auto-download the matching toolchain on first run.
          </p>
          <JdkSetupGuide vendor={opts.jdkVendor} vendorLabel={VENDOR_LABELS[opts.jdkVendor]} />
        </Panel>

        <Panel title={<>5. Expert mode <HelpIcon tip={HINTS.expert} /></>}>
          <label className={styles.toggle}>
            <input
              type="checkbox"
              checked={opts.expert}
              onChange={(e) => set('expert', e.target.checked)}
            />
            Enable expert mode
          </label>
          {opts.expert && (
            <>
              <div className={styles.expertNote}>
                Power-user knobs. Anything you put here lands verbatim in the
                generated build files.
              </div>
              <div className={styles.field} style={{marginTop: '1rem'}}>
                <label className={styles.label}>
                  Dependency source <HelpIcon tip={HINTS.dependencySource} />
                </label>
                <select
                  className={styles.select}
                  value={opts.dependencySource}
                  onChange={(e) => set('dependencySource', e.target.value as DependencySource)}
                >
                  <option value="mavenCentral">Maven Central — stable releases (default)</option>
                  <option value="jitpack">JitPack — snapshots / specific commit or branch</option>
                </select>
              </div>
              {opts.dependencySource === 'jitpack' && (
                <div className={styles.field} style={{marginTop: '1rem'}}>
                  <label className={styles.label}>
                    JitPack commit or branch <HelpIcon tip={HINTS.jitpackRef} />
                  </label>
                  <input
                    className={styles.input}
                    placeholder="e.g. master-SNAPSHOT or a commit hash"
                    value={opts.jitpackRef}
                    onChange={(e) => set('jitpackRef', e.target.value)}
                  />
                </div>
              )}
              <div className={styles.field} style={{marginTop: '1rem'}}>
                <label className={styles.label}>
                  Composite build path <HelpIcon tip={HINTS.compositeBuildPath} />
                </label>
                <input
                  className={styles.input}
                  placeholder="/path/to/flixelgdx (leave empty for none)"
                  value={opts.compositeBuildPath}
                  onChange={(e) => set('compositeBuildPath', e.target.value)}
                />
              </div>
              <div className={styles.row} style={{marginTop: '1rem'}}>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Default heap (MB){' '}
                    <HelpIcon tip={HINTS.heap} />
                  </label>
                  <input
                    className={styles.input}
                    type="number"
                    min={8}
                    max={4096}
                    value={opts.heapMb}
                    onChange={(e) => set('heapMb', parseInt(e.target.value || '16', 10))}
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>
                    Extra JVM flags{' '}
                    <HelpIcon tip={HINTS.jvmFlags} />
                  </label>
                  <input
                    className={styles.input}
                    placeholder="-XX:+UseG1GC -ea"
                    value={opts.jvmFlags}
                    onChange={(e) => set('jvmFlags', e.target.value)}
                  />
                </div>
              </div>
              <div className={styles.field} style={{marginTop: '1rem'}}>
                <label className={styles.label}>
                  Extra Gradle config (appended to root build.gradle){' '}
                  <HelpIcon tip={HINTS.gradleConfig} />
                </label>
                <textarea
                  className={styles.textarea}
                  spellCheck={false}
                  value={opts.gradleConfig}
                  onChange={(e) => set('gradleConfig', e.target.value)}
                  placeholder={`subprojects { tasks.withType(JavaCompile) { options.compilerArgs += '-parameters' } }`}
                />
              </div>
            </>
          )}
        </Panel>
      </div>

      <aside className={styles.summary}>
        <h4>Summary</h4>
        <dl>
          <dt>Name</dt>
          <dd>{opts.gameName}</dd>
          <dt>Id</dt>
          <dd>{opts.gameId}</dd>
          <dt>Package</dt>
          <dd>{opts.packageName}</dd>
          <dt>Lang</dt>
          <dd>{opts.language}</dd>
          <dt>Java</dt>
          <dd>{opts.javaVersion}</dd>
          <dt>JDK</dt>
          <dd>{VENDOR_LABELS[opts.jdkVendor]}</dd>
          <dt>Flixel</dt>
          <dd>{opts.flixelVersion}</dd>
          <dt>Source</dt>
          <dd>{opts.expert && opts.dependencySource === 'jitpack' ? 'JitPack' : 'Maven Central'}</dd>
          <dt>Template</dt>
          <dd>{selectedTemplate?.name || opts.template || '—'}</dd>
          <dt>IDE</dt>
          <dd>{opts.ide}</dd>
          <dt>Heap</dt>
          <dd>{opts.heapMb} MB</dd>
          <dt>Platforms</dt>
          <dd>{opts.platforms.join(', ') || '—'}</dd>
        </dl>
        <button
          className="flx-btn flx-btn--primary"
          disabled={!!error || !catalog || !!catalogError}
          onClick={download}
        >
          Download project
        </button>
        {error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <div className={styles.status}>{status}</div>
        )}
      </aside>
    </div>
  );
}

export default function ProjectGenerator(): JSX.Element {
  return (
    <BrowserOnly fallback={<div>Loading project generator…</div>}>
      {() => <GeneratorBody />}
    </BrowserOnly>
  );
}
