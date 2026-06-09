package {{PACKAGE}}.teavm;

import org.flixelgdx.backend.teavm.FlixelTeaVMLauncher;
import {{PACKAGE}}.{{GAME}}Game;

/**
 * Browser entry point.
 * <p>
 * TeaVM turns your JVM bytecode into JavaScript.
 * <p>
 * FlixelTeaVMLauncher connects that web runtime to your FlixelGame.
 */
public final class {{GAME}}TeaVMLauncher {

  public static void main(String[] args) {
    FlixelTeaVMLauncher.launch(new {{GAME}}Game());
  }

  private {{GAME}}TeaVMLauncher() {}
}
