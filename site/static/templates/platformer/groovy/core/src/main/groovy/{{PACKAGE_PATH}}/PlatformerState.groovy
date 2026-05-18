package {{PACKAGE}}

import com.badlogic.gdx.graphics.Color
import me.stringdotjar.flixelgdx.Flixel
import me.stringdotjar.flixelgdx.FlixelSprite
import me.stringdotjar.flixelgdx.FlixelState
import me.stringdotjar.flixelgdx.input.keyboard.FlixelKey

/**
 * Tiny starter level with a controllable block.
 * <p>
 * Read this like a mini tutorial:
 * <p>
 * create() runs once when this state becomes active. Build your scene there.
 * <p>
 * update(elapsed) runs every frame. elapsed is seconds since the last frame (use it for smooth motion).
 * <p>
 * FlixelSprite is a simple game object with a position (x, y) you can draw.
 * <p>
 * makeGraphic builds a solid rectangle so you can run the project before you add art.
 * <p>
 * Next experiments: change the color in new Color(0xFF2A3CFF), resize the sprite, or print logs with
 * Flixel.log.info("hello").
 */
final class PlatformerState extends FlixelState {

  FlixelSprite player
  float velocityY = 0f

  @Override
  void create() {
    super.create()
    player = new FlixelSprite(40f, 80f)
    player.makeGraphic(16, 16, new Color(0xFF2A3CFF))
    add(player)
    Flixel.log.info("PlatformerState is running. Use arrow keys and space to move and jump.")
  }

  @Override
  void update(float elapsed) {
    super.update(elapsed)
    velocityY += 320f * elapsed
    if (Flixel.keys.pressed(FlixelKey.LEFT)) {
      player.x -= 90f * elapsed
    }
    if (Flixel.keys.pressed(FlixelKey.RIGHT)) {
      player.x += 90f * elapsed
    }
    if (Flixel.keys.justPressed(FlixelKey.SPACE)) {
      velocityY = -160f
    }
    player.y += velocityY * elapsed
    if (player.y > 200f) {
      player.y = 200f
      velocityY = 0f
    }
  }
}
