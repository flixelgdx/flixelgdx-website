/*
 * Root Gradle settings for the flixelgdx-website repository.
 *
 * The website itself is a Docusaurus (Node) project. API docs are generated
 * by running scripts/build-api.sh (CI) or by running:
 *
 *   ./gradlew :docletmd:generateDocletMDAll -PflixelgdxSrc=/path/to/flixelgdx
 *
 * Both paths delegate to scripts/docletmd-init.gradle, which applies DocletMD
 * to the framework's own Gradle build so all source sets and classpaths are
 * resolved correctly.
 *
 * If ../DocletMD exists alongside this repo, the generateDocletMDAll task
 * auto-publishes it to mavenLocal so local changes to the plugin take effect
 * without a manual publish step.
 */

rootProject.name = "flixelgdx-website"
include("docletmd")
