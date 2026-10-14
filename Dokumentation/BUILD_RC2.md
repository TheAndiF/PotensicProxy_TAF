# PotensicProxy_TAF build procedure (v0.9845.7-rc2)

- Workflow: push a commit starting with `BL_`.
- CI: `npm ci --include=optional --no-audit --no-fund`, then `./gradlew :app:assembleDebug`.
- Gradle runs WebUI build exactly once and checks embedded version. Do not invoke `npm run build` separately before Gradle in the same workflow.
- Local: `cd webui && npm ci --include=optional --no-audit --no-fund && npm run verify:source`, then from root `./gradlew :app:assembleDebug`.
- Debug: no release keystore is required. Release: provide ORIGINAL `keystore.properties` and original keystore securely outside source distributions. Never regenerate the key for an installed production app without a migration strategy.
- `npm audit --json` runs separately, publishes findings, and does not gate a debug build. Security review remains mandatory before production release.
- Version source: `webui/package.json`. Update the associated npm lockfile and pairing runtime when changing the version. Android versionName derives from package.json; versionCode remains unchanged.
- Generated WebUI output is not considered authoritative until a successful Gradle build and embedded verification.
- Current RC has not passed CI Android build or device regression testing.
