# PotensicProxy TAF - Map integration notes

Version: v0.3  
Date: 2026-09-27

## Architecture

The map implementation keeps the existing frontend/backend boundary:

- The WebUI renders the map and reads live drone telemetry from the existing Pinia store.
- The Android/Ktor backend owns map-provider configuration, provider access tokens, tile downloads, tile caching and offline-region jobs.
- The browser requests map tiles only from the local PotensicProxy backend (`/api/map/tiles/...`). It does not contact the configured tile provider directly.
- No BX3/USB/drone protocol interface was changed for the map integration.

## Version index

The backend provides `GET /api/version`. The Settings view displays the project package, Android app, backend, WebUI, map module, map API and build-date versions.

Current project package: `v0.3` / application version `0.3.0`.

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
