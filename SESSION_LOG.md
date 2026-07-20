# Session Log — 2026-07-19

## Problem
Android app crashed on startup with:
```
java.lang.NoSuchMethodError: No static method getLogger(Ljava/lang/String;)Ljava/lang/System$Logger;
    at com.dylibso.chicory.log.SystemLogger.<clinit>(SystemLogger.java:4)
    at com.kingdon.timetracker.BrainHost.<init>(BrainHost.kt:14)
```

After fixing the crash, the dashboard showed zero hours for all entries and null dates.

## Root Causes & Fixes

### 1. Android Crash — Chicory Logger Incompatibility
**File:** `android/app/build.gradle.kts`, `android/app/src/main/java/com/kingdon/timetracker/BrainHost.kt`

| Component | Before | After |
|-----------|--------|-------|
| Chicory version | 1.0.0-M2 | 1.7.5 |
| Logger | `SystemLogger` (uses `System.getLogger()` — Java 9+, **not on Android**) | `BasicLogger` (uses `java.util.logging` — Android ✅) |
| WASI init | `WasiPreview1(logger, opts)` | `WasiPreview1.builder().withLogger(logger).withOptions(opts).build()` |

The constructor became private in newer Chicory; must use the builder.

### 2. Zero Durations / Null Dates — WASM Date Parsing
**File:** `brain/src/raw_entry.rs`

Early API returns timestamps like `2026-07-01T12:00:00.000` (no timezone suffix).

| Function | Before | After |
|----------|--------|-------|
| `duration_hours()` | `DateTime::parse_from_str(..., "%Y-%m-%dT%H:%M:%S%.fZ")` → fails silently | `NaiveDateTime::parse_from_str(..., "%Y-%m-%dT%H:%M:%S%.f").map(|dt| dt.and_utc())` |
| `entry_date()` | same pattern | same fix |

Also fixed format string: `%.f` → `%f` (chrono's `%f` already includes the decimal point).

### 3. Debug Logging Added
**Files:** `BrainHost.kt`, `MainActivity.kt`

Added structured logging at each WASM boundary to trace:
- Input JSON sent to WASM
- Output JSON returned from WASM
- Raw API responses

## Verification

After fixes:
- App launches without crash
- WASM brain loads: `Loading brain.wasm... → WASM instance created successfully`
- Monthly target computes: `total_hours: 136.99, billable_hours: 104.53, expected_hours: 104.0, hours_diff: +0.53`
- Entries show correct durations: `"duration": "03:08:00", "duration_hours": 3.13, "date": "2026-07-01"`
- Six mixture works: July 14 = 7.25h billable, July 15 = 8h nonbillable (PTO)
- History rolling comp balance: -100.19h (6-month lookback)

## Commands for Future Debugging

```bash
# Watch live logs
adb logcat -s "TimeTrackerViewModel:D" "BrainHost:D"

# Rebuild WASM after Rust changes
cd brain && cargo build --target wasm32-wasip1 --release
cp target/wasm32-wasip1/release/time_tracker_brain.wasm ../android/app/src/main/assets/brain.wasm

# Rebuild Android
cd android && ./gradlew :app:assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

## Commit
`c7d6e88 Fix Android app crash and WASM date parsing`