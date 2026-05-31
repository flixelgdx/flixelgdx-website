package {{PACKAGE}}.lwjgl3;

import me.stringdotjar.flixelgdx.backend.lwjgl3.FlixelLwjgl3Launcher;
import {{PACKAGE}}.{{GAME}}Game;

/**
 * Desktop entry point.
 *
 * <p>{@code FlixelLwjgl3Launcher} wires libGDX, logging, and window events for you. The {@link StartupHelper} (same package)
 * restarts the JVM on macOS and NVIDIA Linux when needed.
 *
 * <p>If you're new, don't worry about this file too much; focus on the {@code core} folder, as that's where your
 * game's code will live.
 */
public final class {{GAME}}Lwjgl3Launcher {

  public static void main(String[] args) {
    if (StartupHelper.startNewJvmIfRequired()) {
      return;
    }
    FlixelLwjgl3Launcher.launch(new {{GAME}}Game());
  }

  private {{GAME}}Lwjgl3Launcher() {}
}
