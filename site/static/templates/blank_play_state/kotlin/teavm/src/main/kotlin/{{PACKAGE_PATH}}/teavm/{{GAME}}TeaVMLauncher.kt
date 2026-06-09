package {{PACKAGE}}.teavm

import org.flixelgdx.backend.teavm.FlixelTeaVMLauncher
import {{PACKAGE}}.{{GAME}}Game

/**
 * Browser entry point.
 *
 * TeaVM turns your JVM bytecode into JavaScript.
 *
 * FlixelTeaVMLauncher connects that web runtime to your FlixelGame.
 */
fun main() {
  FlixelTeaVMLauncher.launch({{GAME}}Game())
}
