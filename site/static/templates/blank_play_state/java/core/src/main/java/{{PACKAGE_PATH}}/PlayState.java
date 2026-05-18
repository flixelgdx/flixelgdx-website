package {{PACKAGE}};

import me.stringdotjar.flixelgdx.Flixel;
import me.stringdotjar.flixelgdx.FlixelState;

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
 * Flixel.switchState(new MyOtherState()) from anywhere after Flixel has started.
 */
public final class PlayState extends FlixelState {

  @Override
  public void create() {
    super.create();
    Flixel.log.info("PlayState is ready. Add a FlixelSprite here when you want something on screen.");
  }

  @Override
  public void update(float elapsed) {
    super.update(elapsed);
  }
}
