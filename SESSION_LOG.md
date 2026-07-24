# Session Log — 2026-07-19 / 2026-07-20

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

### 4. Tests Added
**File:** `brain/src/raw_entry.rs`

Added 11 new unit tests covering:

| Test | Coverage |
|------|----------|
| `test_duration_hours_early_api_format_no_tz` | Early API format `2026-07-01T12:00:00.000` |
| `test_duration_hours_early_api_format_no_tz_no_millis` | Format without milliseconds |
| `test_duration_hours_rfc3339_still_works` | RFC3339 with Z suffix |
| `test_duration_hours_rfc3339_with_offset` | RFC3339 with `+00:00` offset |
| `test_entry_date_july_dst` | July date → EDT (-4h) |
| `test_entry_date_january_no_dst` | January date → EST (-5h) |
| `test_entry_date_crosses_midnight_dst` | 23:00 UTC July 1 → July 1 EDT |
| `test_entry_date_crosses_midnight_no_dst` | 23:00 UTC Jan 1 → Dec 31 EST |
| `test_is_nonbillable_with_tag` | Nonbillable tag detection |
| `test_is_nonbillable_case_insensitive` | Case-insensitive tag matching |
| `test_is_nonbillable_without_tag` / `test_is_nonbillable_no_note` | Edge cases |

Total: 14 tests passing (3 existing + 11 new).

### 5. Self-Hosted Runner Setup
Registered a macOS ARM64 self-hosted runner at `~/actions-runner` for the `kingdon-ci/time-tracker` repo.

**Workflow added:** `.github/workflows/self-hosted-test.yml` — runs on `[self-hosted, macos, arm64]` labels.

Runner runs as a background process (`nohup ./run.sh > runner.log 2>&1 &`).

## Verification

After fixes:
- App launches without crash
- WASM brain loads: `Loading brain.wasm... → WASM instance created successfully`
- Monthly target computes: `total_hours: 136.99, billable_hours: 104.53, expected_hours: 104.0, hours_diff: +0.53`
- Entries show correct durations: `"duration": "03:08:00", "duration_hours": 3.13, "date": "2026-07-01"`
- Six mixture works: July 14 = 7.25h billable, July 15 = 8h nonbillable (PTO)
- History rolling comp balance: -100.19h (6-month lookback)
- All 14 Rust tests pass

## Commits
- `c7d6e88` Fix Android app crash and WASM date parsing
- `2e61e6b` Add session log for Android crash fix and WASM date parsing
- `cf50373` Add tests for WASM date parsing fix (Early API format)
- `4957a6c` Add self-hosted test workflow

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

# Run Rust tests
cd brain && cargo test

# Check runner status
ps aux | grep Runner
cat ~/actions-runner/runner.log
```