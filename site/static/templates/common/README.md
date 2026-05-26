# {{GAME_NAME}}

Welcome! This folder is a tiny, runnable FlixelGDX starter. The big idea is simple:
your gameplay code lives in the `core` module, and the `lwjgl3` (or `teavm`) module is only the launcher.

This zip was created by the project generator at
https://flixelgdx.github.io/flixelgdx-website/docs/getting-started.

## 1. Install a JDK

{{JDK_README_BODY}}

Confirm the install: `java -version` in a fresh terminal.

> Any JDK 8+ on PATH is enough to bootstrap Gradle. The build
> auto-downloads the **{{JDK_VENDOR_LABEL}}** toolchain via Gradle's
> Foojay Toolchains Resolver on first run.

{{IDE_README_BODY}}

## 3. Run your game

{{RUN_README_BODY}}
This project ships the Gradle 9.5.1 wrapper (see `gradle/wrapper/gradle-wrapper.properties`).
Gradle wrapper scripts are bundled. You do not need to install Gradle separately.
First build downloads dependencies (and, if needed, the JDK).

### If Gradle reports an unknown plugin / unresolved plugin artifact

FlixelGDX publishes Gradle plugins to JitPack under coordinates like
`com.github.flixelgdx.flixelgdx:flixelgdx-teavm-plugin:<version>`, while
the **plugin IDs** remain `me.stringdotjar.flixelgdx.teavm` (logging:
`me.stringdotjar.flixelgdx.logging`). The generated `settings.gradle`
maps those IDs to JitPack so the `plugins {}` DSL works.
If this block is missing, copy it from
[COMPILING.md](https://github.com/flixelgdx/flixelgdx/blob/master/COMPILING.md)
in the framework repo.

## What you picked

  - Language        : {{LANGUAGE}}
  - Java target     : {{JAVA_VERSION}}
  - JDK vendor      : {{JDK_VENDOR_LABEL}}
  - FlixelGDX       : {{FLIXEL_VERSION}} (pulled from JitPack)
  - Default heap    : {{HEAP_MB}} MB
  - Platforms       : {{PLATFORMS_CSV}}
  - Template        : {{TEMPLATE_LABEL}}
  - IDE             : {{IDE_LABEL}}

## Project layout

    core/         gameplay code (states, sprites, logic)
    assets/       shared art, audio, and data (starts empty with .gitkeep so Git keeps the folder)
{{README_LAYOUT_MODULE_LINES}}
    .editorconfig formatting rules (2-space indent, LF, and trailing whitespace trim)
    gradlew[.bat] Gradle wrapper bootstrap

## Native image (optional)

If you enabled GraalVM native image support (`enableGraalNative=true`), you can compile
your game to a standalone binary with no JVM required.

    ./gradlew :lwjgl3:nativeCompile

The binary lands in `lwjgl3/build/native/nativeCompile/`.

### Adding libraries that use JNI or reflection

FlixelGDX's built-in libraries (imgui, miniaudio) are already configured. If you add a
third-party library that uses JNI or reflection, you need to record what it accesses:

  1. Run the config generator:

         ./gradlew :lwjgl3:generateNativeConfig

  2. Play through every feature in your game that the new library is involved in.
  3. Close the game window. The recorded configuration is automatically merged into
     `lwjgl3/src/main/resources/META-INF/native-image/` and picked up by the next build.

The generator only records code paths that actually execute, so make sure to exercise
every screen and feature that touches the library during step 2.

## Learn more

  - Pong tutorial : https://flixelgdx.github.io/flixelgdx-website/docs/your-first-project
  - API reference : https://flixelgdx.github.io/flixelgdx-website/api/
  - GitHub        : https://github.com/flixelgdx/flixelgdx
