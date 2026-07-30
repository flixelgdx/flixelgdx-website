/**
 * Inline project generator -- all file content is produced in TypeScript.
 * No server fetches are required; the generated ZIP is assembled entirely in memory.
 */
import type {DependencySource, GeneratorOptions, Language} from './generatorOptions';
import {escGameName, flixelGroup, gradleVendorSpec, stripVersionPrefix} from './generatorOptions';
import {GRADLE_WRAPPER_JAR_BASE64} from './gradleWrapperJar';
import {GRADLEW_SH, GRADLEW_BAT} from './gradleWrapperScripts';

// ---------------------------------------------------------------------------
// Naming helpers
// ---------------------------------------------------------------------------

type Names = {
  pkg: string;
  pkgPath: string;
  game: string;
  source: DependencySource;
  resolvedVersion: string;
  fGroup: string;
};

function sanitizePackage(pkg: string): string {
  return pkg.replace(/[^A-Za-z0-9_.]/g, '_');
}

function deriveNames(o: GeneratorOptions): Names {
  const pkg = sanitizePackage(o.packageName);
  const pkgPath = pkg.replace(/\./g, '/');
  const game = (() => {
    const pascal = o.gameId
      .split(/[-_]+/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join('');
    return /^[0-9]/.test(pascal) ? `Game${pascal}` : pascal;
  })();
  const source: DependencySource = o.expert ? o.dependencySource : 'mavenCentral';
  const jitpackRef = o.expert ? o.jitpackRef.trim() : '';
  const resolvedVersion =
    source === 'jitpack' && jitpackRef ? jitpackRef : stripVersionPrefix(o.flixelVersion);
  const fGroup = flixelGroup(source);
  return {pkg, pkgPath, game, source, resolvedVersion, fGroup};
}

function jvmArgList(o: GeneratorOptions): string {
  const args = [`-Xms${Math.max(8, Math.floor(o.heapMb / 2))}M`, `-Xmx${o.heapMb}M`];
  if (o.expert && o.jvmFlags.trim()) {
    args.push(...o.jvmFlags.trim().split(/\s+/));
  }
  return args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(', ');
}

// ---------------------------------------------------------------------------
// Repository / dependency-source wiring
// ---------------------------------------------------------------------------

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

const JITPACK_PROJECT_REPO = `    maven {
      url 'https://jitpack.io'
      content {
        includeGroupByRegex 'com\\\\.github\\\\..*'
        includeGroupByRegex 'io\\\\.github\\\\.flixelgdx.*'
      }
    }`;

function pluginRepositories(source: DependencySource): string {
  const lines = ['    mavenLocal()', '    mavenCentral()'];
  if (source === 'jitpack') lines.push("    maven { url 'https://jitpack.io' }");
  lines.push('    gradlePluginPortal()');
  return lines.join('\n');
}

function pluginResolutionStrategy(source: DependencySource): string {
  return source === 'jitpack' ? JITPACK_PLUGIN_RESOLUTION : '';
}

function projectRepositories(source: DependencySource): string {
  const lines = ['    mavenCentral()', '    google()'];
  if (source === 'jitpack') lines.push(JITPACK_PROJECT_REPO);
  return lines.join('\n');
}

function compositeIncludeBuild(path: string): string {
  const clean = path.trim();
  if (!clean) return '';
  const normalized = clean.replace(/\\/g, '/').replace(/'/g, "\\'");
  return `includeBuild '${normalized}'\n`;
}

// ---------------------------------------------------------------------------
// Static file content
// ---------------------------------------------------------------------------

function genEditorconfig(): string {
  return `# https://editorconfig.org
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true

[*.{java,scala,groovy,kt,kts}]
# 2-space indentation (Google Style Guide Section 4.2)
indent_style = space

max_line_length = 120

# Standard Java formatting rules.
ij_java_use_single_class_imports = true
ij_java_insert_inner_class_imports = false
ij_java_class_count_to_use_import_on_demand = 999
ij_java_names_count_to_use_import_on_demand = 999
ij_java_packages_to_use_import_on_demand = unset
ij_java_blank_lines_before_class_end = 0
ij_java_blank_lines_after_class_header = 1
ij_java_doc_align_param_comments = false
ij_java_doc_do_not_wrap_if_one_line = true
ij_any_keep_simple_blocks_in_one_line = true

# Block formatting (Section 4.1.2)
ij_java_class_brace_style = end_of_line
ij_java_method_brace_style = end_of_line

# Space before opening brace (Section 4.6.2)
ij_java_space_before_class_left_brace = true
ij_java_space_before_method_left_brace = true
ij_java_space_before_if_left_brace = true
ij_java_space_before_while_left_brace = true
ij_java_space_before_for_left_brace = true
ij_java_space_before_try_left_brace = true
ij_java_space_before_catch_left_brace = true
ij_java_space_before_switch_left_brace = true
ij_java_space_before_synchronized_left_brace = true

indent_size = 2

[*.gradle]
indent_size = 2

[*.md]
trim_trailing_whitespace = false
`;
}

function genGitignore(): string {
  return `## Gradle:
.gradle/
gradle-app.setting
**/build/
**/nbbuild/
**/dist/
**/nbdist/

## Java:
*.class
*.war
*.ear
hs_err_pid*
.attach_pid*

## Android:
/android/libs/
/android/gen/
/android/out/
local.properties
com_crashlytics_export_strings.xml

## Robovm:
/ios/robovm-build/

## iOS:
/ios/xcode/*.xcodeproj/*
!/ios/xcode/*.xcodeproj/xcshareddata
!/ios/xcode/*.xcodeproj/project.pbxproj
/ios/xcode/native/
/ios/IOSLauncher.app
/ios/IOSLauncher.app.dSYM

## IntelliJ, Android Studio:
.cursorj
.idea/
*.ipr
*.iws
*.iml

## Eclipse:
.classpath
.project
**/bin/
*.tmp
*.bak
*.swp
*~.nib
.settings/
.loadpath
.externalToolBuilders/
*.launch

## NetBeans:
/**/nbproject/private/
/**/nbbuild/
/**/dist/
/**/nbdist/

nbactions.xml
nb-configuration.xml

# VS Code
.vscode/

## OS-Specific:
.DS_Store
Thumbs.db

## Miscellaneous:
*~
*.*#
*#*#
*.log
`;
}

function genGradleWrapperProps(): string {
  return `distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-9.5.1-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
`;
}

function genJniConfig(): string {
  return `[
  {
    "name": "games.rednblack.miniaudio.MiniAudio",
    "methods": [
      {"name": "on_native_notification", "parameterTypes": ["int"]},
      {"name": "on_native_sound_end", "parameterTypes": ["long"]},
      {"name": "on_native_log", "parameterTypes": ["int", "java.lang.String"]}
    ]
  },
  {
    "name": "imgui.ImFontAtlas",
    "methods": [
      {"name": "createAlpha8Pixels", "parameterTypes": ["int"]},
      {"name": "createRgba32Pixels", "parameterTypes": ["int"]}
    ]
  },
  {
    "name": "imgui.ImVec2",
    "fields": [
      {"name": "x"},
      {"name": "y"}
    ]
  },
  {
    "name": "imgui.ImVec4",
    "fields": [
      {"name": "x"},
      {"name": "y"},
      {"name": "z"},
      {"name": "w"}
    ]
  },
  {
    "name": "imgui.assertion.ImAssertCallback",
    "methods": [
      {"name": "imAssert", "parameterTypes": ["java.lang.String", "int", "java.lang.String"]}
    ]
  },
  {
    "name": "imgui.binding.ImGuiStruct",
    "fields": [
      {"name": "ptr"}
    ]
  },
  {
    "name": "imgui.callback.ImGuiInputTextCallback",
    "methods": [
      {"name": "accept", "parameterTypes": ["long"]}
    ]
  },
  {
    "name": "imgui.callback.ImListClipperCallback",
    "methods": [
      {"name": "accept", "parameterTypes": ["int"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewport",
    "methods": [
      {"name": "accept", "parameterTypes": ["imgui.ImGuiViewport"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewportFloat",
    "methods": [
      {"name": "accept", "parameterTypes": ["imgui.ImGuiViewport", "float"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewportImVec2",
    "methods": [
      {"name": "accept", "parameterTypes": ["imgui.ImGuiViewport", "imgui.ImVec2"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewportString",
    "methods": [
      {"name": "accept", "parameterTypes": ["imgui.ImGuiViewport", "java.lang.String"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewportSuppBoolean",
    "methods": [
      {"name": "get", "parameterTypes": ["imgui.ImGuiViewport"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewportSuppFloat",
    "methods": [
      {"name": "get", "parameterTypes": ["imgui.ImGuiViewport"]}
    ]
  },
  {
    "name": "imgui.callback.ImPlatformFuncViewportSuppImVec2",
    "methods": [
      {"name": "get", "parameterTypes": ["imgui.ImGuiViewport", "imgui.ImVec2"]}
    ]
  },
  {
    "name": "imgui.callback.ImStrConsumer",
    "methods": [
      {"name": "accept", "parameterTypes": ["java.lang.String"]}
    ]
  },
  {
    "name": "imgui.callback.ImStrSupplier",
    "methods": [
      {"name": "get", "parameterTypes": []}
    ]
  },
  {
    "name": "imgui.internal.ImRect",
    "fields": [
      {"name": "min"},
      {"name": "max"}
    ]
  },
  {
    "name": "imgui.type.ImString",
    "methods": [
      {"name": "resizeInternal", "parameterTypes": ["int"]}
    ]
  },
  {
    "name": "imgui.type.ImString$InputData",
    "fields": [
      {"name": "isDirty"},
      {"name": "isResized"},
      {"name": "size"}
    ]
  },
  {
    "name": "java.lang.Boolean",
    "methods": [
      {"name": "getBoolean", "parameterTypes": ["java.lang.String"]}
    ]
  },
  {
    "name": "org.lwjgl.system.CallbackI",
    "methods": [
      {"name": "callback", "parameterTypes": ["long", "long"]}
    ]
  }
]
`;
}

// ---------------------------------------------------------------------------
// Dynamic file generators
// ---------------------------------------------------------------------------

function genLocalProperties(o: GeneratorOptions): string {
  const hasAndroid = o.platforms.includes('android');
  if (!hasAndroid) return '';
  return `## This file is machine-specific and must NOT be committed to version control.
## It is intentionally listed in .gitignore.

# Set to true to include the Android subproject in the build.
# Keep it false until you have an Android SDK installed and configured.
# You can also pass -PincludeAndroid=true on the Gradle command line for a one-off build.
includeAndroid=false

# Uncomment and set to your Android SDK location once you are ready to build for Android.
# Android Studio sets this automatically when you first open the project.
#sdk.dir=/path/to/android/sdk
`;
}

function genGradleProperties(o: GeneratorOptions, d: Names): string {
  const sourceLabel = d.source === 'jitpack' ? 'JitPack' : 'Maven Central';
  const kotlinBlock =
    o.language === 'kotlin'
      ? `\n# KTX version (Kotlin extensions for libGDX).\n# Check https://github.com/libktx/ktx/releases for the latest version matching your gdxVersion.\nktxVersion=1.13.1-rc1\n`
      : '';
  const webBlock = o.platforms.includes('web')
    ? `\n# Reflection metadata scope for TeaVM (see COMPILING.md in flixelgdx/flixelgdx).\nflixelReflectionProfile=STANDARD\n`
    : '';
  const androidBlock = o.platforms.includes('android')
    ? `\n# Required for AGP to use AndroidX support libraries.\nandroid.useAndroidX=true\n`
    : '';
  const basisuBlock = (o.basisuDesktop || o.basisuAndroid)
    ? `\n# Set to true to enable KTX2/Basis Universal texture compression at build time.\n# WARNING: compression can be very slow on large asset sets.\nenableBasisuCompression=true\n`
    : '';
  return `# Generated by the FlixelGDX project generator.
# Documented here: https://flixelgdx.org/docs/

org.gradle.jvmargs=-Xms32m -Xmx1028m
org.gradle.daemon=true
org.gradle.parallel=true
org.gradle.caching=true
# The GraalVM native image plugin cannot be serialized into Gradle's
# configuration cache. Disabled here so native image works out of the box.
# You may re-enable it if you do not use native image (enableGraalNative=false).
org.gradle.configuration-cache=false

# FlixelGDX framework version, resolved from ${sourceLabel}.
# This single property feeds every FlixelGDX module and plugin; to upgrade the
# framework, change it here and nowhere else.
flixelVersion=${d.resolvedVersion}
# libGDX LWJGL3 backend version (StartupHelper and desktop natives align with FlixelGDX).
gdxVersion=1.14.0
gameName=${o.gameName}
gameId=${o.gameId}
version=${o.projectVersion}

# Set to true to enable GraalVM native image compilation.
enableGraalNative=false
graalHelperVersion=2.0.1
${webBlock}${kotlinBlock}${androidBlock}${basisuBlock}`;
}

function genSettings(o: GeneratorOptions, d: Names): string {
  const hasAndroid = o.platforms.includes('android');
  const compositeLine = o.expert ? compositeIncludeBuild(o.compositeBuildPath) : '';
  const resolution = pluginResolutionStrategy(d.source);

  // Core, desktop, web always come first; android is gated on includeAndroid.
  const staticIncludes: string[] = ['  include "core"'];
  if (o.platforms.includes('desktop')) staticIncludes.push('  include "lwjgl3"');
  if (o.platforms.includes('web')) staticIncludes.push('  include "teavm"');

  const androidBlock = hasAndroid
    ? `\n// Android is optional so the project can be built without an Android SDK.
// Enable via -PincludeAndroid=true on the command line, or includeAndroid=true in local.properties.
def includeAndroidFromCli = gradle.startParameter.projectProperties.get('includeAndroid') == 'true'
def includeAndroidFromLocal = false
def localPropsFile = new File(settingsDir, 'local.properties')
if (localPropsFile.exists()) {
  localPropsFile.withInputStream { stream ->
    def props = new Properties()
    props.load(stream)
    includeAndroidFromLocal = props.getProperty('includeAndroid', 'false') == 'true'
  }
}
gradle.ext.includeAndroid = includeAndroidFromCli || includeAndroidFromLocal
`
    : '';

  const androidInclude = hasAndroid
    ? `\nif (gradle.ext.includeAndroid) {\n  include "android"\n}`
    : '';

  return `// Plugin versions, repositories, and FlixelGDX plugin resolution.
//
// Maven Central (the default) publishes proper Gradle plugin markers, so the
// org.flixelgdx.* plugins apply directly by ID and version. JitPack omits
// plugin markers, so when that source is selected the resolutionStrategy below
// maps each org.flixelgdx.* plugin ID to its JitPack modules.
pluginManagement {
  plugins {
    id 'org.jetbrains.kotlin.jvm' version '1.9.24'
    id 'org.teavm' version '0.13.0'
    id 'org.graalvm.buildtools.native' version '0.10.6'
    id 'io.github.fourlastor.construo' version '2.1.0'
  }
  repositories {
${pluginRepositories(d.source)}
  }
${resolution}}

// Auto-provision the selected JDK at build time.
// The Foojay Toolchains Resolver lets Gradle download a matching JDK on
// demand, so you only need a JDK to bootstrap Gradle itself.
plugins {
  id 'org.gradle.toolchains.foojay-resolver-convention' version '0.8.0'
}
${androidBlock}
${compositeLine}rootProject.name = "${o.gameId}"
${staticIncludes.join('\n')}
${androidInclude}
`;
}

function genRootBuildGradle(o: GeneratorOptions, d: Names): string {
  const hasAndroid = o.platforms.includes('android');
  const expertGradle =
    o.expert && o.gradleConfig.trim()
      ? `\n/* ----------- expert mode: custom gradle config ----------- */\n${o.gradleConfig}\n`
      : '';
  const repos = projectRepositories(d.source);
  const basisuClasspath =
    o.basisuAndroid
      ? `      classpath "${d.fGroup}:flixelgdx-basisu-plugin:\${flixelVersion}"\n`
      : '';

  if (!hasAndroid) {
    return `/*
 * Root build script generated by the FlixelGDX project generator.
 * - Java ${o.javaVersion}+ (FlixelGDX requires 17 at minimum).
 */
allprojects {
  version = "\${version}"
  group = "${d.pkg}"
  repositories {
${repos}
  }
}
${expertGradle}`;
  }

  // When Android is included, AGP and the Kotlin Android plugin must go through
  // the buildscript/classpath path to avoid a cross-plugin compatibility check
  // that fires when both 'kotlin-jvm' and 'kotlin-android' are in plugins {}.
  const buildscriptRepos =
    d.source === 'jitpack'
      ? `    google()\n    mavenCentral()\n    maven { url 'https://jitpack.io' }\n    gradlePluginPortal()`
      : `    google()\n    mavenCentral()\n    gradlePluginPortal()`;

  return `/*
 * Root build script generated by the FlixelGDX project generator.
 * - Java ${o.javaVersion}+ (FlixelGDX requires 17 at minimum).
 * - AGP and Kotlin Android plugin use buildscript/classpath (not plugins {}) to avoid
 *   the Kotlin JVM / Kotlin Android cross-plugin compatibility check.
 */
buildscript {
  repositories {
${buildscriptRepos}
  }
  dependencies {
    if (gradle.ext.get('includeAndroid') == true) {
      classpath 'com.android.tools.build:gradle:8.7.3'
      classpath "org.jetbrains.kotlin:kotlin-gradle-plugin:1.9.24"
${basisuClasspath}    }
  }
}

allprojects {
  version = "\${version}"
  group = "${d.pkg}"
  repositories {
${repos}
  }
}
${expertGradle}`;
}

function genCoreBuildGradle(o: GeneratorOptions, d: Names): string {
  const kotlinPlugin =
    o.language === 'kotlin'
      ? `  id 'org.jetbrains.kotlin.jvm'\n  id 'java-library'\n`
      : `  id 'java-library'\n`;
  const kotlinSourceCompat =
    o.language === 'kotlin'
      ? `  sourceCompatibility = JavaVersion.VERSION_${o.javaVersion}\n  targetCompatibility = JavaVersion.VERSION_${o.javaVersion}\n`
      : `  sourceCompatibility = JavaVersion.VERSION_${o.javaVersion}\n  targetCompatibility = JavaVersion.VERSION_${o.javaVersion}\n`;
  const kotlinStdlib =
    o.language === 'kotlin' ? `  implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.24"\n` : '';
  const videoDep =
    (o.videoDesktop || o.videoWeb || o.videoAndroid)
      ? `  api "${d.fGroup}:flixelgdx-video-core:\${flixelVersion}"\n`
      : '';

  return `plugins {
${kotlinPlugin}  id 'org.flixelgdx.logging' version "\${flixelVersion}"
}

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(${o.javaVersion})
    vendor = JvmVendorSpec.${gradleVendorSpec(o.jdkVendor)}
  }
${kotlinSourceCompat}}

dependencies {
  api "${d.fGroup}:flixelgdx-core:\${flixelVersion}"
${videoDep}${kotlinStdlib}}
`;
}

function lwjgl3PluginsBlock(o: GeneratorOptions): string {
  const kotlin = o.language === 'kotlin' ? `  id 'org.jetbrains.kotlin.jvm'\n` : '';
  const basisu = o.basisuDesktop ? `  id 'org.flixelgdx.basisu'\n` : '';
  return `${kotlin}  id 'application'\n  id 'org.graalvm.buildtools.native'\n  id 'io.github.fourlastor.construo'\n${basisu}  id 'org.flixelgdx.logging' version "\${flixelVersion}"`;
}

function genLwjgl3BuildGradle(o: GeneratorOptions, d: Names): string {
  const heapArgs = jvmArgList(o);
  const videoLwjgl3Dep =
    o.videoDesktop
      ? `  implementation "${d.fGroup}:flixelgdx-video-lwjgl3:\${flixelVersion}"\n`
      : '';
  const mainClass =
    o.language === 'kotlin'
      ? `${d.pkg}.lwjgl3.${d.game}Lwjgl3LauncherKt`
      : `${d.pkg}.lwjgl3.${d.game}Lwjgl3Launcher`;

  return `import io.github.fourlastor.construo.Target
import java.util.Locale

plugins {
${lwjgl3PluginsBlock(o)}
}

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(${o.javaVersion})
    vendor = JvmVendorSpec.${gradleVendorSpec(o.jdkVendor)}
  }
}

// gdx-svmhelper provides GraalVM substitutions for libGDX. It must be on the
// native-image classpath during nativeCompile, but should NOT be in the fat JAR
// because jdeps (used by construo) would see its GraalVM module references and
// add org.graalvm.nativeimage to jlink's module list, which Temurin does not ship.
configurations {
  nativeImageOnly {
    canBeResolved = true
    canBeConsumed = false
  }
}

def isMacOs = System.getProperty('os.name', '').toLowerCase(Locale.ROOT).contains('mac')
// Shared between the dev run task, the installDist/distZip start scripts (via
// applicationDefaultJvmArgs), and construo's packaged runtime image, so all three respect the
// same heap budget instead of only the dev loop being capped.
def heapJvmArgs = [${heapArgs}]

application {
  mainClass = "${mainClass}"
  applicationDefaultJvmArgs = heapJvmArgs
}

run {
  workingDir = rootProject.file('assets').path
  // You can uncomment the next line if your IDE claims a build failure even when the app closed properly.
  // setIgnoreExitValue(true)

  jvmArgs = heapJvmArgs
  if (isMacOs) jvmArgs += "-XstartOnFirstThread"

  // Always re-run even when no sources changed; without this Gradle marks the
  // task up-to-date on the second launch and the game never opens.
  outputs.upToDateWhen { false }
}

dependencies {
  implementation project(":core")
  implementation "${d.fGroup}:flixelgdx-lwjgl3:\${flixelVersion}"
${videoLwjgl3Dep}
  if (enableGraalNative == 'true') {
    nativeImageOnly "io.github.berstanio:gdx-svmhelper-backend-lwjgl3:\$graalHelperVersion"
  }
}

jar {
  archiveFileName.set("\${gameId}-\${version}.jar")
  duplicatesStrategy = DuplicatesStrategy.EXCLUDE
  dependsOn configurations.runtimeClasspath
  from { configurations.runtimeClasspath.collect { it.isDirectory() ? it : zipTree(it) } }
  from(rootProject.file('assets'))
  exclude('module-info.class', '**/module-info.class')
  exclude('META-INF/INDEX.LIST', 'META-INF/*.SF', 'META-INF/*.DSA', 'META-INF/*.RSA')
  dependencies {
    exclude('META-INF/INDEX.LIST', 'META-INF/maven/**')
  }
  manifest {
    attributes 'Main-Class': application.mainClass, 'Enable-Native-Access': 'ALL-UNNAMED'
  }
  doLast {
    archiveFile.get().asFile.setExecutable(true, false)
  }
}

graalvmNative {
  toolchainDetection = true
  binaries {
    main {
      imageName = "${o.gameId.replace(/[^A-Za-z0-9._-]/g, '-')}"
      buildArgs.add('-H:+ReportExceptionStackTraces')
      if (isMacOs) {
        buildArgs.add('-J-XstartOnFirstThread')
      }
      classpath(configurations.nativeImageOnly)
    }
  }
}

construo {
  name.set(providers.gradleProperty("gameId"))
  humanName.set(providers.gradleProperty("gameName"))
  mainClass.set(application.mainClass.get())
  outputDir.set(rootProject.layout.projectDirectory.dir("dist"))
  roast {
    runOnFirstThread.set(true)
    useZgc.set(false)
    vmArgs.addAll(heapJvmArgs + ["-XX:+UnlockExperimentalVMOptions", "-XX:-EnableJVMCI"])
  }
  targets.configure {
    register("linuxX64", Target.Linux) {
      architecture.set(Target.Architecture.X86_64)
      jdkUrl.set("https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.11%2B10/OpenJDK21U-jdk_x64_linux_hotspot_21.0.11_10.tar.gz")
    }
    register("macOsX64", Target.MacOs) {
      architecture.set(Target.Architecture.X86_64)
      jdkUrl.set("https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.11%2B10/OpenJDK21U-jdk_x64_mac_hotspot_21.0.11_10.tar.gz")
      identifier.set("${d.pkg}.desktop")
      def v = providers.gradleProperty("version").orElse("0.0.1").get()
      buildNumber.set(v)
      versionNumber.set(v)
    }
    register("macOsAarch64", Target.MacOs) {
      architecture.set(Target.Architecture.AARCH64)
      jdkUrl.set("https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.11%2B10/OpenJDK21U-jdk_aarch64_mac_hotspot_21.0.11_10.tar.gz")
      identifier.set("${d.pkg}.desktop")
      def v = providers.gradleProperty("version").orElse("0.0.1").get()
      buildNumber.set(v)
      versionNumber.set(v)
    }
    register("winX64", Target.Windows) {
      architecture.set(Target.Architecture.X86_64)
      jdkUrl.set("https://github.com/adoptium/temurin21-binaries/releases/download/jdk-21.0.11%2B10/OpenJDK21U-jdk_x64_windows_hotspot_21.0.11_10.zip")
    }
  }
}

distributions {
  main {
    contents {
      into('libs') {
        project.configurations.runtimeClasspath.files.findAll { file ->
          file.getName() != project.tasks.jar.outputs.files.singleFile.name
        }.each { file ->
          exclude file.name
        }
      }
    }
  }
}

startScripts.dependsOn(':lwjgl3:jar')
startScripts.classpath = project.tasks.jar.outputs.files

if (enableGraalNative == 'true') {
  apply from: file("nativeimage.gradle")
}
`;
}

function genNativeimageGradle(o: GeneratorOptions): string {
  return `/*
 * nativeimage.gradle -- GraalVM Native Image support for the lwjgl3 module.
 *
 * Applied automatically when enableGraalNative=true in gradle.properties.
 *
 * HOW TO ENABLE
 *   1. Install GraalVM JDK 17+.
 *   2. Set GRAALVM_HOME=/path/to/graalvm-jdk-17 in your shell profile.
 *   3. Set enableGraalNative=true in gradle.properties.
 *
 * HOW TO BUILD
 *   ./gradlew :lwjgl3:nativeCompile
 *   Output lands in lwjgl3/build/native/nativeCompile/.
 *
 * ADDING LIBRARIES THAT USE JNI OR REFLECTION
 *   If you add a library that uses JNI or reflection, run the config generator:
 *
 *   ./gradlew :lwjgl3:generateNativeConfig
 *
 *   Play through every feature in your game, then close the window.
 *   The task merges the recorded configuration into META-INF/native-image/
 *   so it is picked up by the next nativeCompile.
 */

if (gradle.startParameter.taskNames.any { it.contains('generateNativeConfig') }) {
    project.extensions.extraProperties.set('agent', '')
}

def _assetsDir = new File("\${project.rootDir}/assets")

graalvmNative {
  toolchainDetection = false
  metadataRepository {
    enabled = false
  }

  agent {
    defaultMode = "standard"
    modes {
      standard {
        outputTaskNames = ["run"]
      }
    }
    metadataCopy {
      inputTaskNames = ["run"]
      outputDirectories = ["src/main/resources/META-INF/native-image"]
      mergeWithExisting = true
    }
  }

  binaries {
    main {
      buildArgs.add('-march=compatibility')
      buildArgs.add('-R:MaxHeapSize=${o.heapMb}m')
      jvmArgs.add('-Dfile.encoding=UTF8')
      sharedLibrary = false

      buildArgs.add('-H:IncludeResources=.+\\\\.so')
      buildArgs.add('-H:IncludeResources=.+\\\\.dll')
      buildArgs.add('-H:IncludeResources=.+\\\\.dylib')

      buildArgs.add('-H:IncludeResources=.*lsans.+')

      fileTree(_assetsDir).each { file ->
        def relPath = _assetsDir.toPath().relativize(file.toPath()).toString().replace('\\\\', '/')
        buildArgs.add("-H:IncludeResources=\\\\Q\${relPath}\\\\E")
      }

      def _moduleResourcesDir = new File("\${projectDir}/src/main/resources")
      if (_moduleResourcesDir.exists()) {
        fileTree(_moduleResourcesDir).each { file ->
          def relPath = _moduleResourcesDir.toPath().relativize(file.toPath()).toString().replace('\\\\', '/')
          if (!relPath.startsWith('META-INF')) {
            buildArgs.add("-H:IncludeResources=\\\\Q\${relPath}\\\\E")
          }
        }
      }

      resources.autodetect()

      buildArgs.add('--initialize-at-run-time=imgui.ImGui,imgui.ImFontAtlas,imgui.ImGuiPlatformIO')

      buildArgs.add("-H:JNIConfigurationFiles=\${projectDir}/src/main/resources/META-INF/native-image/flixelgdx/jni-config.json")
    }
  }
}

tasks.named('jar').configure {
  from fileTree("\${project.rootDir}/assets")
}

tasks.named('run').configure {
  doNotTrackState('Agent recording must not be skipped by the build cache.')
}

tasks.register('generateNativeConfig') {
  group = 'Native Image'
  description = 'Launches the game with the GraalVM tracing agent. Play through all features, then close the window. Config is written to META-INF/native-image/ automatically.'
  dependsOn(tasks.named('run'))
  finalizedBy(tasks.named('metadataCopy'))
}
`;
}

function genStartupHelper(pkg: string): string {
  return `/*
 * Copyright 2020 damios
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Note, the above license and copyright applies to this file only.
package ${pkg}.lwjgl3;

import com.badlogic.gdx.Version;
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3NativesLoader;

import org.lwjgl.system.JNI;
import org.lwjgl.system.linux.UNISTD;
import org.lwjgl.system.macosx.LibC;
import org.lwjgl.system.macosx.ObjCRuntime;

import java.io.File;
import java.lang.management.ManagementFactory;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * A helper object for game startup, featuring three utilities related to LWJGL3 on various operating systems.
 * <p>
 * The utilities are as follows:
 * <ul>
 *  <li> Windows: Prevents a common crash related to LWJGL3's extraction of shared library files.</li>
 *  <li> macOS: Spawns a child JVM process with {@code -XstartOnFirstThread} in the JVM args (if it was not already).
 *  This is required for LWJGL3 to work on macOS.</li>
 *  <li> Linux (NVIDIA GPUs only): Spawns a child JVM process with the {@code __GL_THREADED_OPTIMIZATIONS}
 *  {@link System#getenv(String) Environment Variable} set to {@code 0} (if it was not already). This is required for
 *  LWJGL3 to work on Linux with NVIDIA GPUs.</li>
 * </ul>
 * <a href="https://jvm-gaming.org/t/starting-jvm-on-mac-with-xstartonfirstthread-programmatically/57547">Based on this java-gaming.org post by kappa</a>
 * @author damios
 */
public class StartupHelper {

  private static final String JVM_RESTARTED_ARG = "jvmIsRestarted";

  private StartupHelper() {}

  /**
   * Must only be called on Linux. Check OS first (or use short-circuit evaluation)!
   * @return whether NVIDIA drivers are present on Linux.
   */
  public static boolean isLinuxNvidia() {
    String[] drivers = new File("/proc/driver").list(
      (dir, path) -> path.toUpperCase(Locale.ROOT).contains("NVIDIA")
    );
    if (drivers == null) return false;
    return drivers.length > 0;
  }

  /**
   * Applies the utilities as described by {@link StartupHelper}'s Javadoc.
   * @return whether a child JVM process was spawned or not.
   */
  public static boolean startNewJvmIfRequired() {
    return startNewJvmIfRequired(true);
  }

  /**
   * Applies the utilities as described by {@link StartupHelper}'s Javadoc.
   * @param inheritIO whether I/O should be inherited in the child JVM process.
   * @return whether a child JVM process was spawned or not.
   */
  public static boolean startNewJvmIfRequired(boolean inheritIO) {
    String osName = System.getProperty("os.name").toLowerCase(Locale.ROOT);
    if (osName.contains("mac")) return startNewJvm0(/*isMac =*/ true, inheritIO);
    if (osName.contains("windows")) {
      String programData = System.getenv("ProgramData");
      if (programData == null) programData = "C:\\\\Temp";
      String prevTmpDir = System.getProperty("java.io.tmpdir", programData);
      String prevUser = System.getProperty("user.name", "libGDX_User");
      System.setProperty("java.io.tmpdir", programData + "\\\\libGDX-temp");
      System.setProperty(
        "user.name",
        ("User_" + prevUser.hashCode() + "_GDX" + Version.VERSION).replace('.', '_')
      );
      Lwjgl3NativesLoader.load();
      System.setProperty("java.io.tmpdir", prevTmpDir);
      System.setProperty("user.name", prevUser);
      return false;
    }
    return startNewJvm0(/*isMac =*/ false, inheritIO);
  }

  private static final String MAC_JRE_ERR_MSG = "A Java installation could not be found. If you are distributing this app with a bundled JRE, be sure to set the '-XstartOnFirstThread' argument manually!";
  private static final String LINUX_JRE_ERR_MSG = "A Java installation could not be found. If you are distributing this app with a bundled JRE, be sure to set the environment variable '__GL_THREADED_OPTIMIZATIONS' to '0'!";
  private static final String CHILD_LOOP_ERR_MSG = "The current JVM process is a spawned child JVM process, but StartupHelper has attempted to spawn another child JVM process! This is a broken state, and should not normally happen! Your game may crash or not function properly!";

  /**
   * Spawns a child JVM process if on macOS, or on Linux with NVIDIA drivers.
   */
  public static boolean startNewJvm0(boolean isMac, boolean inheritIO) {
    long processID = getProcessID(isMac);
    if (!isMac) {
      if (!isLinuxNvidia()) return false;
      if ("0".equals(System.getenv("__GL_THREADED_OPTIMIZATIONS"))) return false;
    } else {
      if (!System.getProperty("org.graalvm.nativeimage.imagecode", "").isEmpty()) return false;

      long objcMsgSend = ObjCRuntime.getLibrary().getFunctionAddress("objc_msgSend");
      long nsThread = ObjCRuntime.objc_getClass("NSThread");
      long currentThread = JNI.invokePPP(nsThread, ObjCRuntime.sel_getUid("currentThread"), objcMsgSend);
      boolean isMainThread = JNI.invokePPZ(currentThread, ObjCRuntime.sel_getUid("isMainThread"), objcMsgSend);
      if (isMainThread) return false;

      if ("1".equals(System.getenv("JAVA_STARTED_ON_FIRST_THREAD_" + processID))) return false;
    }

    if ("true".equals(System.getProperty(JVM_RESTARTED_ARG))) {
      System.err.println(CHILD_LOOP_ERR_MSG);
      return false;
    }

    List<String> jvmArgs = new ArrayList<>();
    String javaExecPath = System.getProperty("java.home") + "/bin/java";
    if (!(new File(javaExecPath).exists())) {
      System.err.println(getJreErrMsg(isMac));
      return false;
    }

    jvmArgs.add(javaExecPath);
    if (isMac) jvmArgs.add("-XstartOnFirstThread");
    jvmArgs.add("-D" + JVM_RESTARTED_ARG + "=true");
    jvmArgs.addAll(ManagementFactory.getRuntimeMXBean().getInputArguments());
    jvmArgs.add("-cp");
    jvmArgs.add(System.getProperty("java.class.path"));
    String mainClass = System.getenv("JAVA_MAIN_CLASS_" + processID);
    if (mainClass == null) {
      StackTraceElement[] trace = Thread.currentThread().getStackTrace();
      if (trace.length > 0) mainClass = trace[trace.length - 1].getClassName();
      else {
        System.err.println("The main class could not be determined.");
        return false;
      }
    }
    jvmArgs.add(mainClass);

    try {
      ProcessBuilder processBuilder = new ProcessBuilder(jvmArgs);
      if (!isMac) processBuilder.environment().put("__GL_THREADED_OPTIMIZATIONS", "0");

      if (!inheritIO) processBuilder.start();
      else processBuilder.inheritIO().start().waitFor();
    } catch (Exception e) {
      System.err.println("There was a problem restarting the JVM.");
      // noinspection CallToPrintStackTrace
      e.printStackTrace();
    }

    return true;
  }

  private static String getJreErrMsg(boolean isMac) {
    if (isMac) return MAC_JRE_ERR_MSG;
    else return LINUX_JRE_ERR_MSG;
  }

  private static long getProcessID(boolean isMac) {
    if (isMac) return LibC.getpid();
    else return UNISTD.getpid();
  }
}
`;
}

function teavmPluginsBlock(o: GeneratorOptions): string {
  const kotlin = o.language === 'kotlin' ? `  id 'org.jetbrains.kotlin.jvm'\n` : '';
  return `${kotlin}  id 'java-library'\n  id 'org.flixelgdx.logging' version "\${flixelVersion}"`;
}

function genTeaVMBuildGradle(o: GeneratorOptions, d: Names): string {
  const langDeps =
    o.language === 'kotlin'
      ? `  implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.24"\n`
      : '';
  const videoTeaVMDep =
    o.videoWeb
      ? `  implementation "${d.fGroup}:flixelgdx-video-teavm:\${flixelVersion}"\n`
      : '';
  const mainClass =
    o.language === 'kotlin'
      ? `${d.pkg}.teavm.${d.game}TeaVMLauncherKt`
      : `${d.pkg}.teavm.${d.game}TeaVMLauncher`;
  const jsBundle = `${o.gameId.replace(/[^a-z0-9_-]/gi, '-')}.js`;

  return `plugins {
${teavmPluginsBlock(o)}
  // Must be applied beside org.flixelgdx.teavm (see COMPILING.md in flixelgdx).
  id 'org.teavm'
  id 'org.flixelgdx.teavm' version "\${flixelVersion}"
}

java {
  toolchain {
    languageVersion = JavaLanguageVersion.of(${o.javaVersion})
    vendor = JvmVendorSpec.${gradleVendorSpec(o.jdkVendor)}
  }
}

teavm {
  all {
    mainClass = "${mainClass}"
  }
  js {
    addedToWebApp = true
    targetFileName = "${jsBundle}"
  }
}

flixelgdx {
  title = "${escGameName(o.gameName)}"
}

dependencies {
  implementation project(":core")
  implementation "${d.fGroup}:flixelgdx-teavm:\${flixelVersion}"
${videoTeaVMDep}${langDeps}}
`;
}

function genAndroidBuildGradle(o: GeneratorOptions, d: Names): string {
  const kotlinAndroid = o.language === 'kotlin' ? `apply plugin: 'kotlin-android'\n` : '';
  const basisuPlugin = o.basisuAndroid ? `apply plugin: 'org.flixelgdx.basisu'\n` : '';
  const videoAndroidDep =
    o.videoAndroid
      ? `  implementation "${d.fGroup}:flixelgdx-video-android:\${flixelVersion}"\n`
      : '';
  const kotlinStdlib =
    o.language === 'kotlin'
      ? `  implementation "org.jetbrains.kotlin:kotlin-stdlib:1.9.24"\n`
      : '';
  const kotlinOptions =
    o.language === 'kotlin'
      ? `\n  kotlinOptions {\n    jvmTarget = '${o.javaVersion}'\n  }\n`
      : '';

  return `apply plugin: 'com.android.application'
${kotlinAndroid}${basisuPlugin}
android {
  namespace "${d.pkg}"
  compileSdk 36

  defaultConfig {
    applicationId "${d.pkg}"
    minSdk 24
    targetSdk 35
    versionCode 1
    versionName version
    multiDexEnabled true
  }

  compileOptions {
    coreLibraryDesugaringEnabled true
    sourceCompatibility JavaVersion.VERSION_${o.javaVersion}
    targetCompatibility JavaVersion.VERSION_${o.javaVersion}
  }
${kotlinOptions}
  sourceSets {
    main {
      // Reuse the shared assets directory at the project root.
      assets.srcDirs = [rootProject.file('assets').path]
    }
  }
}

dependencies {
  coreLibraryDesugaring 'com.android.tools:desugar_jdk_libs:2.1.5'

  implementation project(':core')
  implementation "${d.fGroup}:flixelgdx-android:\${flixelVersion}"
${videoAndroidDep}${kotlinStdlib}}
`;
}

function genAndroidManifest(o: GeneratorOptions, d: Names): string {
  const launcherClass = `${d.pkg}.android.${d.game}AndroidLauncher`;
  return `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <!-- Required for controller and phone haptics. -->
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

    <application
        android:allowBackup="false"
        android:fullBackupContent="false"
        android:hardwareAccelerated="true"
        android:label="${escGameName(o.gameName)}">

        <activity
            android:name="${launcherClass}"
            android:configChanges="keyboard|keyboardHidden|navigation|orientation|screenLayout|screenSize|smallestScreenSize"
            android:exported="true"
            android:screenOrientation="landscape">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>

</manifest>
`;
}

// ---------------------------------------------------------------------------
// Source file generators
// ---------------------------------------------------------------------------

function genGameClass(o: GeneratorOptions, d: Names): string {
  const nameEsc = escGameName(o.gameName);
  if (o.language === 'kotlin') {
    return `package ${d.pkg}

import org.flixelgdx.FlixelGame

/**
 * Your game entry class.
 *
 * FlixelGame owns the window settings and picks the first FlixelState.
 *
 * If you are new here, start in [PlayState]. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
class ${d.game}Game : FlixelGame("${nameEsc}", 640, 480, PlayState())
`;
  }
  return `package ${d.pkg};

import org.flixelgdx.FlixelGame;

/**
 * Your game entry class.
 *
 * <p>FlixelGame owns the window settings and picks the first FlixelState.
 *
 * <p>If you are new here, start in {@link PlayState}. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
public class ${d.game}Game extends FlixelGame {

  public ${d.game}Game() {
    super("${nameEsc}", 640, 480, new PlayState());
  }
}
`;
}

function genPlayState(o: GeneratorOptions, d: Names): string {
  if (o.language === 'kotlin') {
    return `package ${d.pkg}

import org.flixelgdx.FlixelState

/**
 * Your first FlixelState (think of it as one "screen" of your game).
 *
 * When you want a new screen, create another FlixelState subclass and call
 * \`Flixel.switchState(MyOtherState())\` from anywhere after Flixel has started.
 */
class PlayState : FlixelState() {

  override fun create() {
    super.create()
  }

  override fun update(elapsed: Float) {
    super.update(elapsed)
  }
}
`;
  }
  return `package ${d.pkg};

import org.flixelgdx.FlixelState;

/**
 * Your first FlixelState (think of it as one "screen" of your game).
 *
 * <p>When you want a new screen, create another FlixelState subclass and call
 * Flixel.switchState(new MyOtherState()) from anywhere after Flixel has started.
 */
public class PlayState extends FlixelState {

  @Override
  public void create() {
    super.create();
  }

  @Override
  public void update(float elapsed) {
    super.update(elapsed);
  }
}
`;
}

function genDesktopLauncher(o: GeneratorOptions, d: Names): string {
  const videoImport =
    o.videoDesktop
      ? o.language === 'kotlin'
        ? `import org.flixelgdx.backend.lwjgl3.video.FlixelVlcVideoHandler\n`
        : `import org.flixelgdx.backend.lwjgl3.video.FlixelVlcVideoHandler;\n`
      : '';
  const videoInstall =
    o.videoDesktop
      ? o.language === 'kotlin'
        ? `FlixelVlcVideoHandler.install()\n  `
        : `FlixelVlcVideoHandler.install();\n    `
      : '';

  if (o.language === 'kotlin') {
    return `package ${d.pkg}.lwjgl3

import org.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher
${videoImport}import ${d.pkg}.${d.game}Game

/**
 * Desktop entry point.
 *
 * [FlixelLwjgl3Launcher] wires libGDX, logging, and window events for you. The [StartupHelper]
 * (same package) restarts the JVM on macOS and NVIDIA Linux when needed.
 *
 * If you are new, focus on the \`core\` folder. That is where your game logic lives.
 */
fun main() {
  if (StartupHelper.startNewJvmIfRequired()) return
  ${videoInstall}FlixelLwjgl3Launcher.launch(${d.game}Game())
}
`;
  }
  return `package ${d.pkg}.lwjgl3;

import org.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher;
${videoImport}import ${d.pkg}.${d.game}Game;

/**
 * Desktop entry point.
 *
 * <p>{@link FlixelLwjgl3Launcher} wires libGDX, logging, and window events for you. The {@link StartupHelper}
 * (same package) restarts the JVM on macOS and NVIDIA Linux when needed.
 *
 * <p>If you are new, focus on the {@code core} folder. That is where your game logic lives.
 */
public final class ${d.game}Lwjgl3Launcher {

  public static void main(String[] args) {
    if (StartupHelper.startNewJvmIfRequired()) {
      return;
    }
    ${videoInstall}FlixelLwjgl3Launcher.launch(new ${d.game}Game());
  }

  private ${d.game}Lwjgl3Launcher() {}
}
`;
}

function genTeaVMLauncher(o: GeneratorOptions, d: Names): string {
  const videoImport =
    o.videoWeb
      ? o.language === 'kotlin'
        ? `import org.flixelgdx.backend.teavm.video.FlixelTeaVMVideoHandler\n`
        : `import org.flixelgdx.backend.teavm.video.FlixelTeaVMVideoHandler;\n`
      : '';
  const videoInstall =
    o.videoWeb
      ? o.language === 'kotlin'
        ? `FlixelTeaVMVideoHandler.install()\n  `
        : `FlixelTeaVMVideoHandler.install();\n    `
      : '';

  if (o.language === 'kotlin') {
    return `package ${d.pkg}.teavm

import org.flixelgdx.backend.teavm.FlixelTeaVMLauncher
${videoImport}import ${d.pkg}.${d.game}Game

/**
 * Browser entry point.
 *
 * TeaVM turns your JVM bytecode into JavaScript.
 *
 * [FlixelTeaVMLauncher] connects that web runtime to your FlixelGame.
 */
fun main() {
  ${videoInstall}FlixelTeaVMLauncher.launch(${d.game}Game())
}
`;
  }
  return `package ${d.pkg}.teavm;

import org.flixelgdx.backend.teavm.FlixelTeaVMLauncher;
${videoImport}import ${d.pkg}.${d.game}Game;

/**
 * Browser entry point.
 * <p>
 * TeaVM turns your JVM bytecode into JavaScript.
 * <p>
 * {@link FlixelTeaVMLauncher} connects that web runtime to your FlixelGame.
 */
public final class ${d.game}TeaVMLauncher {

  public static void main(String[] args) {
    ${videoInstall}FlixelTeaVMLauncher.launch(new ${d.game}Game());
  }

  private ${d.game}TeaVMLauncher() {}
}
`;
}

function genAndroidLauncher(o: GeneratorOptions, d: Names): string {
  const videoImport =
    o.videoAndroid
      ? o.language === 'kotlin'
        ? `import org.flixelgdx.backend.android.video.FlixelAndroidVideoHandler\n`
        : `import org.flixelgdx.backend.android.video.FlixelAndroidVideoHandler;\n`
      : '';
  const videoInstall =
    o.videoAndroid
      ? o.language === 'kotlin'
        ? `FlixelAndroidVideoHandler.install()\n    `
        : `FlixelAndroidVideoHandler.install();\n    `
      : '';

  if (o.language === 'kotlin') {
    return `package ${d.pkg}.android

import android.os.Bundle
import com.badlogic.gdx.backends.android.AndroidApplication
${videoImport}import ${d.pkg}.${d.game}Game
import org.flixelgdx.backend.android.FlixelAndroidLauncher

/**
 * Android entry point.
 *
 * [FlixelAndroidLauncher] wires libGDX, logging, and audio for you. Focus on
 * the \`core\` module. That is where the game logic lives.
 */
class ${d.game}AndroidLauncher : AndroidApplication() {

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    ${videoInstall}FlixelAndroidLauncher.launch(${d.game}Game(), this)
  }
}
`;
  }
  return `package ${d.pkg}.android;

import android.os.Bundle;
import com.badlogic.gdx.backends.android.AndroidApplication;
${videoImport}import ${d.pkg}.${d.game}Game;
import org.flixelgdx.backend.android.FlixelAndroidLauncher;

/**
 * Android entry point.
 *
 * <p>{@code FlixelAndroidLauncher} wires libGDX, logging, and audio for you. Focus on
 * the {@code core} module -- that is where the game logic lives.
 */
public class ${d.game}AndroidLauncher extends AndroidApplication {

  @Override
  protected void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    ${videoInstall}FlixelAndroidLauncher.launch(new ${d.game}Game(), this);
  }
}
`;
}

// ---------------------------------------------------------------------------
// README
// ---------------------------------------------------------------------------

function genReadme(o: GeneratorOptions, d: Names): string {
  const sourceLabel = d.source === 'jitpack' ? 'JitPack' : 'Maven Central';

  const jdkNote =
    `Download and install a JDK from https://adoptium.net (Temurin is the recommended choice).\n` +
    `Confirm the install: \`java -version\` in a fresh terminal.\n\n` +
    `Any JDK 8+ on PATH is enough to bootstrap Gradle. The build auto-downloads the\n` +
    `correct toolchain on first run via Gradle's Foojay Toolchains Resolver.`;

  const runParts: string[] = [];
  if (o.platforms.includes('desktop')) {
    runParts.push(
      `**Desktop:**\n\n    ./gradlew :lwjgl3:run        # macOS / Linux\n    gradlew.bat :lwjgl3:run      # Windows`
    );
  }
  if (o.platforms.includes('web')) {
    runParts.push(
      `**Web:**\n\n    ./gradlew :teavm:run         # TeaVM dev server (macOS / Linux)\n    gradlew.bat :teavm:run       # Windows`
    );
  }
  if (o.platforms.includes('android')) {
    runParts.push(
      `**Android:**\n\n` +
      `Install Android Studio from https://developer.android.com/studio and open this project root.\n` +
      `Then set \`includeAndroid=true\` in \`local.properties\` (see Android setup below).`
    );
  }

  const layoutLines: string[] = [];
  if (o.platforms.includes('desktop')) layoutLines.push('    lwjgl3/       desktop launcher (LWJGL3 / OpenGL)');
  if (o.platforms.includes('web')) layoutLines.push('    teavm/        browser launcher (TeaVM)');
  if (o.platforms.includes('android')) layoutLines.push('    android/      Android launcher (conditionally included via local.properties)');

  const extensionLines: string[] = [];
  if (o.videoDesktop || o.videoWeb || o.videoAndroid) {
    const platforms: string[] = [];
    if (o.videoDesktop && o.platforms.includes('desktop')) platforms.push('desktop');
    if (o.videoWeb && o.platforms.includes('web')) platforms.push('web');
    if (o.videoAndroid && o.platforms.includes('android')) platforms.push('Android');
    extensionLines.push(`- flixelgdx-video   (${platforms.join(', ')}) -- see docs/Videos`);
  }
  if (o.basisuDesktop && o.platforms.includes('desktop')) {
    extensionLines.push('- flixelgdx-basisu-plugin (desktop) -- compresses PNG assets to KTX2/Basis Universal');
  }
  if (o.basisuAndroid && o.platforms.includes('android')) {
    extensionLines.push('- flixelgdx-basisu-plugin (Android) -- compresses PNG assets to KTX2/Basis Universal');
  }

  const pluginNote =
    d.source === 'jitpack'
      ? `FlixelGDX publishes its Gradle plugins to JitPack under coordinates like\n` +
        `\`com.github.flixelgdx.flixelgdx:flixelgdx-teavm-plugin:<version>\`. JitPack does\n` +
        `not publish plugin marker artifacts, so the generated \`settings.gradle\` maps the\n` +
        `\`org.flixelgdx.*\` plugin IDs to their JitPack modules via \`resolutionStrategy\`.`
      : `FlixelGDX publishes its Gradle plugins to Maven Central with proper plugin markers,\n` +
        `so \`settings.gradle\` applies them directly by ID and version. If a plugin fails to\n` +
        `resolve, confirm \`mavenCentral()\` is present in the \`pluginManagement\` repositories.`;

  const androidSection = o.platforms.includes('android')
    ? `\n## Android setup\n\n` +
      `The Android subproject is gated behind \`includeAndroid\` to avoid requiring an Android SDK\n` +
      `for every build. To enable it:\n\n` +
      `1. Install **Android Studio** from https://developer.android.com/studio.\n` +
      `2. Open Android Studio, then open this project root. Android Studio will prompt you to set up\n` +
      `   the SDK the first time.\n` +
      `3. Open \`local.properties\` and change \`includeAndroid=false\` to \`includeAndroid=true\`.\n` +
      `4. Sync Gradle. The \`android\` subproject now appears in the project tree.\n` +
      `5. Select the Android run configuration and click Run in Android Studio.\n\n` +
      `For CI builds you can pass \`-PincludeAndroid=true\` on the command line instead of editing\n` +
      `\`local.properties\`.\n`
    : '';

  const nativeSection = o.platforms.includes('desktop')
    ? `\n## Native image (optional)\n\n` +
      `If you want to compile your game to a standalone binary with no JVM required:\n\n` +
      `    ./gradlew :lwjgl3:nativeCompile\n\n` +
      `The binary lands in \`lwjgl3/build/native/nativeCompile/\`. Set \`enableGraalNative=true\`\n` +
      `in \`gradle.properties\` and point \`GRAALVM_HOME\` at a GraalVM JDK 21 installation.\n`
    : '';

  return `# ${o.gameName}

Welcome! This folder is a FlixelGDX starter project. Gameplay code lives in the \`core\`
module; the platform-specific folders (\`lwjgl3\`, \`teavm\`, \`android\`) are just launchers.

This zip was created by the project generator at https://flixelgdx.org/getting-started.

## 1. Install a JDK

${jdkNote}

## 2. Run your game

${runParts.join('\n\n')}

This project ships the Gradle 9.5.1 wrapper (\`gradlew\` / \`gradlew.bat\`).
You do not need to install Gradle separately.
First build downloads dependencies and, if needed, the JDK toolchain.

### If Gradle reports an unknown plugin / unresolved plugin artifact

${pluginNote}
For more detail, see
[COMPILING.md](https://github.com/flixelgdx/flixelgdx/blob/master/COMPILING.md)
in the framework repo.

## What you picked

  - Language        : ${o.language}
  - Java target     : ${o.javaVersion}
  - JDK vendor      : ${o.jdkVendor}
  - FlixelGDX       : ${d.resolvedVersion} (pulled from ${sourceLabel})
  - Default heap    : ${o.heapMb} MB
  - Platforms       : ${o.platforms.join(', ')}
  - Version         : ${o.projectVersion}
${extensionLines.length ? extensionLines.map((l) => `  - ${l}`).join('\n') + '\n' : ''}
## Project layout

    core/         gameplay code (states, sprites, logic)
    assets/       shared art, audio, and data
${layoutLines.map((l) => `${l}\n`).join('')}    .editorconfig formatting rules
    gradlew[.bat] Gradle wrapper bootstrap
${androidSection}${nativeSection}
## Learn more

  - Pong tutorial : https://flixelgdx.org/docs/your-first-project
  - API reference : https://flixelgdx.org/api/
  - GitHub        : https://github.com/flixelgdx/flixelgdx
`;
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

function decodeWrapperJar(): Uint8Array {
  const binary = atob(GRADLE_WRAPPER_JAR_BASE64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export async function buildZip(o: GeneratorOptions): Promise<Blob> {
  const d = deriveNames(o);
  const {default: JSZip} = await import('jszip');
  const {saveAs} = await import('file-saver');
  const zip = new JSZip();

  const hasDesktop = o.platforms.includes('desktop');
  const hasWeb = o.platforms.includes('web');
  const hasAndroid = o.platforms.includes('android');

  const lang = o.language;
  const ext = lang === 'kotlin' ? 'kt' : 'java';
  const srcRoot = lang === 'kotlin' ? 'kotlin' : 'java';
  const coreSrc = `core/src/main/${srcRoot}/${d.pkgPath}`;

  // --- Static / shared files ---
  zip.file('.editorconfig', genEditorconfig());
  zip.file('.gitignore', genGitignore());
  zip.file('assets/.gitkeep', '');
  zip.file('gradle/wrapper/gradle-wrapper.properties', genGradleWrapperProps());
  zip.file('gradle/wrapper/gradle-wrapper.jar', decodeWrapperJar());
  zip.file('gradlew', GRADLEW_SH, {unixPermissions: 0o755});
  zip.file('gradlew.bat', GRADLEW_BAT);

  // --- Gradle project files ---
  zip.file('gradle.properties', genGradleProperties(o, d));
  zip.file('settings.gradle', genSettings(o, d));
  zip.file('build.gradle', genRootBuildGradle(o, d));
  zip.file('README.md', genReadme(o, d));

  if (hasAndroid) {
    zip.file('local.properties', genLocalProperties(o));
  }

  // --- core module ---
  zip.file('core/build.gradle', genCoreBuildGradle(o, d));
  zip.file(`${coreSrc}/${d.game}Game.${ext}`, genGameClass(o, d));
  zip.file(`${coreSrc}/PlayState.${ext}`, genPlayState(o, d));

  // --- lwjgl3 (desktop) module ---
  if (hasDesktop) {
    const desktopSrc = `lwjgl3/src/main/${srcRoot}/${d.pkgPath}/lwjgl3`;
    zip.file('lwjgl3/build.gradle', genLwjgl3BuildGradle(o, d));
    zip.file('lwjgl3/nativeimage.gradle', genNativeimageGradle(o));
    zip.file(
      `lwjgl3/src/main/java/${d.pkgPath}/lwjgl3/StartupHelper.java`,
      genStartupHelper(d.pkg)
    );
    zip.file(
      'lwjgl3/src/main/resources/META-INF/native-image/flixelgdx/jni-config.json',
      genJniConfig()
    );
    zip.file(
      `${desktopSrc}/${d.game}Lwjgl3Launcher.${ext}`,
      genDesktopLauncher(o, d)
    );
  }

  // --- teavm (web) module ---
  if (hasWeb) {
    const webSrc = `teavm/src/main/${srcRoot}/${d.pkgPath}/teavm`;
    zip.file('teavm/build.gradle', genTeaVMBuildGradle(o, d));
    zip.file(`${webSrc}/${d.game}TeaVMLauncher.${ext}`, genTeaVMLauncher(o, d));
  }

  // --- android module ---
  if (hasAndroid) {
    const androidSrc = `android/src/main/${srcRoot}/${d.pkgPath}/android`;
    zip.file('android/build.gradle', genAndroidBuildGradle(o, d));
    zip.file('android/src/main/AndroidManifest.xml', genAndroidManifest(o, d));
    zip.file(`${androidSrc}/${d.game}AndroidLauncher.${ext}`, genAndroidLauncher(o, d));
  }

  return zip.generateAsync({type: 'blob', platform: 'UNIX'});
}
