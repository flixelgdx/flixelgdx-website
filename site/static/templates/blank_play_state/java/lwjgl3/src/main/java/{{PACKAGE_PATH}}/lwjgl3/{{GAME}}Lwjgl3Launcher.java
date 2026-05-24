package {{PACKAGE}}.lwjgl3;

import me.stringdotjar.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher;
import {{PACKAGE}}.{{GAME}}Game;

/**
 * Desktop entry point.
 * <p>
 * FlixelLwjgl3Launcher wires libGDX, logging, and window events for you.
 * <p>
 * StartupHelper (same package) restarts the JVM on macOS and NVIDIA Linux when needed.
 * If it returns true, stop here -- the real launch will happen in the child process.
 */
public final class {{GAME}}Lwjgl3Launcher {

  private {{GAME}}Lwjgl3Launcher() {}
  public static void main(String[] args) {
    if (StartupHelper.startNewJvmIfRequired()) {
      return;
    }
    FlixelLwjgl3Launcher.launch(new {{GAME}}Game());
  }
}
