/*
 * DocletMD local runner for the FlixelGDX API reference.
 *
 * Delegates to the same init script that CI uses (scripts/docletmd-init.gradle),
 * running it against a local framework checkout. This ensures local and CI docs
 * are always generated via the exact same code path.
 *
 * Usage:
 *   ./gradlew :docletmd:generateDocletMDAll -PflixelgdxSrc=/path/to/flixelgdx
 *
 * If ../DocletMD exists alongside this repo, the task auto-publishes it to
 * mavenLocal before invoking the init script, so local changes to the plugin
 * take effect immediately without a manual publish step.
 *
 * Output lands under docletmd/build/docletmd-out/<module>/.
 * Run scripts/build-api.sh to also copy the result into site/api/.
 */

tasks.register("generateDocletMDAll") {
    group = "documentation"
    description = "Generate DocletMD API docs for all FlixelGDX modules via the framework's own Gradle build."

    doLast {
        val flixelgdxSrc: String = (project.findProperty("flixelgdxSrc") as String?)
            ?: "${rootProject.projectDir}/build/flixelgdx-src"
        val srcDir = file(flixelgdxSrc)

        if (!srcDir.isDirectory) {
            throw GradleException(
                "Framework source not found at $flixelgdxSrc\n" +
                "Pass -PflixelgdxSrc=/path/to/flixelgdx, or run scripts/build-api.sh to clone it."
            )
        }

        // If the local DocletMD repo is checked out alongside this one, publish it
        // to mavenLocal so the init script resolves the local version instead of
        // whatever is on Maven Central.
        val docletMDDir = rootProject.file("../DocletMD")
        if (docletMDDir.isDirectory) {
            logger.lifecycle("Found local DocletMD checkout -- publishing to mavenLocal...")
            exec {
                workingDir = docletMDDir
                commandLine(
                    "${docletMDDir.absolutePath}/gradlew",
                    "publishToMavenLocal",
                    "--no-daemon",
                    "-q"
                )
            }
        }

        val outDir = layout.buildDirectory.dir("docletmd-out").get().asFile.also { it.mkdirs() }
        val initScript = rootProject.file("scripts/docletmd-init.gradle")

        logger.lifecycle("Running DocletMD against $flixelgdxSrc...")
        exec {
            workingDir = srcDir
            commandLine(
                "${srcDir.absolutePath}/gradlew",
                "-I", initScript.absolutePath,
                "-PdocletmdOutDir=${outDir.absolutePath}",
                "--no-daemon",
                ":flixelgdx-core:generateDocletMD",
                ":flixelgdx-lwjgl3:generateDocletMD",
                ":flixelgdx-teavm:generateDocletMD"
            )
        }

        logger.lifecycle("DocletMD output -> ${outDir.absolutePath}")
    }
}
