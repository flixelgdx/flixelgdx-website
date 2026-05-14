/*
 * Root Gradle settings for the flixelgdx-website repository.
 *
 * The website itself is a Docusaurus (Node) project — this Gradle build only
 * exists so contributors can run the Dokka GFM API generator without
 * installing a system Gradle. Open the repo in IntelliJ IDEA, click "Import
 * Gradle Project" if prompted, and the bundled wrapper handles the rest.
 */
rootProject.name = "flixelgdx-website"

include(":dokka")
