package {{PACKAGE}}.lwjgl3

import com.badlogic.gdx.backends.lwjgl3.StartupHelper
import me.stringdotjar.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher
import {{PACKAGE}}.{{GAME}}Game

/**
 * Desktop entry point.
 * <p>
 * FlixelLwjgl3Launcher wires libGDX, logging, and window events for you.
 * <p>
 * StartupHelper lives in com.badlogic.gdx.backends.lwjgl3 on the classpath (gdx-backend-lwjgl3).
 * It can restart the JVM on some desktops when it needs special flags. If it returns true, stop here.
 */
fun main() {
  if (StartupHelper.startNewJvmIfRequired()) {
    return
  }
  FlixelLwjgl3Launcher.launch({{GAME}}Game())
}
