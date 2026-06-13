export type Language = 'java' | 'kotlin';
export type IDE = 'idea' | 'eclipse' | 'vscode' | 'none';
export type Platform = 'desktop' | 'web' | 'android' | 'ios';
export type JdkVendor =
  | 'graalvm'
  | 'temurin'
  | 'corretto'
  | 'zulu';

/**
 * Where the generated project resolves the FlixelGDX modules and Gradle plugins.
 *
 *   mavenCentral : the default. Stable releases from Maven Central
 *                  (org.flixelgdx:flixelgdx-*); plugin markers resolve directly.
 *   jitpack      : snapshots or a specific commit/branch from JitPack
 *                  (com.github.flixelgdx.flixelgdx:flixelgdx-*); plugins need a
 *                  resolutionStrategy mapping because JitPack omits plugin markers.
 */
export type DependencySource = 'mavenCentral' | 'jitpack';

/** Maven group the framework artifacts live under for a given source. */
export function flixelGroup(source: DependencySource): string {
  return source === 'jitpack' ? 'com.github.flixelgdx.flixelgdx' : 'org.flixelgdx';
}

/**
 * Strips a leading `v`/`V` from a release tag (e.g. `v0.4.0` -> `0.4.0`).
 * Maven Central coordinates and Gradle plugin versions use the bare number;
 * the leading `v` would otherwise break module and plugin resolution.
 */
export function stripVersionPrefix(version: string): string {
  return version.trim().replace(/^v/i, '');
}

export type GeneratorOptions = {
  gameName: string;
  gameId: string;
  packageName: string;
  language: Language;
  javaVersion: number;
  flixelVersion: string;
  ide: IDE;
  /** Matches `template.json` `id` under `static/templates/<id>/`. */
  template: string;
  platforms: Platform[];
  jdkVendor: JdkVendor;
  expert: boolean;
  heapMb: number;
  jvmFlags: string;
  gradleConfig: string;
  /** Repository the framework resolves from. Defaults to Maven Central. */
  dependencySource: DependencySource;
  /**
   * Optional JitPack commit hash or branch (e.g. `master-SNAPSHOT`) to resolve
   * instead of the selected release. Only applied when `dependencySource` is
   * `jitpack`; an empty string falls back to the selected version.
   */
  jitpackRef: string;
  /**
   * Optional absolute path to a local FlixelGDX clone for a Gradle composite
   * build (for framework developers). Empty disables it. When set, the
   * generated `settings.gradle` adds `includeBuild '<path>'`.
   */
  compositeBuildPath: string;
};

/**
 * Gradle `JvmVendorSpec` enum value matching a `JdkVendor`. See
 * https://docs.gradle.org/current/javadoc/org/gradle/jvm/toolchain/JvmVendorSpec.html
 */
export function gradleVendorSpec(v: JdkVendor): string {
  switch (v) {
    case 'graalvm':
      return 'GRAAL_VM';
    case 'temurin':
      return 'ADOPTIUM';
    case 'corretto':
      return 'AMAZON';
    case 'zulu':
      return 'AZUL';
  }
}

/** Safe inside Java / Groovy double-quoted string literals. */
export function escDoubleQuotedJvm(name: string): string {
  return name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

/** Safe inside Kotlin double-quoted strings (escapes `$`). */
export function escDoubleQuotedKotlin(name: string): string {
  return name
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\$/g, '\\$')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n');
}

export function validateOptions(o: GeneratorOptions): string | null {
  if (!o.gameName.trim()) return 'Game name cannot be empty.';
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(o.gameId))
    return 'Game id must be lowercase letters, numbers, dashes or underscores.';
  if (!/^[a-z_][\w]*(\.[a-z_][\w]*)+$/.test(o.packageName))
    return 'Package name must look like a Java package, e.g. com.example.game.';
  if (o.javaVersion < 17) return 'Java version cannot be lower than 17 (FlixelGDX requirement).';
  if (o.heapMb < 8) return 'Heap must be at least 8 MB.';
  if (o.platforms.length === 0) return 'Pick at least one platform.';
  return null;
}
