# Potensic Proxy – TAF Versioning

## Central version sources

- Frontend: `webui/package.json` → `version`
- Backend / Android app: `app/build.gradle.kts` → `defaultConfig.versionName`

The running frontend reads its version from `webui/package.json` through
`webui/src/version.ts`. The backend reads its version at runtime from
`BuildConfig.VERSION_NAME` through `VersionInfo.kt`.

The Engineering view displays both runtime values. `/api/version` reports the
backend value; the frontend adds its own local bundle version when presenting
combined version information.

For a new release, update these two central source values. `versionCode` must
also be incremented for Android package upgrades.

## Android BuildConfig requirement

`VersionInfo.kt` reads the backend version from `BuildConfig.VERSION_NAME`. With Android Gradle Plugin 8.x, BuildConfig generation is explicitly enabled in `app/build.gradle.kts` via `buildFeatures { buildConfig = true }`. Keep this enabled so the runtime backend version remains sourced from the central Android `versionName`.


## Current development release

- Software version: `0.980` (pre-1.0 development)
- Android `versionCode`: `53`
- Frontend source: `webui/package.json`
- Backend/Android source: `app/build.gradle.kts`

The documentation revision is tracked independently from the software version.
