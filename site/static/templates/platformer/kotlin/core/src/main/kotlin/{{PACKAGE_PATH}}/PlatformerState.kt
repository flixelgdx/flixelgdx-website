package {{PACKAGE}}

import com.badlogic.gdx.graphics.Color
import me.stringdotjar.flixelgdx.Flixel
import me.stringdotjar.flixelgdx.FlixelObject
import me.stringdotjar.flixelgdx.FlixelSprite
import me.stringdotjar.flixelgdx.FlixelState
import me.stringdotjar.flixelgdx.input.keyboard.FlixelKey

/**
 * Starter platformer scene: gravity, horizontal run, jump, and a solid floor.
 * <p>
 * Same ideas as the Java template: immovable floor, {@code Flixel.collide}, kinematic fields on
 * {@code FlixelObject}, and a floor touch check before {@code super.update}.
 */
class PlatformerState : FlixelState() {

  companion object {
    private const val FLOOR_TOP = 480f - 32f
  }

  private lateinit var floor: FlixelSprite
  private lateinit var player: FlixelSprite

  override fun create() {
    super.create()
    floor = FlixelSprite(0f, FLOOR_TOP).apply {
      makeGraphic(640, 32, Color(0.32f, 0.32f, 0.36f, 1f))
      setImmovable(true)
      setMoves(false)
    }
    add(floor)

    player = FlixelSprite(72f, 120f).apply {
      makeGraphic(20, 20, Color(0.35f, 0.62f, 1f, 1f))
      setAccelerationY(820f)
      setDragX(1800f)
      setMaxVelocityX(260f)
      setMaxVelocityY(560f)
    }
    add(player)
    Flixel.info("Use left/right and Space to jump. The strip at the bottom is solid ground.")
  }

  override fun update(elapsed: Float) {
    var ax = 0f
    if (Flixel.keys.pressed(FlixelKey.LEFT)) {
      ax = -3200f
    } else if (Flixel.keys.pressed(FlixelKey.RIGHT)) {
      ax = 3200f
    }
    player.setAccelerationX(ax)

    if (Flixel.keys.justPressed(FlixelKey.SPACE)
        && player.isTouching(FlixelObject.DirectionFlags.FLOOR)) {
      player.setVelocityY(-340f)
    }

    super.update(elapsed)
    Flixel.collide(floor, player)
  }
}
