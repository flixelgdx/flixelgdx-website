### GraalVM Native Image

The `lwjgl3` module applies the GraalVM Native Build Tools plugin. With a GraalVM-capable JDK available to Gradle, you can build a standalone executable:

    ./gradlew :lwjgl3:nativeCompile

Native Image needs reflection and resource configuration for libGDX. Expect to iterate with tracing or hand-written reachability metadata as your game grows.

### Construo desktop bundles

The `lwjgl3` module also applies Construo. After a normal `./gradlew :lwjgl3:jar`, you can build cross-platform zips (each target downloads its own JDK bundle once):

    ./gradlew :lwjgl3:packageLinuxX64
    ./gradlew :lwjgl3:packageMacOsAarch64
    ./gradlew :lwjgl3:packageWinX64

Output zips land in the `dist/` folder at the project root.

