package {{PACKAGE}}.teavm

import me.stringdotjar.flixelgdx.backend.teavm.FlixelTeaVMLauncher
import {{PACKAGE}}.{{GAME}}Game

/**
 * Browser entry point.
 *
 * TeaVM turns your JVM bytecode into JavaScript.
 *
 * FlixelTeaVMLauncher connects that web runtime to your FlixelGame.
 */
final class {{GAME}}TeaVMLauncher {

  static void main(String[] args) {
    FlixelTeaVMLauncher.launch(new {{GAME}}Game())
  }
}
