package {{PACKAGE}}

import me.stringdotjar.flixelgdx.FlixelGame

/**
 * Your game entry class.
 * <p>
 * FlixelGame owns the window settings and picks the first FlixelState.
 * <p>
 * If you are new here, start in PlayState.kt. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
class {{GAME}} : FlixelGame("{{GAME_NAME_ESC_KOTLIN}}", 640, 480, PlayState())
