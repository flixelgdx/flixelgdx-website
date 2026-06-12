/*
 * Root Gradle settings for the flixelgdx-website repository.
 *
 * The website itself is a Docusaurus (Node) project. API docs are generated
 * by the :docletmd:generateDocletMDAll task (surfaced as generateAPI at the root),
 * which delegates to scripts/docletmd-init.gradle applied to the framework's own
 * Gradle build so all source sets and compile classpaths are resolved correctly.
 *
 * Local development (framework checked out at ../flixelgdx):
 *   ./gradlew generateAPI
 *
 * Framework source elsewhere:
 *   ./gradlew generateAPI -PflixelgdxSrc=/absolute/path/to/flixelgdx
 *
 * If ../DocletMD is also checked out, the plugin is built from source automatically
 * (no mavenLocal publish needed). Otherwise the version pinned in the init script
 * is resolved from Maven Central (used by CI).
 *
 * scripts/build-api.sh is the CI entry point: it clones the framework, runs the
 * same init script, and copies output to site/api/. For local work the Gradle
 * task above does all of that in one command.
 */

rootProject.name = "flixelgdx-website"
include("docletmd")
