/*
 * DocletMD build for the FlixelGDX API reference.
 *
 * Generates one Docusaurus-ready Markdown tree per framework module so the
 * website can expose a "Module" dropdown (Core / Desktop / Web / ...) and so
 * each module's sidebar lists only its own packages.
 *
 * Running `./gradlew :docletmd:generateDocletMDAll` (or the higher-level
 * wrapper `scripts/build-api.sh`) builds every module and writes the output
 * under build/docletmd-out/<module>/.
 *
 * The -PflixelgdxSrc knob lets CI or individual contributors point at an
 * already-cloned framework checkout instead of the default build/ location.
 */
plugins {
    id("me.stringdotjar.docletmd") version "0.1.1"
}

val modules: List<Pair<String, String>> = listOf(
    "core"    to "flixelgdx-core",
    "lwjgl3"  to "flixelgdx-lwjgl3",
    "teavm"   to "flixelgdx-teavm",
    "android" to "flixelgdx-android",
    "ios"     to "flixelgdx-ios",
)

val flixelgdxSrcPath: String = (project.findProperty("flixelgdxSrc") as String?)
    ?: "${rootDir}/build/flixelgdx-src"

fun srcRoot(moduleDir: String): File? {
    val main = file("${flixelgdxSrcPath}/${moduleDir}/src/main")
    if (!main.exists()) return null
    return listOf(main.resolve("java"), main.resolve("kotlin"))
        .firstOrNull { it.isDirectory }
        ?: main.listFiles()?.firstOrNull { it.isDirectory }
}

val perModuleTasks = modules.map { (slug, dir) ->
    tasks.register<me.stringdotjar.docletmd.DocletMDTask>("generateDocletMD_$slug") {
        description = "Generate DocletMD Markdown for the $dir module."
        group = "documentation"
        srcRoot(dir)?.let { sourceDirs.from(it) }
        outputDir.set(layout.buildDirectory.dir("docletmd-out/$slug"))
        includePrivate.set(false)
        skipEmptyDocs.set(false)
    }
}

// Disable the default single-module task the plugin registers; we use per-module tasks instead.
tasks.named("generateDocletMD") { enabled = false }

tasks.register("generateDocletMDAll") {
    group = "documentation"
    description = "Generate DocletMD Markdown for all FlixelGDX modules."
    dependsOn(perModuleTasks)
    doLast {
        val found = perModuleTasks.filter { it.get().sourceDirs.files.isNotEmpty() }
        if (found.isEmpty()) {
            throw GradleException(
                "No flixelgdx-* modules found under $flixelgdxSrcPath.\n" +
                "Run scripts/build-api.sh, or pass -PflixelgdxSrc=/path/to/flixelgdx."
            )
        }
        found.forEach {
            logger.lifecycle("  ok ${it.name} -> build/docletmd-out/${it.name.removePrefix("generateDocletMD_")}")
        }
    }
}

gradle.taskGraph.whenReady {
    if (allTasks.any { it.name == "generateDocletMDAll" }) {
        logger.lifecycle("FlixelGDX DocletMD source: $flixelgdxSrcPath")
        val discovered = modules.filter { (_, dir) -> srcRoot(dir) != null }
        if (discovered.isEmpty()) {
            logger.lifecycle("  (no modules discovered -- clone the framework first)")
        } else {
            logger.lifecycle("  Modules: ${discovered.joinToString { it.first }}")
        }
    }
}
