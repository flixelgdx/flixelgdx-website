package {{PACKAGE}}

import me.stringdotjar.flixelgdx.Flixel
import me.stringdotjar.flixelgdx.FlixelState

/**
 * Your first FlixelState (think of it as one "screen" of your game).
 * <p>
 * What to try first:
 * <p>
 * Put setup code in create(). It runs once when this state starts.
 * <p>
 * Put movement and rules in update(elapsed). It runs every frame.
 * <p>
 * When you want a new screen, create another FlixelState subclass and call
 * Flixel.switchState(MyOtherState()) from anywhere after Flixel has started.
 */
class PlayState : FlixelState() {

  override fun create() {
    super.create()
    Flixel.info("PlayState is ready. Add a FlixelSprite here when you want something on screen.")
  }

  override fun update(elapsed: Float) {
    super.update(elapsed)
  }
}
