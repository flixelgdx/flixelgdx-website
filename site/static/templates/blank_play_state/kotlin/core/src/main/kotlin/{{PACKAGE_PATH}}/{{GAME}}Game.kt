package {{PACKAGE}}

import org.flixelgdx.FlixelGame

/**
 * Your game entry class.
 *
 * FlixelGame owns the window settings and picks the first FlixelState.
 *
 * If you are new here, start in PlayState.kt. That file is where you spawn sprites,
 * load sounds, and write your first update loop.
 */
class {{GAME}}Game : FlixelGame("{{GAME_NAME_ESC}}", 640, 480, PlayState())
