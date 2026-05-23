package {{PACKAGE}}

import me.stringdotjar.flixelgdx.FlixelGame

/**
 * Your game entry class.
 *
 * FlixelGame owns the window settings and picks the first FlixelState.
 *
 * If you are new here, start in PlayState.groovy. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
final class {{GAME}}Game extends FlixelGame {

  {{GAME}}Game() {
    super("{{GAME_NAME_ESC_KOTLIN}}", 640, 480, new PlayState())
  }
}
