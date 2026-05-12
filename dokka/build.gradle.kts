/*
 * Dokka build for the FlixelGDX API reference.
 *
 * This subproject is self-contained: it does NOT depend on the framework
 * itself being on the classpath. We just point Dokka at the framework's
 * java sources (cloned under `${rootDir}/build/flixelgdx-src/`) and tell it
 * to emit GitHub-Flavoured Markdown. The shell wrapper
 * `scripts/build-api.sh` does the cloning before invoking
 * `:dokka:dokkaGfm`.
 *
 * The expected layout under the framework checkout is:
 *
 *   build/flixelgdx-src/
 *     flixelgdx-core/src/main/java/...
 *     flixelgdx-jvm/src/main/java/...
 *     flixelgdx-lwjgl3/src/main/java/...
 *     ...
 *
 * Override the location with the gradle property `flixelgdxSrc`:
 *   ./gradlew :dokka:dokkaGfm -PflixelgdxSrc=/abs/path/to/flixelgdx
 */
import org.jetbrains.dokka.gradle.DokkaTask

plugins {
  // The classic Dokka plugin auto-registers `dokkaHtml` / `dokkaJavadoc` /
  // `dokkaGfm` / `dokkaJekyll` tasks. The GFM and Javadoc tasks are
  // activated by the corresponding format plugin dependency below.
  id("org.jetbrains.dokka") version "1.9.20"
}

repositories {
  mavenCentral()
}

// The `dokkaGfmPlugin` configuration is exposed by the Dokka Gradle plugin
// specifically for the dokkaGfm task. Adding the official gfm-plugin
// artifact here is what makes `dokkaGfm` produce real Markdown output.
dependencies {
  dokkaGfmPlugin("org.jetbrains.dokka:gfm-plugin:1.9.20")
}

val flixelgdxSrcPath = (project.findProperty("flixelgdxSrc") as String?)
  ?: "${rootDir}/build/flixelgdx-src"

val flixelgdxSrc = file(flixelgdxSrcPath)

// Auto-discover every flixelgdx-* module that has a src/main directory.
// We pick `java` first (the framework is Java 17) but fall back to other
// sub-folders so the build keeps working if a Kotlin/groovy source set
// gets added later.
data class Mod(val name: String, val sourceRoot: java.io.File)

val modules: List<Mod> = if (flixelgdxSrc.isDirectory) {
  flixelgdxSrc.listFiles { f -> f.isDirectory && f.name.startsWith("flixelgdx-") }
    .orEmpty()
    .toList()
    .mapNotNull { dir ->
      val mainDir = file("${dir}/src/main")
      if (!mainDir.exists()) return@mapNotNull null
      val javaDir = file("${mainDir}/java")
      val kotlinDir = file("${mainDir}/kotlin")
      val root = when {
        javaDir.isDirectory -> javaDir
        kotlinDir.isDirectory -> kotlinDir
        else -> mainDir.listFiles { f -> f.isDirectory }?.firstOrNull()
      } ?: return@mapNotNull null
      Mod(dir.name, root)
    }
    .sortedBy { it.name }
} else {
  emptyList()
}

tasks.named<DokkaTask>("dokkaGfm") {
  outputDirectory.set(file("${rootDir}/build/dokka-out"))
  moduleName.set("FlixelGDX")

  if (modules.isEmpty()) {
    // No source checkout yet — leave a friendly hint instead of failing.
    doFirst {
      throw GradleException(
        "No flixelgdx-* modules found under $flixelgdxSrc.\n" +
        "Run scripts/build-api.sh, or pass -PflixelgdxSrc=/path/to/flixelgdx."
      )
    }
  }

  dokkaSourceSets {
    modules.forEach { mod ->
      register(mod.name) {
        displayName.set(mod.name)
        sourceRoots.from(mod.sourceRoot)
        jdkVersion.set(17)
        noStdlibLink.set(true)
        noJdkLink.set(false)
        reportUndocumented.set(false)
        skipEmptyPackages.set(true)
      }
    }
  }
}

// Print the discovered modules at configuration time so contributors get a
// clear "this is what I'm about to render" line in the build log.
gradle.taskGraph.whenReady {
  if (allTasks.any { it.name == "dokkaGfm" }) {
    logger.lifecycle("FlixelGDX Dokka source: $flixelgdxSrcPath")
    if (modules.isEmpty()) {
      logger.lifecycle("  (no modules discovered — clone the framework first)")
    } else {
      modules.forEach { logger.lifecycle("  • ${it.name} -> ${it.sourceRoot}") }
    }
  }
}
