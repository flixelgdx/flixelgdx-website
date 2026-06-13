import type {DependencySource, GeneratorOptions, IDE, Language, Platform} from './generatorOptions';
import {
  escDoubleQuotedJvm,
  escDoubleQuotedKotlin,
  flixelGroup,
  gradleVendorSpec,
  stripVersionPrefix,
} from './generatorOptions';

export type CatalogFileEntry = {
  path: string;
  fetch: string;
};

export type CatalogTemplate = {
  id: string;
  name: string;
  description: string;
  languages: string[];
  variables: string[];
  files: Record<string, CatalogFileEntry[]>;
};

export type TemplateCatalog = {
  version: number;
  templates: CatalogTemplate[];
};

function joinUrl(baseUrl: string, rel: string): string {
  const b = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  const r = rel.startsWith('/') ? rel.slice(1) : rel;
  return `${b}/${r}`;
}

async function fetchText(baseUrl: string, rel: string): Promise<string> {
  const res = await fetch(joinUrl(baseUrl, rel));
  if (!res.ok) throw new Error(`Failed to load ${rel}: ${res.status}`);
  return res.text();
}

async function fetchJson<T>(baseUrl: string, rel: string): Promise<T> {
  const res = await fetch(joinUrl(baseUrl, rel));
  if (!res.ok) throw new Error(`Failed to load ${rel}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadTemplateCatalog(baseUrl: string): Promise<TemplateCatalog> {
  return fetchJson<TemplateCatalog>(baseUrl, 'templates/catalog.json');
}

function substitute(text: string, map: Record<string, string>): string {
  return text.replace(/\{\{([A-Z0-9_]+)\}\}/g, (_, key: string) =>
    Object.prototype.hasOwnProperty.call(map, key) ? map[key]! : `{{${key}}}`
  );
}

function sanitizePackage(pkg: string): string {
  return pkg.replace(/[^A-Za-z0-9_.]/g, '_');
}

function shouldIncludePath(relPath: string, o: GeneratorOptions): boolean {
  const norm = relPath.replace(/\\/g, '/');
  if (norm.startsWith('lwjgl3/') && !o.platforms.includes('desktop')) return false;
  if (norm.startsWith('teavm/') && !o.platforms.includes('web')) return false;
  if (norm.startsWith('.idea/') && o.ide !== 'idea') return false;
  if (norm === '.idea/runConfigurations/Run_Desktop.xml' && !o.platforms.includes('desktop'))
    return false;
  if (norm.startsWith('.vscode/') && o.ide !== 'vscode') return false;
  if ((norm === '.classpath' || norm === '.project') && o.ide !== 'eclipse') return false;
  return true;
}

function settingsSubprojectIncludes(platforms: Platform[]): string {
  const subs: string[] = ['core'];
  if (platforms.includes('desktop')) subs.push('lwjgl3');
  if (platforms.includes('web')) subs.push('teavm');
  return subs.map((s) => `include "${s}"`).join('\n') + '\n';
}

function desktopConvenienceTask(platforms: Platform[]): string {
  if (!platforms.includes('desktop')) return '';
  return [
    '',
    '// Convenience task name used in many LibGDX and FlixelGDX examples (same as :lwjgl3:run).',
    `tasks.register('lwjgl3Run') {`,
    `  group = 'application'`,
    `  description = 'Runs the LWJGL3 desktop game (alias for :lwjgl3:run).'`,
    `  dependsOn ':lwjgl3:run'`,
    `}`,
    '',
  ].join('\n');
}

function kotlinGradleProperties(lang: Language): string {
  if (lang !== 'kotlin') return '';
  return [
    '',
    '# KTX version (Kotlin extensions for libGDX).',
    '# Check https://github.com/libktx/ktx/releases for the latest version matching your gdxVersion.',
    'ktxVersion=1.13.1-rc1',
    '',
  ].join('\n');
}

function webGradleProperties(platforms: Platform[]): string {
  if (!platforms.includes('web')) return '';
  return [
    '',
    '# Reflection metadata scope for TeaVM (see COMPILING.md in flixelgdx/flixelgdx).',
    'flixelReflectionProfile=STANDARD',
    '',
  ].join('\n');
}

function eclipseClasspathEntries(o: GeneratorOptions): string {
  const sub = o.language === 'kotlin' ? 'kotlin' : 'java';
  let lines = `  <classpathentry kind="src" path="core/src/main/${sub}"/>\n`;
  if (o.platforms.includes('desktop')) {
    lines += `  <classpathentry kind="src" path="lwjgl3/src/main/${sub}"/>\n`;
  }
  if (o.platforms.includes('web')) {
    lines += `  <classpathentry kind="src" path="teavm/src/main/${sub}"/>\n`;
  }
  return lines;
}

function vscodeLaunchConfigsJson(o: GeneratorOptions, mainClass: string): string {
  if (!o.platforms.includes('desktop')) return '[]';
  return JSON.stringify(
    [
      {
        type: 'java',
        name: 'Run Desktop',
        request: 'launch',
        mainClass,
        projectName: 'lwjgl3',
        vmArgs: `-Xmx${o.heapMb}m`,
      },
    ],
    null,
    2
  );
}

// The FlixelGDX plugin version is always the literal Gradle property reference
// `version "${flixelVersion}"`, NOT the resolved number. This keeps the version
// in a single place (gradle.properties) so upgrades are a one-line change. The
// `\${...}` escape emits the property reference verbatim into the build script
// rather than interpolating it here in JavaScript.
const FLIXEL_LOGGING_PLUGIN = `id 'org.flixelgdx.logging' version "\${flixelVersion}"`;

function lwjgl3PluginsBlock(lang: Language): string {
  if (lang === 'kotlin') {
    return `id 'org.jetbrains.kotlin.jvm'
  id 'application'
  id 'org.graalvm.buildtools.native'
  id 'io.github.fourlastor.construo'
  ${FLIXEL_LOGGING_PLUGIN}`;
  }
  return `id 'application'
  id 'org.graalvm.buildtools.native'
  id 'io.github.fourlastor.construo'
  ${FLIXEL_LOGGING_PLUGIN}`;
}

function teavmPluginsBlock(lang: Language): string {
  if (lang === 'kotlin') {
    return `id 'org.jetbrains.kotlin.jvm'
  id 'java-library'
  ${FLIXEL_LOGGING_PLUGIN}`;
  }
  return `id 'java-library'
  ${FLIXEL_LOGGING_PLUGIN}`;
}

function teavmLangDeps(lang: Language): string {
  if (lang === 'kotlin') {
    return '\n  implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.24"';
  }
  return '';
}

function jvmArgString(o: GeneratorOptions): string {
  const baseFlags = `-Xms${Math.max(8, Math.floor(o.heapMb / 2))}m -Xmx${o.heapMb}m`;
  const userFlags = o.expert && o.jvmFlags.trim() ? ` ${o.jvmFlags.trim()}` : '';
  return `${baseFlags}${userFlags}`;
}

// --- Repository / dependency-source wiring --------------------------------

// resolutionStrategy that maps the org.flixelgdx.* plugin IDs onto their JitPack
// modules. JitPack rewrites group coordinates and drops the plugin marker
// artifacts, so the plugin IDs cannot resolve on their own there.
const JITPACK_PLUGIN_RESOLUTION = `  resolutionStrategy {
    eachPlugin {
      switch (requested.id.id) {
        case 'org.flixelgdx.teavm':
          useModule('com.github.flixelgdx.flixelgdx:flixelgdx-teavm-plugin:' + requested.version.toString())
          break
        case 'org.flixelgdx.logging':
          useModule('com.github.flixelgdx.flixelgdx:flixelgdx-logging-plugin:' + requested.version.toString())
          break
        default:
          break
      }
    }
  }
`;

// JitPack repository for the root build.gradle, restricted to FlixelGDX artifacts.
// The doubled backslashes are intentional: Groovy unescapes them to single
// backslashes so includeGroupByRegex receives `com\.github\..*`.
const JITPACK_PROJECT_REPO = `    maven {
      url 'https://jitpack.io'
      // Restrict JitPack to FlixelGDX artifacts. io.github.berstanio
      // (gdx-svmhelper 2.0.1+) lives on Maven Central, not JitPack; without
      // this filter Gradle tries JitPack first and gets a 401 for it.
      content {
        includeGroupByRegex 'com\\\\.github\\\\..*'
        includeGroupByRegex 'io\\\\.github\\\\.flixelgdx.*'
      }
    }`;

/** Repositories for the settings.gradle `pluginManagement` block. */
function pluginRepositories(source: DependencySource): string {
  const lines = ['    mavenLocal()', '    mavenCentral()'];
  if (source === 'jitpack') lines.push("    maven { url 'https://jitpack.io' }");
  lines.push('    gradlePluginPortal()');
  return lines.join('\n');
}

/**
 * resolutionStrategy block for the plugin IDs. Maven Central ships proper plugin
 * markers and needs none, so this is empty there; JitPack needs the mapping.
 */
function pluginResolutionStrategy(source: DependencySource): string {
  return source === 'jitpack' ? JITPACK_PLUGIN_RESOLUTION : '';
}

/** Repositories for the root build.gradle `allprojects` block. */
function projectRepositories(source: DependencySource): string {
  const lines = ['    mavenCentral()', '    google()'];
  if (source === 'jitpack') lines.push(JITPACK_PROJECT_REPO);
  return lines.join('\n');
}

/** Single `includeBuild '<path>'` line for a Gradle composite build, or empty. */
function compositeIncludeBuild(path: string): string {
  const clean = path.trim();
  if (!clean) return '';
  // Forward slashes work on every OS (Windows included); escape single quotes.
  const normalized = clean.replace(/\\/g, '/').replace(/'/g, "\\'");
  return `includeBuild '${normalized}'\n`;
}

/** README note explaining how the chosen source resolves the Gradle plugins. */
function readmePluginNote(source: DependencySource): string {
  if (source === 'jitpack') {
    return [
      'FlixelGDX publishes its Gradle plugins to JitPack under coordinates like',
      '`com.github.flixelgdx.flixelgdx:flixelgdx-teavm-plugin:<version>`. JitPack does',
      'not publish plugin marker artifacts, so the generated `settings.gradle` maps the',
      '`org.flixelgdx.*` plugin IDs to their JitPack modules via `resolutionStrategy`.',
    ].join('\n');
  }
  return [
    'FlixelGDX publishes its Gradle plugins to Maven Central with proper plugin markers,',
    'so `settings.gradle` applies them directly by ID and version. If a plugin fails to',
    'resolve, confirm `mavenCentral()` is present in the `pluginManagement` repositories.',
  ].join('\n');
}

function readmeLayoutLines(o: GeneratorOptions): string {
  const lines: string[] = [];
  if (o.platforms.includes('desktop')) {
    lines.push('    lwjgl3/       desktop launcher (LWJGL3 / OpenGL)');
  }
  if (o.platforms.includes('web')) {
    lines.push('    teavm/        browser launcher (TeaVM)');
  }
  return lines.length ? lines.map((l) => `${l}\n`).join('') : '';
}

async function buildReadmeSections(
  baseUrl: string,
  o: GeneratorOptions,
  templateLabel: string
): Promise<Record<string, string>> {
  const [jdkBody, ideBody, jdkLabels, ideLabels] = await Promise.all([
    fetchText(baseUrl, `template-fragments/readme/jdk/${o.jdkVendor}.md`),
    fetchText(baseUrl, `template-fragments/readme/ide/${o.ide}.md`),
    fetchJson<Record<string, string>>(baseUrl, 'template-fragments/readme/jdk-labels.json'),
    fetchJson<Record<string, string>>(baseUrl, 'template-fragments/readme/ide-labels.json'),
  ]);

  const runParts: string[] = [];
  if (o.platforms.includes('desktop')) {
    runParts.push(await fetchText(baseUrl, 'template-fragments/readme/run/desktop.md'));
  }
  if (o.platforms.includes('web')) {
    runParts.push(await fetchText(baseUrl, 'template-fragments/readme/run/web.md'));
  }
  if (o.platforms.includes('desktop')) {
    runParts.push(
      await fetchText(baseUrl, 'template-fragments/readme/run/desktop-extras.md')
    );
  }

  return {
    JDK_README_BODY: jdkBody.trimEnd(),
    IDE_README_BODY: ideBody.trimEnd() + '\n',
    RUN_README_BODY: runParts.join('\n'),
    JDK_VENDOR_LABEL: jdkLabels[o.jdkVendor] ?? o.jdkVendor,
    IDE_LABEL: ideLabels[o.ide] ?? o.ide,
    TEMPLATE_LABEL: templateLabel,
    README_LAYOUT_MODULE_LINES: readmeLayoutLines(o),
  };
}

export async function buildSubstitutionMap(
  baseUrl: string,
  o: GeneratorOptions,
  templateMeta: CatalogTemplate
): Promise<Record<string, string>> {
  const pkg = sanitizePackage(o.packageName);
  const pkgPath = pkg.replace(/\./g, '/');
  const game = o.gameName.replace(/\s+/g, '');
  const mainLm = `${pkg}.lwjgl3.${game}Lwjgl3Launcher`;
  const ideaMain = o.language === 'kotlin' ? `${mainLm}Kt` : mainLm;
  const teavmMain =
    o.language === 'kotlin' ? `${pkg}.teavm.${game}TeaVMLauncherKt` : `${pkg}.teavm.${game}TeaVMLauncher`;
  const jsBundle = `${o.gameId.replace(/[^a-z0-9_-]/gi, '-')}.js`;
  const nativeImageName = o.gameId.replace(/[^A-Za-z0-9._-]/g, '-');
  const expertGradle =
    o.expert && o.gradleConfig.trim()
      ? `\n/* ----------- expert mode: custom gradle config ----------- */\n${o.gradleConfig}\n`
      : '';

  // Source-related knobs only apply in expert mode; otherwise everything
  // defaults to the clean Maven Central setup.
  const source: DependencySource = o.expert ? o.dependencySource : 'mavenCentral';
  const jitpackRef = o.expert ? o.jitpackRef.trim() : '';
  const compositePath = o.expert ? o.compositeBuildPath : '';
  const sourceLabel = source === 'jitpack' ? 'JitPack' : 'Maven Central';
  // A JitPack commit/branch overrides the selected release; otherwise use the
  // selected version with any leading `v` stripped so coordinates resolve.
  const resolvedVersion =
    source === 'jitpack' && jitpackRef ? jitpackRef : stripVersionPrefix(o.flixelVersion);

  const readme = await buildReadmeSections(baseUrl, o, templateMeta.name);

  const map: Record<string, string> = {
    GAME: game,
    PACKAGE: pkg,
    PACKAGE_PATH: pkgPath,
    GAME_ID: o.gameId,
    GAME_NAME: o.gameName,
    GAME_NAME_ESC_JAVA: escDoubleQuotedJvm(o.gameName),
    GAME_NAME_ESC_KOTLIN: escDoubleQuotedKotlin(o.gameName),
    ROOT_PROJECT_NAME: o.gameId,
    PACKAGE_NAME: pkg,
    JAVA_VERSION: String(o.javaVersion),
    FLIXEL_VERSION: resolvedVersion,
    FLIXEL_GROUP: flixelGroup(source),
    FLIXEL_SOURCE_LABEL: sourceLabel,
    PLUGIN_REPOSITORIES: pluginRepositories(source),
    PLUGIN_RESOLUTION_STRATEGY: pluginResolutionStrategy(source),
    PROJECT_REPOSITORIES: projectRepositories(source),
    COMPOSITE_INCLUDE_BUILD: compositeIncludeBuild(compositePath),
    README_PLUGIN_NOTE: readmePluginNote(source),
    JDK_VENDOR_SPEC: gradleVendorSpec(o.jdkVendor),
    HEAP_MB: String(o.heapMb),
    SETTINGS_SUBPROJECT_INCLUDES: settingsSubprojectIncludes(o.platforms),
    DESKTOP_CONVENIENCE_TASK: desktopConvenienceTask(o.platforms),
    WEB_GRADLE_PROPERTIES: webGradleProperties(o.platforms),
    KOTLIN_GRADLE_PROPERTIES: kotlinGradleProperties(o.language),
    GRADLE_EXPERT_APPEND: expertGradle,
    LWJGL3_MAIN_CLASS: `${pkg}.lwjgl3.${game}Lwjgl3Launcher${o.language === 'kotlin' ? 'Kt' : ''}`,
    TEAVM_MAIN_CLASS: teavmMain,
    TEAVM_JS_BUNDLE: jsBundle,
    JVM_ARG_STRING: jvmArgString(o),
    NATIVE_IMAGE_NAME: nativeImageName,
    CONSTRUO_IDENTIFIER: `${pkg}.desktop`,
    LWJGL3_PLUGINS: lwjgl3PluginsBlock(o.language),
    TEAVM_PLUGINS: teavmPluginsBlock(o.language),
    TEAVM_LANG_DEPS: teavmLangDeps(o.language),
    IDEA_MAIN_CLASS: ideaMain,
    ECLIPSE_CLASSPATH_ENTRIES: eclipseClasspathEntries(o),
    VSCODE_LAUNCH_CONFIGS: vscodeLaunchConfigsJson(o, ideaMain),
    LANGUAGE: o.language,
    PLATFORMS_CSV: o.platforms.join(', '),
    ...readme,
  };

  return map;
}

export async function buildZipFromTemplates(
  baseUrl: string,
  o: GeneratorOptions,
  catalog: TemplateCatalog
): Promise<Blob> {
  const templateMeta = catalog.templates.find((t) => t.id === o.template);
  if (!templateMeta) throw new Error(`Unknown template: ${o.template}`);
  const lang = o.language;
  const files = templateMeta.files[lang];
  if (!files?.length) {
    throw new Error(`No files for template ${o.template} / language ${lang}`);
  }

  const map = await buildSubstitutionMap(baseUrl, o, templateMeta);
  const {default: JSZip} = await import('jszip');

  const zip = new JSZip();
  for (const entry of files) {
    if (!shouldIncludePath(entry.path, o)) continue;
    // Fetch paths must stay literal: static files are stored as e.g.
    // `.../{{GAME}}.java` on disk. Substituting `entry.fetch` would request
    // the wrong URL and often return the SPA shell (HTML/JS) instead of sources.
    const raw = await fetchText(baseUrl, entry.fetch);
    const outPath = substitute(entry.path, map);
    const contents = substitute(raw, map);
    zip.file(outPath, contents);
  }

  return zip.generateAsync({type: 'blob', platform: 'UNIX'});
}
