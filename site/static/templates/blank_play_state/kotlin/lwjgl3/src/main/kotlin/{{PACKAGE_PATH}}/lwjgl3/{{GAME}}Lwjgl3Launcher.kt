package {{PACKAGE}}.lwjgl3

import org.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher
import {{PACKAGE}}.{{GAME}}Game

/**
 * Desktop entry point.
 *
 * `FlixelLwjgl3Launcher` wires libGDX, logging, and window events for you. The [StartupHelper] (same package)
 * restarts the JVM on macOS and NVIDIA Linux when needed.
 *
 * If you're new, don't worry about this file too much; focus on the `core` folder, as that's where your
 * game's code will live.
 */
fun main() {
  if (StartupHelper.startNewJvmIfRequired()) {
    return
  }
  FlixelLwjgl3Launcher.launch({{GAME}}Game())
}
