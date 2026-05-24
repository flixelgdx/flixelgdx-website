package {{PACKAGE}}.lwjgl3

import me.stringdotjar.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher
import {{PACKAGE}}.{{GAME}}Game

/**
 * Desktop entry point.
 *
 * FlixelLwjgl3Launcher wires libGDX, logging, and window events for you.
 *
 * StartupHelper (same package) restarts the JVM on macOS and NVIDIA Linux when needed.
 * If it returns true, stop here -- the real launch will happen in the child process.
 */
fun main() {
  if (StartupHelper.startNewJvmIfRequired()) {
    return
  }
  FlixelLwjgl3Launcher.launch({{GAME}}Game())
}
