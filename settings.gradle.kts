/*
 * Root Gradle settings for the flixelgdx-website repository.
 *
 * The website itself is a Docusaurus (Node) project. API docs are generated
 * by running scripts/build-api.sh, which shallow-clones the framework and
 * applies scripts/docletmd-init.gradle to its Gradle build. No Gradle
 * subprojects are needed in this repo.
 */
rootProject.name = "flixelgdx-website"
