# Dependency Inventory — 2026-07-20

> **Scope**: All declared dependencies across the project (Android app, WASM brain, legacy Ruby, CI/CD workflows).
> **Generated**: From `build.gradle.kts`, `Cargo.toml`, `Gemfile`, `.github/workflows/*.yml`, and Maven Central/Google Maven metadata lookups.

---

## 📦 Android App (`android/app/build.gradle.kts`)

| Dependency | Current | Latest Stable | Status | Notes |
|------------|---------|---------------|--------|-------|
| **Build System** |
| Android Gradle Plugin | 8.5.0 (via `gradle/wrapper/gradle-wrapper.properties`) | **9.3.0** | ⬆️ **Major** | AGP 9.x requires Gradle 8.10+; breaking API changes |
| Gradle Wrapper | 8.5 | **8.11** | ⬆️ **Minor** | |
| Kotlin | 2.2.10 (implied by plugins) | **2.4.20** | ⬆️ **Major** | Kotlin 2.x requires AGP 8.4+; K2 compiler |
| **WASM Runtime** |
| `com.dylibso.chicory:runtime` | **1.7.5** | 1.7.5 | ✅ Current | Just upgraded from 1.0.0-M2 |
| `com.dylibso.chicory:wasi` | **1.7.5** | 1.7.5 | ✅ Current | |
| **AndroidX Core / Jetpack** |
| `androidx.core:core-ktx` | 1.12.0 | **1.19.0** | ⬆️ **Yes** | |
| `androidx.activity:activity-compose` | 1.8.2 | **1.13.0** | ⬆️ **Yes** | |
| `androidx.compose:compose-bom` | 2024.06.00 | **2026.06.01** | ⬆️ **Yes** | Monthly BOM; 2+ years behind |
| `androidx.lifecycle:lifecycle-viewmodel-compose` | 2.7.0 | **2.11.0** | ⬆️ **Yes** | |
| `androidx.lifecycle:lifecycle-runtime-compose` | 2.7.0 | **2.11.0** | ⬆️ **Yes** | |
| `androidx.security:security-crypto` | 1.1.0-alpha06 | **1.1.0** | ⬆️ **Yes** | Stable 1.1.0 released |
| **Network / Serialization** |
| `com.squareup.okhttp3:okhttp` | 4.12.0 | **4.12.0** / **5.4.0** | ⚠️ **Major** | 5.x = breaking API changes; 4.x still maintained |
| `org.jetbrains.kotlinx:kotlinx-serialization-json` | 1.6.3 | **1.11.0** | ⬆️ **Yes** | Requires matching Kotlin version |
| **Testing** |
| `junit:junit` | 4.13.2 | 4.13.2 | ✅ Current | JUnit 5 is separate artifact |
| `androidx.test.ext:junit` | 1.1.5 | **1.3.0-rc01** | ⬆️ **Yes** | 1.3.0 in RC |
| `androidx.test.espresso:espresso-core` | 3.5.1 | 3.6.0+ | ⬆️ **Yes** | Check latest |
| `androidx.compose.ui:ui-test-junit4` | (via BOM) | (via BOM) | — | |

---

## 🧠 WASM Brain (`brain/Cargo.toml`)

| Crate | Current Spec | Latest (crates.io) | Status |
|-------|--------------|-------------------|--------|
| `serde` (with `derive`) | `"1.0"` → **1.0.229** | 1.0.229 | ✅ Current (semver) |
| `serde_json` | `"1.0"` → **1.0.150** | 1.0.150 | ✅ Current (semver) |
| `chrono` (with `serde`) | `"0.4"` → **0.4.45** | 0.4.45 | ✅ Current (semver) |

> Cargo uses semver caret (`^`) by default; `"1.0"` = `^1.0`. All at latest compatible.

---

## 💎 Legacy Ruby (`legacy/Gemfile`)

| Gem | Current | Latest | Status |
|-----|---------|--------|--------|
| `csv` | (stdlib, no version) | — | ✅ Built-in |

---

## 🔧 CI/CD Workflows (`.github/workflows/*.yml`)

| Action | Current Version | Latest | Status |
|--------|----------------|--------|--------|
| `actions/checkout` | v4 | **v4.2.2** | ⬆️ Minor |
| `actions/setup-java` | v4 | **v4.7.1** | ⬆️ Minor |
| `actions/upload-artifact` | v4 | **v4.6.2** | ⬆️ Minor |
| `gradle/actions/setup-gradle` | v3 | **v4.3.1** | ⬆️ **Major** | v4 has breaking changes |
| `dtolnay/rust-toolchain` | @stable | **stable** | ✅ Current | |
| `ruby/setup-ruby` | v1 | **v1.241.0** | ⬆️ Minor | |

---

## 🎯 Upgrade Priority Matrix

| Priority | Dependency | Effort | Risk | Rationale |
|----------|------------|--------|------|-----------|
| **P0** (Do first) | `compose-bom` 2024.06 → 2026.06 | Medium | Low | 2 years of fixes; compose compiler improvements |
| **P0** | `lifecycle-*` 2.7 → 2.11 | Low | Low | Backward compatible; ViewModel/SavedStateHandle fixes |
| **P0** | `core-ktx` 1.12 → 1.19 | Low | Low | Core extensions, no breaking changes |
| **P1** | `kotlinx-serialization` 1.6.3 → 1.11.0 | Medium | Medium | Requires Kotlin 2.0+; serializers changed |
| **P1** | `activity-compose` 1.8 → 1.13 | Low | Low | Compose integration fixes |
| **P1** | `security-crypto` alpha → 1.1.0 | Low | Low | Finally stable! |
| **P2** | AGP 8.5 → 9.3 | **High** | **High** | Major; requires Gradle 8.10+, JDK 21, API migrations |
| **P2** | Kotlin 2.2 → 2.4 | High | High | K2 compiler; must pair with AGP 9.x |
| **P2** | OkHttp 4.12 → 5.4 | High | High | **Breaking API**; rewrite all HTTP calls |
| **P2** | `gradle/setup-gradle` v3 → v4 | Medium | Medium | Plugin API changes |
| **P3** | `androidx.test` / `espresso` | Low | Low | Test-only; can upgrade independently |

---

## 🚫 Known Blockers

| Upgrade | Blocker |
|---------|---------|
| **AGP 9.x / Kotlin 2.x** | Requires JDK 21 (CI uses JDK 17); all `kotlin-android` plugins renamed; `kotlin-android` → `org.jetbrains.kotlin.android`; `kotlin-android-extensions` removed |
| **OkHttp 5.x** | Package rename: `okhttp3` → `okhttp`; `Request.Builder` API changed; interceptors rewritten |
| **Compose BOM 2026.x** | Compiler version must match; `kotlinCompilerExtensionVersion` in `composeOptions` removed in favor of `composeCompiler` Gradle plugin |
| **Gradle 8.10+** | Some deprecated APIs removed; check `gradle.properties` flags |

---

## 📋 Suggested Upgrade Order

```bash
# 1. Safe, independent upgrades (no AGP/Kotlin version coupling)
./gradlew dependencyUpdates  # from ben-manes/gradle-versions-plugin

# 2. Compose BOM + Lifecycle + Core-KTX (same AGP/Kotlin)
#    Edit compose-bom to 2026.06.01
#    Bump lifecycle to 2.11.0
#    Bump core-ktx to 1.19.0
#    Bump activity-compose to 1.13.0
#    Bump security-crypto to 1.1.0

# 3. Kotlin Serialization 1.11 (needs Kotlin 2.0+)
#    Update kotlin plugin to 2.0.0 (still on AGP 8.5)
#    Update kotlinx-serialization to 1.11.0

# 4. AGP 9.x + Kotlin 2.x + Gradle 8.11 (big bang)
#    - Update gradle-wrapper.properties to 8.11
#    - AGP 9.3.0 in root build.gradle.kts
#    - Kotlin 2.0.20 (matching AGP 9.3)
#    - Migrate composeOptions → composeCompiler plugin
#    - Fix any API breakages

# 5. OkHttp 5.x (separate PR, high risk)
```

---

## 🔍 How to Check for Updates Locally

```bash
# Gradle: add to root build.gradle.kts
plugins { id("com.github.ben-manes.versions") version "0.53.0" }
./gradlew dependencyUpdates

# Rust
cd brain && cargo update --dry-run

# GitHub Actions
# Check https://github.com/actions/checkout/releases etc.
```

---

## 📌 Current Locked Versions (for reproducibility)

| File | Purpose |
|------|---------|
| `android/gradle/wrapper/gradle-wrapper.properties` | Gradle 8.5 |
| `android/app/build.gradle.kts` | All Android deps (no separate lockfile) |
| `brain/Cargo.lock` | Exact crate versions (commit this!) |
| `legacy/Gemfile.lock` | Ruby gems (commit this!) |

> **Action**: Ensure `brain/Cargo.lock` and `legacy/Gemfile.lock` are committed to git.