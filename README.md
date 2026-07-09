# Time Carburetor (Android + WASM)

A Zero-Split-Brain Android application for tracking work targets, cumulative balances, and billable ratios using the EARLY API (formerly Timeular).

The project is structured to enforce a strict local-first separation of concerns:
- **WASM Brain (`brain/`)**: A Rust-based core compiled to WebAssembly. It handles all business logic, UTC-to-ET timezone adjustments, Daylight Savings rules, expected target math, and comp-time calculations.
- **Ignorant Host (`android/`)**: A Jetpack Compose application. It contains zero business logic, performing only UI rendering, secure credential storage, API requests, and delegation of math computations to the WASM brain.

## Architecture Overview

```
                          +------------------------+
                          |   Jetpack Compose UI   |
                          +-----------+------------+
                                      | UDF State
                                      v
                          +-----------+------------+
                          |  TimeTrackerViewModel  |
                          +-----------+------------+
                             /                  \
             Network Fetch  /                    \ Run Calculations
                           v                      v
                    +-------------+        +-------------+
                    |  ApiClient  |        |  BrainHost  |
                    +------+------+        +------+------+
                           |                      | Chicory
                           v HTTPS                v Interpreter
                     [ Early API ]         [  brain.wasm ]
```

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (for compiling the WASM brain)
- [Android SDK](https://developer.android.com/studio) and JDK 17+

### Setup and Build

1. **Install WASM target**:
   ```bash
   make setup
   ```

2. **Compile the app and run tests**:
   ```bash
   make build
   ```
   This will:
   - Run unit tests for the Rust WASM brain (`cargo test`).
   - Compile the Rust WASM brain (`brain.wasm`).
   - Copy `brain.wasm` into the Android assets directory.
   - Run Android JVM unit tests (`./gradlew test`).
   - Assemble the final Android debug APK (`./gradlew assembleDebug`).

3. **Deploy to a connected device**:
   ```bash
   make install
   ```

## Development and Testing

- **Rust Brain**: Run cargo tests directly:
  ```bash
  cd brain && cargo test
  ```
- **Android Host**: Run JVM integration tests directly (no emulator needed since the WASM brain runs in Chicory's pure Java interpreter):
  ```bash
  cd android && ./gradlew test
  ```
- **Code Formatting / Linting**:
  ```bash
  make lint
  make format
  ```

## Legacy Web & CLI

For documentation regarding the legacy Spin-based web dashboard and Ruby CLI tools, see [LEGACY.md](file:///Users/yebyen/w/time-tracker/LEGACY.md).
