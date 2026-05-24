/*
 * Copyright 2020 damios
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at:
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
// Note, the above license and copyright applies to this file only.
package {{PACKAGE}}.lwjgl3

import com.badlogic.gdx.Version
import com.badlogic.gdx.backends.lwjgl3.Lwjgl3NativesLoader
import org.lwjgl.system.JNI
import org.lwjgl.system.linux.UNISTD
import org.lwjgl.system.macosx.LibC
import org.lwjgl.system.macosx.ObjCRuntime
import java.io.File
import java.lang.management.ManagementFactory
import java.util.Locale

/**
 * A helper object for game startup, featuring three utilities related to LWJGL3 on various operating systems.
 *
 * The utilities are as follows:
 *  - Windows: Prevents a common crash related to LWJGL3's extraction of shared library files.
 *  - macOS: Spawns a child JVM process with `-XstartOnFirstThread` in the JVM args (if it was not already).
 *    This is required for LWJGL3 to work on macOS.
 *  - Linux (NVIDIA GPUs only): Spawns a child JVM process with the `__GL_THREADED_OPTIMIZATIONS`
 *    environment variable set to `0` (if it was not already). This is required for LWJGL3 to work
 *    on Linux with NVIDIA GPUs.
 *
 * Based on [this java-gaming.org post by kappa](https://jvm-gaming.org/t/starting-jvm-on-mac-with-xstartonfirstthread-programmatically/57547)
 * @author damios
 */
object StartupHelper {

  private const val JVM_RESTARTED_ARG = "jvmIsRestarted"

  private const val MAC_JRE_ERR_MSG =
    "A Java installation could not be found. If you are distributing this app with a bundled JRE, be sure to set the '-XstartOnFirstThread' argument manually!"
  private const val LINUX_JRE_ERR_MSG =
    "A Java installation could not be found. If you are distributing this app with a bundled JRE, be sure to set the environment variable '__GL_THREADED_OPTIMIZATIONS' to '0'!"
  private const val CHILD_LOOP_ERR_MSG =
    "The current JVM process is a spawned child JVM process, but StartupHelper has attempted to spawn another child JVM process! This is a broken state, and should not normally happen! Your game may crash or not function properly!"

  /**
   * Must only be called on Linux. Check OS first (or use short-circuit evaluation)!
   * @return whether NVIDIA drivers are present on Linux.
   */
  fun isLinuxNvidia(): Boolean {
    val drivers = File("/proc/driver").list { _, name -> name.uppercase(Locale.ROOT).contains("NVIDIA") }
    return drivers != null && drivers.isNotEmpty()
  }

  /**
   * Applies the utilities as described in [StartupHelper]'s KDoc.
   *
   * All environment variables are copied to the child JVM process (if it is spawned); the same applies
   * for system properties.
   *
   * Usage:
   * ```
   * fun main() {
   *   if (StartupHelper.startNewJvmIfRequired()) return
   *   // ... The rest of main() goes here, as normal.
   * }
   * ```
   * @return whether a child JVM process was spawned or not.
   */
  fun startNewJvmIfRequired(): Boolean = startNewJvmIfRequired(true)

  /**
   * Applies the utilities as described in [StartupHelper]'s KDoc.
   *
   * All environment variables are copied to the child JVM process (if it is spawned); the same applies
   * for system properties.
   *
   * @param inheritIO whether I/O should be inherited in the child JVM process. Please note that enabling
   *                  this will block the thread until the child JVM process stops executing.
   * @return whether a child JVM process was spawned or not.
   */
  fun startNewJvmIfRequired(inheritIO: Boolean): Boolean {
    val osName = System.getProperty("os.name").lowercase(Locale.ROOT)
    if (osName.contains("mac")) return startNewJvm0(isMac = true, inheritIO = inheritIO)
    if (osName.contains("windows")) {
      // Working around an issue with how LWJGL3 loads its extracted .dll files.
      // By default, LWJGL3 extracts to the directory specified by "java.io.tmpdir": usually, the user's home.
      // If the user's name has non-ASCII (or some non-alphanumeric) characters in it, that would fail.
      // By extracting to the relevant "ProgramData" folder, which is usually "C:\ProgramData", we avoid this.
      // We also temporarily change the "user.name" property to one without any chars that would be invalid.
      // We revert our changes immediately after loading LWJGL3 natives.
      val programData = System.getenv("ProgramData") ?: "C:\\Temp"
      val prevTmpDir = System.getProperty("java.io.tmpdir", programData)
      val prevUser = System.getProperty("user.name", "libGDX_User")
      System.setProperty("java.io.tmpdir", "$programData\\libGDX-temp")
      System.setProperty(
        "user.name",
        ("User_" + prevUser.hashCode() + "_GDX" + Version.VERSION).replace('.', '_')
      )
      Lwjgl3NativesLoader.load()
      System.setProperty("java.io.tmpdir", prevTmpDir)
      System.setProperty("user.name", prevUser)
      return false
    }
    return startNewJvm0(isMac = false, inheritIO = inheritIO)
  }

  /**
   * Spawns a child JVM process if on macOS, or on Linux with NVIDIA drivers.
   *
   * @param isMac whether the current OS is macOS. If `false` the current OS is assumed to be Linux (and
   *              an immediate check for NVIDIA drivers is performed).
   * @param inheritIO whether I/O should be inherited in the child JVM process. Please note that enabling
   *                  this will block the thread until the child JVM process stops executing.
   * @return whether a child JVM process was spawned or not.
   */
  fun startNewJvm0(isMac: Boolean, inheritIO: Boolean): Boolean {
    val processID = getProcessID(isMac)
    if (!isMac) {
      // No need to restart non-NVIDIA Linux
      if (!isLinuxNvidia()) return false
      // Check whether __GL_THREADED_OPTIMIZATIONS is already disabled
      if ("0" == System.getenv("__GL_THREADED_OPTIMIZATIONS")) return false
    } else {
      // There is no need for -XstartOnFirstThread on Graal native image
      if (System.getProperty("org.graalvm.nativeimage.imagecode", "").isNotEmpty()) return false

      // Checks if we are already on the main thread, such as from running via Construo.
      val objcMsgSend = ObjCRuntime.getLibrary().getFunctionAddress("objc_msgSend")
      val nsThread = ObjCRuntime.objc_getClass("NSThread")
      val currentThread = JNI.invokePPP(nsThread, ObjCRuntime.sel_getUid("currentThread"), objcMsgSend)
      val isMainThread = JNI.invokePPZ(currentThread, ObjCRuntime.sel_getUid("isMainThread"), objcMsgSend)
      if (isMainThread) return false

      if ("1" == System.getenv("JAVA_STARTED_ON_FIRST_THREAD_$processID")) return false
    }

    // Check whether this JVM process is a child JVM process already.
    // This state shouldn't usually be reachable, but this stops us from endlessly spawning new child JVM processes.
    if ("true" == System.getProperty(JVM_RESTARTED_ARG)) {
      System.err.println(CHILD_LOOP_ERR_MSG)
      return false
    }

    // Spawn the child JVM process with updated environment variables or JVM args
    val jvmArgs = mutableListOf<String>()
    val javaExecPath = System.getProperty("java.home") + "/bin/java"
    if (!File(javaExecPath).exists()) {
      System.err.println(getJreErrMsg(isMac))
      return false
    }

    jvmArgs.add(javaExecPath)
    if (isMac) jvmArgs.add("-XstartOnFirstThread")
    jvmArgs.add("-D$JVM_RESTARTED_ARG=true")
    jvmArgs.addAll(ManagementFactory.getRuntimeMXBean().inputArguments)
    jvmArgs.add("-cp")
    jvmArgs.add(System.getProperty("java.class.path"))

    var mainClass = System.getenv("JAVA_MAIN_CLASS_$processID")
    if (mainClass == null) {
      val trace = Thread.currentThread().stackTrace
      if (trace.isNotEmpty()) mainClass = trace.last().className
      else {
        System.err.println("The main class could not be determined.")
        return false
      }
    }
    jvmArgs.add(mainClass)

    try {
      val processBuilder = ProcessBuilder(jvmArgs)
      if (!isMac) processBuilder.environment()["__GL_THREADED_OPTIMIZATIONS"] = "0"
      if (!inheritIO) processBuilder.start()
      else processBuilder.inheritIO().start().waitFor()
    } catch (e: Exception) {
      System.err.println("There was a problem restarting the JVM.")
      e.printStackTrace()
    }

    return true
  }

  private fun getJreErrMsg(isMac: Boolean) = if (isMac) MAC_JRE_ERR_MSG else LINUX_JRE_ERR_MSG

  private fun getProcessID(isMac: Boolean) = if (isMac) LibC.getpid() else UNISTD.getpid()
}
