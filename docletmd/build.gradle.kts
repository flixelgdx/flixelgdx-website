/*
 * DocletMD local runner for the FlixelGDX API reference.
 *
 * Runs DocletMD against the framework source, then copies the result into
 * site/api/ so Docusaurus can serve it immediately.
 *
 * Quick start (framework checked out at ../flixelgdx):
 *   ./gradlew generateAPI
 *
 * Framework source elsewhere:
 *   ./gradlew generateAPI -PflixelgdxSrc=/absolute/path/to/flixelgdx
 *
 * If ../DocletMD is checked out alongside this repo, the task builds the plugin
 * from source (no mavenLocal publish needed). Otherwise the version pinned below
 * is resolved from Maven Central.
 */

/** Walks a directory downward while each level has exactly one child directory. */
fun stripSingleChildPrefix(dir: File): File {
    var current = dir
    while (true) {
        val children = current.listFiles() ?: break
        if (children.size != 1 || !children[0].isDirectory) break
        current = children[0]
    }
    return current
}

tasks.register("generateDocletMDAll") {
    group = "documentation"
    description = "Generate DocletMD API docs for all FlixelGDX modules and copy to site/api/."

    doLast {
        // Resolve the framework source directory.
        // Priority: explicit -PflixelgdxSrc > sibling ../flixelgdx checkout > cached clone.
        val flixelgdxSrc = (project.findProperty("flixelgdxSrc") as String?)
            ?: run {
                val sibling = rootProject.file("../flixelgdx")
                if (sibling.isDirectory) sibling.absolutePath
                else "${rootProject.projectDir}/build/flixelgdx-src"
            }
        val srcDir = file(flixelgdxSrc)

        if (!srcDir.isDirectory) {
            throw GradleException(
                "Framework source not found at $flixelgdxSrc.\n" +
                "Pass -PflixelgdxSrc=/path/to/flixelgdx, or run scripts/build-api.sh to clone it."
            )
        }

        // If the local DocletMD checkout is present, build its runtime JARs directly instead
        // of publishing to mavenLocal. This is faster and does not touch ~/.m2.
        val docletMDDir = rootProject.file("../DocletMD")
        val docletmdArgs: List<String> = if (docletMDDir.isDirectory) {
            logger.lifecycle("Building local DocletMD runtime JARs...")
            exec {
                workingDir = docletMDDir
                commandLine("${docletMDDir.absolutePath}/gradlew", "collectRuntimeJars", "--no-daemon", "-q")
            }
            val jarDir = file("${docletMDDir}/build/runtime-jars")
            logger.lifecycle("Using local DocletMD from ${jarDir.absolutePath}")
            listOf("-PdocletmdJarDir=${jarDir.absolutePath}")
        } else {
            emptyList()
        }

        // Delete the previous output so the generateDocletMD tasks cannot be UP-TO-DATE.
        // Gradle tracks the framework source and classpath as inputs but not the plugin JAR
        // (which arrives via the init script), so without this, plugin changes are ignored.
        val outDir = layout.buildDirectory.dir("docletmd-out").get().asFile
        outDir.deleteRecursively()
        outDir.mkdirs()
        val initScript = rootProject.file("scripts/docletmd-init.gradle")

        logger.lifecycle("Running DocletMD against $flixelgdxSrc...")
        exec {
            workingDir = srcDir
            commandLine(buildList {
                add("${srcDir.absolutePath}/gradlew")
                add("-I"); add(initScript.absolutePath)
                add("-PdocletmdOutDir=${outDir.absolutePath}")
                addAll(docletmdArgs)
                add("--no-daemon")
                add(":flixelgdx-core:generateDocletMD")
                add(":flixelgdx-lwjgl3:generateDocletMD")
                add(":flixelgdx-teavm:generateDocletMD")
            })
        }

        // Copy output into site/api/, stripping the leading package path prefix
        // (e.g. org/flixelgdx/) so the Docusaurus sidebar root starts at useful content.
        // Mirrors what scripts/build-api.sh does for CI.
        val siteApiDir = rootProject.file("site/api")
        val indexText = siteApiDir.resolve("index.md").takeIf { it.exists() }?.readText()
        siteApiDir.listFiles { f -> f.isDirectory }?.forEach { it.deleteRecursively() }
        siteApiDir.mkdirs()

        for (slug in listOf("core", "lwjgl3", "teavm")) {
            val src = outDir.resolve(slug)
            if (!src.isDirectory) continue
            val stripped = stripSingleChildPrefix(src)
            val dest = siteApiDir.resolve(slug)
            dest.mkdirs()
            stripped.listFiles()?.forEach { it.copyRecursively(dest.resolve(it.name), overwrite = true) }
            // _category_.json in each subdirectory positions package folders above class files.
            dest.walkTopDown().filter { it.isDirectory && it != dest }.forEach { dir ->
                dir.resolve("_category_.json").writeText("""{"label":"${dir.name}","position":-1}""")
            }
            logger.lifecycle("  -> site/api/$slug/")
        }
        indexText?.let { siteApiDir.resolve("index.md").writeText(it) }

        logger.lifecycle("Done. API docs are now in site/api/")
    }
}
