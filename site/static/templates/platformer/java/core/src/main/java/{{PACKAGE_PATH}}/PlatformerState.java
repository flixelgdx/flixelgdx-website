package {{PACKAGE}};

import com.badlogic.gdx.graphics.Color;
import me.stringdotjar.flixelgdx.Flixel;
import me.stringdotjar.flixelgdx.FlixelObject;
import me.stringdotjar.flixelgdx.FlixelSprite;
import me.stringdotjar.flixelgdx.FlixelState;
import me.stringdotjar.flixelgdx.input.keyboard.FlixelKey;

/**
 * Starter platformer scene: gravity, horizontal run, jump, and a solid floor.
 * <p>
 * The floor is an immovable {@link FlixelSprite} so {@link Flixel#collide} can separate the player from it.
 * <p>
 * The player uses {@link FlixelObject} kinematics ({@code setAccelerationY}, {@code setDragX},
 * {@code setVelocityY}) instead of editing {@code x}/{@code y} by hand, which matches how FlixelGDX
 * expects motion to work.
 * <p>
 * Jump checks {@link FlixelObject#isTouching(int)} with {@link FlixelObject.DirectionFlags#FLOOR} before
 * {@code super.update} clears last frame's contact flags.
 */
public class PlatformerState extends FlixelState {

  private static final float FLOOR_TOP = 480f - 32f;

  private FlixelSprite floor;
  private FlixelSprite player;

  @Override
  public void create() {
    super.create();
    floor = new FlixelSprite(0f, FLOOR_TOP);
    floor.makeGraphic(640, 32, new Color(0.32f, 0.32f, 0.36f, 1f));
    floor.setImmovable(true);
    floor.setMoves(false);
    add(floor);

    player = new FlixelSprite(72f, 120f);
    player.makeGraphic(20, 20, new Color(0.35f, 0.62f, 1f, 1f));
    player.setAccelerationY(820f);
    player.setDragX(1800f);
    player.setMaxVelocityX(260f);
    player.setMaxVelocityY(560f);
    add(player);
    Flixel.info("Use left/right and Space to jump. The strip at the bottom is solid ground.");
  }

  @Override
  public void update(float elapsed) {
    float ax = 0f;
    if (Flixel.keys.pressed(FlixelKey.LEFT)) {
      ax = -3200f;
    } else if (Flixel.keys.pressed(FlixelKey.RIGHT)) {
      ax = 3200f;
    }
    player.setAccelerationX(ax);

    if (Flixel.keys.justPressed(FlixelKey.SPACE)
        && player.isTouching(FlixelObject.DirectionFlags.FLOOR)) {
      player.setVelocityY(-340f);
    }

    super.update(elapsed);
    Flixel.collide(floor, player);
  }
}
