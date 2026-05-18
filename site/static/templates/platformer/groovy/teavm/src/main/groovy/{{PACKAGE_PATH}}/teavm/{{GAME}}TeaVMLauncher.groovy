package {{PACKAGE}}.teavm

import me.stringdotjar.flixelgdx.backend.teavm.FlixelTeaVMLauncher
import {{PACKAGE}}.{{GAME}}

/**
 * Browser entry point.
 * <p>
 * TeaVM turns your JVM bytecode into JavaScript.
 * <p>
 * FlixelTeaVMLauncher connects that web runtime to your FlixelGame.
 */
final class {{GAME}}TeaVMLauncher {

  static void main(String[] args) {
    FlixelTeaVMLauncher.launch(new {{GAME}}())
  }
}
