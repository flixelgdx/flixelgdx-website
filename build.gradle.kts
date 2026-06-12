/*
 * Root build script.
 *
 * Quick start: run `./gradlew generateAPI` from this directory.
 * See docletmd/build.gradle.kts for full documentation and knobs.
 */

tasks.register("generateAPI") {
    group = "documentation"
    description = "Generate API docs and copy to site/api/. Alias for :docletmd:generateDocletMDAll."
    dependsOn(":docletmd:generateDocletMDAll")
}
