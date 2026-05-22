import type {GeneratorOptions, IDE, Language, Platform} from './generatorOptions';
import {
  escDoubleQuotedJvm,
  escDoubleQuotedKotlin,
  gradleVendorSpec,
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
  const sub = o.language === 'kotlin' ? 'kotlin' : o.language === 'groovy' ? 'groovy' : 'java';
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

function lwjgl3PluginsBlock(lang: Language): string {
  if (lang === 'kotlin') {
    return `id 'org.jetbrains.kotlin.jvm'
  id 'application'
  id 'org.graalvm.buildtools.native'
  id 'io.github.fourlastor.construo'`;
  }
  if (lang === 'groovy') {
    return `id 'groovy'
  id 'application'
  id 'org.graalvm.buildtools.native'
  id 'io.github.fourlastor.construo'`;
  }
  return `id 'application'
  id 'org.graalvm.buildtools.native'
  id 'io.github.fourlastor.construo'`;
}

function teavmPluginsBlock(lang: Language): string {
  if (lang === 'kotlin') {
    return `id 'org.jetbrains.kotlin.jvm'
  id 'java-library'`;
  }
  if (lang === 'groovy') {
    return `id 'groovy'
  id 'java-library'`;
  }
  return `id 'java-library'`;
}

function teavmLangDeps(lang: Language): string {
  if (lang === 'groovy') {
    return '\n  implementation "org.codehaus.groovy:groovy-all:3.0.21"';
  }
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
    FLIXEL_VERSION: o.flixelVersion,
    JDK_VENDOR_SPEC: gradleVendorSpec(o.jdkVendor),
    HEAP_MB: String(o.heapMb),
    SETTINGS_SUBPROJECT_INCLUDES: settingsSubprojectIncludes(o.platforms),
    DESKTOP_CONVENIENCE_TASK: desktopConvenienceTask(o.platforms),
    WEB_GRADLE_PROPERTIES: webGradleProperties(o.platforms),
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
