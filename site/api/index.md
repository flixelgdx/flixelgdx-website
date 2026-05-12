---
id: index
slug: /
title: API Reference
sidebar_position: 1
---

# FlixelGDX API Reference

This is the live API reference for the **FlixelGDX** framework. It is
generated automatically from the framework's Java sources using the
[Dokka GFM plugin](https://github.com/Kotlin/dokka) every time the
[`master`](https://github.com/flixelgdx/flixelgdx) branch is updated.

> **Heads up:** if you opened this page right after a fresh clone of the
> website, the generated `core/`, `common/`, `jvm/`, `lwjgl3/` and other
> module folders may not yet be present. They are produced by the
> `update-api` CI workflow (or by running
> [`scripts/build-api.sh`](https://github.com/flixelgdx/flixelgdx-website/blob/main/scripts/build-api.sh)
> locally) and dropped next to this file.

## Modules

When the API has been generated, you will see the following modules in the
sidebar:

- **`flixelgdx-core`** — The framework heart: entities, states, cameras,
  tweens, timers, input action sets, saves, debug overlay, and asset helpers.
- **`flixelgdx-common`** — Shared JVM helpers used by multiple backends.
- **`flixelgdx-jvm`** — JVM-only utilities (stack traces, the JVM log file
  handler, the JVM runtime probe).
- **`flixelgdx-lwjgl3`** — Desktop LWJGL3 launcher glue (window listeners,
  debug overlays, mouse icons, host integrations).
- **`flixelgdx-teavm`** — TeaVM browser backend.
- **`flixelgdx-android`** / **`flixelgdx-ios`** — Mobile launchers
  (Android & iOS backends are still in active development).
- **`flixelgdx-teavm-plugin`** / **`flixelgdx-logging-plugin`** — Gradle
  tooling for browser builds and logger bytecode weaving.

## Navigating the docs

The API page is styled to match a Javadoc layout: classes have their author,
properties, and methods listed in clearly separated sections, hyperlinks
between types work the same way they do in `javadoc`, and `<p>`-spaced
paragraphs render with the usual visual rhythm. Code samples are shown in
the same Java syntax you would see in your IDE.

If you spot something wrong in the API docs, please
[file an issue](https://github.com/flixelgdx/flixelgdx/issues) against the
**framework** repository — the API output is regenerated from there.
