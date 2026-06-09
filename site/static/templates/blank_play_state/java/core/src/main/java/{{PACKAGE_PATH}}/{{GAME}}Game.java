package {{PACKAGE}};

import org.flixelgdx.FlixelGame;

/**
 * Your game entry class.
 *
 * <p>FlixelGame owns the window settings and picks the first FlixelState.
 * 
 * <p>If you are new here, start in {@link PlayState}. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
public class {{GAME}}Game extends FlixelGame {

  public {{GAME}}Game() {
    super("{{GAME_NAME_ESC_JAVA}}", 640, 480, new PlayState());
  }
}
