package {{PACKAGE}}

import me.stringdotjar.flixelgdx.Flixel
import me.stringdotjar.flixelgdx.FlixelState

/**
 * Your first FlixelState (think of it as one "screen" of your game).
 *
 * What to try first:
 *
 * Put setup code in create(). It runs once when this state starts.
 *
 * Put movement and rules in update(elapsed). It runs every frame.
 *
 * When you want a new screen, create another FlixelState subclass and call
 * Flixel.switchState(new MyOtherState()) from anywhere after Flixel has started.
 */
final class PlayState extends FlixelState {

  @Override
  void create() {
    super.create()
    Flixel.info("PlayState is ready. Add a FlixelSprite here when you want something on screen.")
  }

  @Override
  void update(float elapsed) {
    super.update(elapsed)
  }
}
