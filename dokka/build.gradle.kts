/*
 * Dokka build for the FlixelGDX API reference.
 *
 * Generates one GFM markdown tree **per framework module** so the
 * website can expose a "Module" dropdown (Core / Desktop / Web / …)
 * and so each module's sidebar lists only its own packages.
 *
 * Two key Dokka features are wired in:
 *
 *  • **kotlin-as-java-plugin**: makes Dokka render every declaration
 *    using Java syntax. The framework IS Java, but Dokka's default
 *    renderer still emits Kotlin-shape (`var x: Int`, `fun foo(): X`,
 *    `class A : B`). The official `kotlin-as-java-plugin` flips that
 *    so we get real `int x;`, `X foo()`, `class A extends B
 *    implements C` etc. — including the right keyword for interfaces.
 *
 *  • **sourceLink**: every declaration in the rendered Markdown gets
 *    a link back to its exact line in `flixelgdx/flixelgdx@master` on
 *    GitHub. The post-processor surfaces those as "View Source"
 *    buttons.
 *
 * Why we register one task per module instead of using `dokkaSourceSets`
 * inside a single task: Dokka merges multiple source-sets into a SINGLE
 * documentation model, so the rendered Markdown ends up flat with no
 * way for the website to tell which module a given class came from.
 * Per-module tasks give us per-module folders we can map onto the
 * "Module" dropdown one-to-one.
 */
import org.jetbrains.dokka.gradle.DokkaTask
import java.net.URI

plugins {
  id("org.jetbrains.dokka") version "1.9.20"
}

repositories {
  mavenCentral()
}

// Plugin classpath shared by every Dokka task we register. We need BOTH:
//
//   1. dokka-gfm-plugin   — provides the GFM renderer
//   2. kotlin-as-java     — converts Kotlin AST into Java-shaped output
//
// Each per-module task gets these jars attached via `plugins.from(...)`.
val dokkaPluginClasspath: Configuration = configurations.create("dokkaPluginClasspath") {
  isCanBeResolved = true
  isCanBeConsumed = false
}

dependencies {
  dokkaPluginClasspath("org.jetbrains.dokka:gfm-plugin:1.9.20")
  dokkaPluginClasspath("org.jetbrains.dokka:kotlin-as-java-plugin:1.9.20")
}

val flixelgdxSrcPath = (project.findProperty("flixelgdxSrc") as String?)
  ?: "${rootDir}/build/flixelgdx-src"
val flixelgdxSrc = file(flixelgdxSrcPath)

/**
 * The five framework modules we expose as separate API trees. Order
 * matters: it controls the dropdown order on the website.
 */
val modules: List<Pair<String, String>> = listOf(
  "core"    to "flixelgdx-core",
  "lwjgl3"  to "flixelgdx-lwjgl3",
  "teavm"   to "flixelgdx-teavm",
  "android" to "flixelgdx-android",
  "ios"     to "flixelgdx-ios",
)

fun srcRoot(moduleDir: String): File? {
  val main = file("${flixelgdxSrc}/${moduleDir}/src/main")
  if (!main.exists()) return null
  val candidates = listOf(file("${main}/java"), file("${main}/kotlin"))
  candidates.firstOrNull { it.isDirectory }?.let { return it }
  return main.listFiles { f -> f.isDirectory }?.firstOrNull()
}

/**
 * Register one Dokka task per module. We attach both the GFM renderer
 * and the kotlin-as-java transformer to each task's plugin classpath.
 */
val perModuleTasks: List<TaskProvider<DokkaTask>> = modules.mapNotNull { (slug, dir) ->
  val src = srcRoot(dir) ?: return@mapNotNull null
  val taskName = "dokkaGfm_${slug}"
  val task = tasks.register<DokkaTask>(taskName) {
    description = "Generate Dokka GFM for the $dir module."
    outputDirectory.set(file("${rootDir}/build/dokka-out/${slug}"))
    moduleName.set(dir)
    // Attach GFM renderer + kotlin-as-java transformer to this task.
    // `plugins` on AbstractDokkaTask is a Configuration we extend.
    (this.plugins as org.gradle.api.artifacts.Configuration)
      .dependencies.add(project.dependencies.create(dokkaPluginClasspath))
    dokkaSourceSets {
      register(dir) {
        displayName.set(dir)
        sourceRoots.from(src)
        jdkVersion.set(17)
        noStdlibLink.set(true)
        noJdkLink.set(false)
        reportUndocumented.set(false)
        skipEmptyPackages.set(true)
        sourceLink {
          localDirectory.set(src)
          remoteUrl.set(
            URI("https://github.com/flixelgdx/flixelgdx/blob/master/${dir}/src/main/java").toURL()
          )
          remoteLineSuffix.set("#L")
        }
      }
    }
  }
  task
}

// Disable the default `dokkaGfm` task — we use per-module tasks aggregated
// by `dokkaGfmAll` below. Leaving the default enabled would re-render the
// HTML/GFM merge at the root and cost ~20 s for nothing.
tasks.named<DokkaTask>("dokkaGfm") { enabled = false }
tasks.named<DokkaTask>("dokkaHtml") { enabled = false }
tasks.named<DokkaTask>("dokkaJavadoc") { enabled = false }
tasks.named<DokkaTask>("dokkaJekyll") { enabled = false }

/**
 * Aggregator task — running `./gradlew :dokka:dokkaGfmAll` builds every
 * module. The shell wrapper `scripts/build-api.sh` invokes this.
 */
tasks.register("dokkaGfmAll") {
  group = "documentation"
  description = "Build the GFM API reference for every FlixelGDX module."
  dependsOn(perModuleTasks)
  doLast {
    if (perModuleTasks.isEmpty()) {
      throw GradleException(
        "No flixelgdx-* modules found under $flixelgdxSrc.\n" +
        "Run scripts/build-api.sh, or pass -PflixelgdxSrc=/path/to/flixelgdx."
      )
    }
    perModuleTasks.forEach {
      logger.lifecycle("  ✓ ${it.name} → build/dokka-out/${it.name.removePrefix("dokkaGfm_")}")
    }
  }
}

gradle.taskGraph.whenReady {
  if (allTasks.any { it.name == "dokkaGfmAll" }) {
    logger.lifecycle("FlixelGDX Dokka source: $flixelgdxSrcPath")
    if (perModuleTasks.isEmpty()) {
      logger.lifecycle("  (no modules discovered — clone the framework first)")
    } else {
      logger.lifecycle("  Modules: " + perModuleTasks.joinToString { it.name.removePrefix("dokkaGfm_") })
    }
  }
}
