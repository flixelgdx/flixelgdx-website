package {{PACKAGE}}

import me.stringdotjar.flixelgdx.Flixel
import me.stringdotjar.flixelgdx.FlixelState

/**
 * Your first FlixelState (think of it as one "screen" of your game).
 *
 * When you want a new screen, create another FlixelState subclass and call
 * `Flixel.switchState(MyOtherState())` from anywhere after Flixel has started.
 */
class PlayState : FlixelState() {

  override fun create() {
    super.create()
  }

  override fun update(elapsed: Float) {
    super.update(elapsed)
  }
}
