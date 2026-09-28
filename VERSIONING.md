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
