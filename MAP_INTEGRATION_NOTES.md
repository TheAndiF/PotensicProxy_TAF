# PotensicProxy TAF - Map integration notes

Version: v0.6  
Date: 2026-09-27

## Architecture

The map implementation keeps the existing frontend/backend boundary:

- The WebUI renders the map and reads live drone telemetry from the existing Pinia store.
- The Android/Ktor backend owns map-provider configuration, provider access tokens, tile downloads, tile caching and offline-region jobs.
- The browser requests map tiles only from the local PotensicProxy backend (`/api/map/tiles/...`). It does not contact the configured tile provider directly.
- No BX3/USB/drone protocol interface was changed for the map integration.

## Version index

The backend provides `GET /api/version`. The Settings view displays the project package, Android app, backend, WebUI, map module, map API and build-date versions.

Current project package: `v0.6` / application version `0.6.0`.

## Map API

- `GET /api/version`
- `GET /api/map/config`
- `POST /api/map/config`
- `GET /api/map/tiles/{z}/{x}/{y}`
- `GET /api/map/regions`
- `POST /api/map/regions`
- `GET /api/map/regions/{id}`
- `DELETE /api/map/regions/{id}`

## Offline provider restriction

The public `tile.openstreetmap.org` service is available for normal interactive online viewing only in this project. The backend and Settings UI explicitly block bulk/offline preloading when the selected provider is `osm`. For offline downloads, configure Mapbox with an appropriate account/token or a custom tile provider whose terms explicitly permit offline/prefetch use.

## Build integration

`webui/vite.config.ts` writes the production WebUI directly to `app/src/main/assets/web` and now cleans that output directory before writing a new build (`emptyOutDir: true`) so obsolete hashed assets are not retained.

Android `preBuild` now depends on a `buildWebUi` Gradle task, so a normal Android build regenerates the embedded WebUI before packaging. The workstation must have Node.js/npm installed and the WebUI dependencies installed (`npm ci` once in `webui`).

Convenience scripts:

- Windows: `scripts/build_webui.ps1`
- Linux/macOS/WSL: `scripts/build_webui.sh`

The source-level Vue/TypeScript check for v0.3 was run successfully with `vue-tsc --noEmit` in the review environment. A complete Vite production bundle could not be regenerated there because the supplied dependency tree contained Windows-native Rollup bindings and the isolated review environment could not download the Linux Rollup optional package. Therefore `app/src/main/assets/web` in this source delivery must be regenerated on the normal Windows development workstation before producing/installing the APK.

## Review corrections in v0.2

- Added Settings version index and backend version endpoint.
- Increased Android/WebUI package version to 0.2.0.
- Added consistent HTTP error handling to MapService.
- Corrected GPS validity checks so valid coordinates on the equator or Greenwich meridian are not rejected.
- Clamped Web Mercator latitude before tile calculations.
- Blocked prohibited OSM public-tile offline prefetching.
- Added required Mapbox-token validation for the Mapbox preset.
- Bounded tile responses to 10 MiB and reject non-PNG/JPEG/WebP responses.
- Avoided reading cached tile files twice.
- Restricted offline tile selection to tiles intersecting the requested circular radius instead of downloading the complete bounding box.
- Set Vite to clear stale hashed assets during a production build.

## v0.3 - Cockpit Liveview / Map display modes

Version v0.3 separates two frontend-only cockpit preferences:

- `mainView`: `video` or `map` - selects which view uses the large main area.
- `pipPosition`: `overlay` or `controls` - selects whether the small secondary view is overlaid in the main image or shown below the flight controls.
- `pipVisible`: enables or hides the small secondary view.

The preferences are stored locally in the WebUI (`localStorage`) and do not change the BX3, USB, telemetry, video or map backend interfaces. The map backend remains responsible only for map configuration, tile access/cache, offline regions and version information.

The cockpit provides direct LIVE / MAP / PIP controls so Liveview and Map can be swapped even when the small window is hidden. Clicking the small window also swaps the large and small views. Vue Teleport is used to move the existing view instance between the large area and the selected small-window location without introducing another telemetry or map interface.

Project/application/backend/WebUI/map-module version index is updated to v0.3 / 0.3.0.

## v0.4 - Mapbox token/resource handling

Version v0.4 extends the backend-owned map provider configuration while keeping the frontend/backend separation intact.

- Mapbox access tokens with the documented `pk.`, `sk.` and `tk.` prefixes are accepted when their scopes/restrictions permit the selected resource.
- The WebUI never receives the stored token value from `GET /api/map/config`; the backend returns only `********`, `hasAccessToken` and a derived token type.
- A newly typed token is present in the local browser only while the user enters/tests/saves it. After storage, the backend does not echo it back.
- Secret (`sk.`) tokens are used only for backend HTTP requests. They are never embedded in the browser tile URL.
- `POST /api/map/test` tests the configured map resource and returns only status, token type and a token-free resource label.
- `Save & test` persists the configuration and immediately performs the provider test. A separate `Test connection` action is available before saving.

Supported Mapbox rendering paths in the existing 256 px XYZ map renderer:

1. **Mapbox Satellite (Raster Tiles API)** - uses the `mapbox.satellite` raster tileset.
2. **Mapbox Studio Style (Static Tiles API)** - rasterizes a compatible Mapbox Studio style such as `mapbox://styles/mapbox/streets-v12` into XYZ tiles.

Mapbox Standard and Mapbox Standard Satellite are not exposed through the Static Tiles API at the time of this project revision. They therefore cannot be rendered by the current backend-raster path without replacing/extending the renderer with a full Mapbox/GL style client. The Settings UI reports this limitation instead of silently accepting an unsupported style.

Tile cache paths are now namespaced by provider/resource identity. Switching from OSM to Mapbox, from Satellite to a Studio style, or between custom tile URLs can no longer accidentally reuse tiles cached for a different source. The access token itself is deliberately not part of the cache namespace.

Map API v0.4 / API index 2 adds:

- `POST /api/map/test`

Existing map and BX3/USB/telemetry interfaces remain unchanged.


## v0.5 - CI/package repair after GitHub Actions log review

The uploaded GitHub Actions log stopped during `npm run build` with TypeScript error `TS2307` because `webui/src/components/cockpit/CockpitView.vue` imported `./MapView.vue`, but `MapView.vue` was not present in the checked-out commit. The complete v0.4 delivery contained the file, so the failure was an incremental-package/commit completeness problem rather than a Vue import-path defect.

Version v0.5 repairs this by delivering the map integration cumulatively and by explicitly including `webui/src/components/cockpit/MapView.vue` in the repair set. The GitHub Actions workflow now checks the required map frontend source files before dependency installation/build and reports a direct file-specific error if a required source is missing.

The same log also showed two non-fatal toolchain warnings. v0.5 addresses them as follows:

- `actions/setup-java@v4` is updated to `actions/setup-java@v5` because v4 is deprecated.
- npm 11 reported that the `esbuild` install script was not covered by the project `allowScripts` policy. `webui/package.json` now explicitly allows the reviewed `esbuild` dependency to run its install script so Vite can obtain its platform binary during clean CI installs.

No BX3, USB, telemetry, video, flight-control or map HTTP interface was changed by this repair. Map API remains v2. Project/application/backend/WebUI/map-module versions are updated to v0.5 / 0.5.0.


## v0.6 - Android constructor repair after GitHub Actions log review

The GitHub Actions build for v0.5 completed the Vue/TypeScript/Vite production build successfully and then failed during `:app:compileDebugKotlin`. The compiler reported `ProxyService.kt:58:58 No value passed for parameter 'filesDir'`.

Cause: `WebServer` had already been extended to accept a `filesDir: File` argument and uses it to construct `MapBackend(filesDir)`, but `ProxyService` still instantiated `WebServer` with the older constructor signature. This was an integration mismatch between the map backend change and the Android service wiring.

Repair: `ProxyService` now passes the Android service `filesDir` into `WebServer`. This gives `MapBackend` its intended app-private storage root for map configuration, tile cache and offline-region metadata. No new permission or external storage path is introduced.

Validation performed for this delivery:

- Required map source files are present in the package.
- `vue-tsc --noEmit` passes from the repaired package; no Vue/TypeScript source error is present.
- The supplied GitHub Actions log already shows the complete Vite production bundle succeeding before the Android Kotlin compiler is reached.
- A source-diff check verifies that the functional Android fix is limited to the `WebServer` construction plus the deliberate v0.6 version/documentation updates.
- A complete local Android Gradle build could not be repeated in the isolated repair environment because Gradle 8.11.1 is not cached and outbound DNS/network access is unavailable. The v0.6 repair therefore addresses the exact Kotlin compiler error reported by CI; the next GitHub Actions run remains the authoritative full APK build verification.

No BX3, USB, telemetry, video, flight-control or map HTTP interface was changed by this repair. Map API remains v2. Project/application/backend/WebUI/map-module versions are updated to v0.6 / 0.6.0.

## v0.962 - Same-origin map backend and explicit LAN bind

A runtime failure showed `NetworkError when attempting to fetch resource` while the map settings page was loaded from the Android-hosted WebUI. The map frontend had coupled its HTTP base URL to the configurable drone/relay target (`potensic_target_host`). A relay/legacy host could therefore redirect local map API requests away from the Android backend and trigger transport/CORS failures before any provider HTTP status was available.

v0.962 separates these responsibilities:

- Production map API and tile requests use the origin that served the running WebUI (`window.location.origin`).
- The configurable drone/relay target no longer changes `/api/version`, `/api/map/config`, `/api/map/test`, `/api/map/tiles/*` or `/api/map/regions*`.
- The Vite development server on port 5173 keeps the previous configurable backend target for workstation development.
- Ktor/CIO is started with an explicit `0.0.0.0:9090` bind. This matches Ktor's all-interface default but makes the intended LAN behavior explicit in code and logs.

This change does not bypass Android/WLAN reachability requirements. If the complete URL `http://<android-ip>:9090/` is unreachable, the Android service must be running, the device IP must still be current and the network must allow client-to-client traffic before map-provider diagnostics can run.

Map API remains v2. No USB/BX3, camera, telemetry or flight-control protocol was changed.

## v0.963 - Android-compatible provider reads and map diagnostics

After v0.962 restored WebUI-to-backend reachability, the map settings page no longer showed a browser/network transport error. The provider test reached the Android backend but the local endpoint returned HTTP 500. This separated the remaining failure from the same-origin/LAN problem fixed in v0.962.

The provider HTTP path in `MapBackend` still used `InputStream.readNBytes(Int)`, while the Android application supports devices from `minSdk = 26`. That Java API is not available on every Android API level covered by the application and can therefore fail at runtime on affected devices before a Mapbox provider result is converted into the normal `MapConnectionTest` response.

v0.963 changes the provider path as follows:

- Replaces `InputStream.readNBytes(Int)` with a manual bounded stream reader based on `InputStream.read(byte[], offset, length)` and `ByteArrayOutputStream`, preserving the existing response-size limits without requiring the newer API.
- Keeps an extra one-byte sentinel read so oversized provider responses are rejected immediately rather than buffered without a bound.
- Closes every `HttpURLConnection` with `disconnect()` in `finally`.
- Uses the runtime backend version in the provider `User-Agent` instead of the old hard-coded `0.5` value.
- Logs provider HTTP failures and transport/runtime compatibility failures to the existing system log without intentionally exposing the configured access token.
- Handles unexpected `Exception` and `LinkageError` failures around `POST /api/map/test` explicitly, so future backend failures produce a diagnostic JSON error and a system-log entry instead of an unexplained Ktor HTTP 500.
- Keeps validation/configuration failures as HTTP 400 responses.

The map provider contract is otherwise unchanged: successful or provider-level failed tests are returned by `MapBackend.testConnection()` as the existing `MapConnectionTest` structure with `ok`, `httpStatus`, `resource`, `tokenType`, `contentType` and `message` fields. Map API remains v2.

No USB/BX3, camera, telemetry, live-view or flight-control protocol was changed.

## v0.964 - Persistent map configuration, in-map source switching and offline tile lifecycle

Version v0.964 extends the existing backend-owned map integration without moving provider credentials or tile-provider requests into the browser.

### Persistent provider/token configuration

- The backend configuration in `filesDir/map/config.json` remains the persistent source for provider settings and the access token. It survives WebUI reloads, app restarts and device restarts; Android app-data reset or uninstall removes it.
- `GET /api/map/config` still returns a stored token only as `********` plus `hasAccessToken` and `tokenType`; the clear token is not echoed back to the WebUI.
- Config and offline-region JSON files are now written through a temporary file/replace step to reduce the risk of a partially written file after interruption.
- Custom XYZ configuration now has its own `customTileUrlTemplate` field so switching to OpenStreetMap does not overwrite a previously configured custom source.

### Source and data-mode switching inside the map

The map overlay now provides direct source and data-mode selectors. The user can switch the visible map without leaving the map itself. Presets include OpenStreetMap, Mapbox Satellite, Mapbox Streets, Mapbox Outdoors, the configured Mapbox custom style and a configured custom XYZ source.

The backend remains authoritative for tile access. Browser tile responses use `Cache-Control: no-store` so browser image caching cannot hide a provider/data-mode change. A frontend tile revision also forces currently visible tiles to be requested again after a saved configuration change.

Data modes are now explicit:

- `auto`: cache/offline first. A valid local tile is returned immediately; only missing/invalid tiles are downloaded and then cached.
- `offline`: cache only. No provider request is performed; a missing tile returns unavailable.
- `online`: provider first. The provider is queried and a successful response replaces the local cached tile. If the provider is temporarily unavailable, an already valid local tile is used as a resilience fallback.

### Offline-region lifecycle

Stored offline regions now retain their source identity and expose cached tile count plus byte size after download/maintenance operations. Region maintenance actions are available from the Map settings panel:

- `Update`: downloads only missing/invalid tiles for the region.
- `Reload`: refreshes every tile from the region's stored provider/source. An existing tile is replaced only after a successful provider response so an interrupted reload does not intentionally destroy the previous valid copy.
- `Delete tiles`: deletes locally cached tiles belonging only to that region while keeping the region definition. Tiles that are also referenced by another stored region with the same cache namespace are preserved.
- `Remove`: removes the region definition and asynchronously deletes its unshared cached tiles.

An interrupted `downloading`, `updating`, `reloading` or `clearing` state from a previous Android process is recovered as `interrupted` on the next backend start so the region is not permanently locked.

The public OpenStreetMap tile service remains excluded from bulk/offline prefetching. Provider-specific caching/offline terms remain the user's/provider account responsibility.

### Map API v3 additions

Map API index is increased from 2 to 3. Existing endpoints remain compatible and the following maintenance endpoints are added:

- `POST /api/map/regions/{id}/update`
- `POST /api/map/regions/{id}/reload`
- `DELETE /api/map/regions/{id}/tiles`

No USB/BX3, camera, telemetry, LiveView or flight-control protocol is changed by v0.964.
