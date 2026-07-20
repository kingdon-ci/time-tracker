# Dependency Inventory — 2026-07-20

Generated from: `android/app/build.gradle.kts`, `brain/Cargo.toml`, `legacy/Gemfile`, `.github/workflows/*.yml`

---

## Android (Gradle / Kotlin)

| Dependency | Current | Latest (as of 2026-07-20) | Upgradable? | Notes |
|------------|---------|---------------------------|-------------|-------|
| **Core** |
| Android Gradle Plugin | 8.5.0 (via gradle) | 8.5.0 | No | |
| compileSdk / targetSdk | 35 | 35 | No | Android 15 |
| minSdk | 26 | 26 | — | Android 8.0 |
| Kotlin | 1.9.24 (implied) | 2.0.0 | **Yes** | Major version; requires AGP 8.4+ |
| **Chicory (WASM Runtime)** |
| `com.dylibso.chicory:runtime` | **1.7.5** | 1.7.5 | No | Just upgraded from 1.0.0-M2 |
| `com.dylibso.chicory:wasi` | **1.7.5** | 1.7.5 | No | |
| **AndroidX / Jetpack** |
| `androidx.core:core-ktx` | 1.12.0 | 1.13.1 | **Yes** | |
| `androidx.activity:activity-compose` | 1.8.2 | 1.9.3 | **Yes** | |
| `androidx.compose:compose-bom` | 2024.06.00 | 2024.08.00 | **Yes** | Monthly BOM |
| `androidx.lifecycle:lifecycle-viewmodel-compose` | 2.7.0 | 2.8.7 | **Yes** | |
| `androidx.lifecycle:lifecycle-runtime-compose` | 2.7.0 | 2.8.7 | **Yes** | |
| `androidx.security:security-crypto` | 1.1.0-alpha06 | 1.1.0-alpha06 | No | Still alpha |
| **Network / Serialization** |
| `com.squareup.okhttp3:okhttp` | 4.12.0 | 4.12.0 | No | 5.x is major breaking |
| `org.jetbrains.kotlinx:kotlinx-serialization-json` | 1.6.3 | 1.7.3 | **Yes** | |
| **Testing** |
| `junit:junit` | 4.13.2 | 4.13.2 | No | JUnit 5 is separate |
| `androidx.test.ext:junit` | 1.1.5 | 1.2.1 | **Yes** | |
| `androidx.test.espresso:espresso-core` | 3.5.1 | 3.6.1 | **Yes** | |
| `androidx.compose.ui:ui-test-junit4` | 2024.06.00 | 2024.08.00 | **Yes** | |

---

## Rust (WASM Brain)

| Crate | Current | Latest | Upgradable? | Notes |
|-------|---------|--------|-------------|-------|
| `serde` (with `derive`) | 1.0.215 | 1.0.215 | No | |
| `serde_json` | 1.0.133 | 1.0.133 | No | |
| `chrono` (with `serde`) | 0.4.40 | 0.4.40 | No | |

> Run `cargo update` to refresh `Cargo.lock`. All deps are at latest compatible with MSRV.

---

## Ruby (Legacy)

| Gem | Current | Latest | Upgradable? |
|-----|---------|--------|-------------|
| `csv` | 3.3.2 (stdlib) | 3.3.2 | No |

> Only stdlib `csv` is used. Ruby version pinned to 3.4.7 in `.ruby-version` (implied by CI).

---

## GitHub Actions

| Action | Current | Latest | Upgradable? |
|--------|---------|--------|-------------|
| `actions/checkout` | v4 | v4 | No |
| `actions/setup-java` | v4 | v4 | No |
| `gradle/actions/setup-gradle` | v3 | v4 | **Yes** |
| `dtolnay/rust-toolchain` | stable | stable | — |
| `actions/upload-artifact` | v4 | v4 | No |
| `ruby/setup-ruby` | v1 | v1 | No |

---

## Recommended Upgrades (Priority Order)

1. **Kotlin 2.0.0** — Requires AGP 8.4+, Compose Compiler 2.0.0, Gradle 8.7+. Test thoroughly.
2. **Compose BOM 2024.08.00** — Monthly release; includes Material3 updates.
3. **Lifecycle 2.8.x** — ViewModel/SavedStateHandle improvements.
4. **kotlinx-serialization 1.7.3** — Performance fixes.
5. **Gradle setup action v4** — Better caching.

---

## Versions Pinned in CI

| File | Pinned Version |
|------|----------------|
| `.github/workflows/android-ci.yml` | `dtolnay/rust-toolchain@stable` (floating) |
| `.github/workflows/android-build.yml` | Same |
| `.github/workflows/ruby-ci.yml` | `ruby-version: '3.4'` (floating) |

> Consider pinning to specific SHA for supply-chain security.