package {{PACKAGE}};

import me.stringdotjar.flixelgdx.FlixelGame;

/**
 * Your game entry class.
 * <p>
 * FlixelGame owns the window settings and picks the first FlixelState.
 * <p>
 * If you are new here, start in PlayState.java. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
public final class {{GAME}} extends FlixelGame {

  public {{GAME}}() {
    super("{{GAME_NAME_ESC_JAVA}}", 640, 480, new PlayState());
  }
}
