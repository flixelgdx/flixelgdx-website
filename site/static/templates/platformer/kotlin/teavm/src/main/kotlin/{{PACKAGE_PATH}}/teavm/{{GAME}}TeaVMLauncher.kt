package {{PACKAGE}}.teavm

import me.stringdotjar.flixelgdx.backend.teavm.FlixelTeaVMLauncher
import {{PACKAGE}}.{{GAME}}Game

/**
 * Browser entry point.
 * <p>
 * TeaVM turns your JVM bytecode into JavaScript.
 * <p>
 * FlixelTeaVMLauncher connects that web runtime to your FlixelGame.
 */
fun main() {
  FlixelTeaVMLauncher.launch({{GAME}}Game())
}
