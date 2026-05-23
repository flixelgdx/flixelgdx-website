export type Language = 'java' | 'kotlin';
export type IDE = 'idea' | 'eclipse' | 'vscode' | 'none';
export type Platform = 'desktop' | 'web' | 'android' | 'ios';
export type JdkVendor =
  | 'graalvm'
  | 'temurin'
  | 'corretto'
  | 'zulu';

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
