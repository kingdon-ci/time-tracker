# Proguard/R8 rules for Time Tracker

# Disable obfuscation: Keep all class, method, and field names intact
-dontobfuscate

# Keep Chicory WebAssembly interpreter classes to prevent R8 from removing/obfuscating them
-keep class com.dylibso.chicory.** { *; }

# Suppress warnings about missing compile-only annotations and logging dependencies in Chicory
-dontwarn com.dylibso.chicory.experimental.hostmodule.annotations.Buffer
-dontwarn com.dylibso.chicory.experimental.hostmodule.annotations.HostModule
-dontwarn com.dylibso.chicory.experimental.hostmodule.annotations.WasmExport
-dontwarn com.google.errorprone.annotations.FormatMethod
-dontwarn java.lang.System$Logger$Level
-dontwarn java.lang.System$Logger
