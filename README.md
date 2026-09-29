# PotensicProxy_TAF

PotensicProxy_TAF is an Android USB proxy with an embedded Vue 3 WebUI for Potensic drone development, flight monitoring, live video, map/mission work and protocol diagnostics.

> **Project origin:** The project is based on `sk7n4k3d/potensic-proxy`. Selected changes from `liert/potensic-proxy` are reviewed before integration. See `UPSTREAMS.md` for provenance and integration notes.

## Current project structure

The WebUI is organized into these top-level areas:

- **Flight Cockpit** - LiveView/map, joystick display/control, flight actions, telemetry overlay and camera controls.
- **Mission Planning** - mission storage/editing and Potensic-compatible export path.
- **Map** - map display, provider configuration and offline-region management.
- **Gallery** - camera media/gallery functions.
- **USB Tools** - packet monitoring, capture and construction tools.
- **System** - system-level functions and diagnostics. This replaces the former top-level **Engineering** label.

System contains the moved **Flight / Calibration / Smart Modes** area together with camera console, video/RF diagnostics, sensors/calibration, Remote ID/system functions, relay tools and logs.

## Flight Cockpit UI

The cockpit currently provides:

- switchable **LiveView / Map / PIP** layout;
- a transparent telemetry/status overlay on the main image, retained when the flight stage enters fullscreen;
- separate power indicators for **phone**, **controller** and **drone** where the corresponding values are available;
- an always-visible **Camera Control** directly below the joystick controls, with matching vertical Gimbal and Zoom controls;
- a separate collapsible **Camera** settings section below Camera Control;
- a continuous camera-zoom setpoint control in the UI (vertical drag control and direct numeric entry);
- collapsible side controls instead of permanently covering the LiveView with action buttons;
- map zoom using **+ / -** plus direct numeric zoom entry;
- selectable UI backgrounds: **Dark**, **Light** and **Gray**.

### Power-value sources

- **Drone battery:** flight telemetry percentage.
- **Controller battery:** controller battery percentage when the existing `0x1131` response provides it; controller voltage is shown as a fallback when a percentage is unavailable.
- **Phone battery:** Android `BatteryManager`, exposed by the local backend status endpoint.

## Camera zoom status

The cockpit now allows continuous selection of the zoom setpoint. The current project does **not** contain a confirmed ATOM/ATOM 2 camera-zoom command or confirmed measured zoom feedback field. Therefore the control is presently a UI setpoint only; no new or speculative protocol command is transmitted. This deliberately keeps unconfirmed protocol areas unchanged.

## Video profiles

Model-specific behavior is selected centrally through the drone protocol profiles in `app/src/main/res/xml/drone_protocol_profiles.xml`.

- **Potensic ATOM** is configured for FE `0x06`, `atom_h264_fe06`, three transport bytes stripped per FE payload, H.264 and 1280x720.
- **Potensic ATOM 2** is configured for FE `0x06`, `w42`, automatic codec detection and a 1920x1080 profile target.

The WebUI supports direct WebCodecs rendering plus snapshot/MJPEG fallback paths. Diagnostics expose FE traffic, parser state, codec detection and frame/decode counters.

## Map and missions

The backend owns map-provider configuration and tile proxying. The WebUI contains:

- live map display;
- provider configuration and connection test;
- default zoom and map data mode;
- offline-region management where permitted by the selected provider;
- mission library/editing;
- Potensic mission export path.

## Architecture

```text
Browser / Vue 3 WebUI (:9090)
        |
        | HTTP + WebSocket
        v
Android Ktor backend / ProxyService
        |
        | USB Accessory (AOA)
        v
Potensic controller
        |
        | RF
        v
Drone
```

Frontend and backend remain separated: presentation/state handling is in `webui/`, while Android transport, local HTTP/WebSocket APIs, map/mission storage and device access are under `app/src/main/`.

## Important HTTP / WebSocket interfaces

The current backend includes, among others:

| Interface | Purpose |
|---|---|
| `GET /api/status` | USB/link/video status plus local phone-battery percentage when available |
| `GET /api/telemetry` | interpreted telemetry state |
| `GET /api/video/stats` | video parser/extractor diagnostics |
| `GET /api/video/snapshot` | current decoded JPEG frame |
| `GET /api/video/mjpeg` | MJPEG stream |
| `POST /api/video/activate` | explicit LiveView activation |
| `POST /api/video/request-idr` | request keyframe/IDR |
| `GET/POST /api/drone/profile` | read/select central drone profile |
| `GET/POST /api/map/config` | map configuration |
| `GET /api/map/tiles/{z}/{x}/{y}` | backend tile proxy |
| `GET/PUT/DELETE /api/missions/...` | mission storage |
| `GET /api/missions/{id}/export/potensic` | Potensic export |
| `WS /ws/usb` | bidirectional USB passthrough |
| `WS /ws/control` | control/state channel |
| `WS /ws/video` | raw video stream channel |

Additional diagnostic/capture/WiFi endpoints remain available in the backend source.

## Build

Requirements from the current Gradle configuration:

- Android SDK / compileSdk **36**
- minSdk **26**
- JDK **17**
- Node/npm for the Vue WebUI

Build the WebUI dependencies once, then build Android:

```bash
cd webui
npm ci
cd ..
./gradlew assembleDebug
```

The Android `preBuild` task runs the WebUI build so the embedded assets stay synchronized with the frontend sources.

## Protocol-change rule

Confirmed behavior may be implemented and documented. **Unconfirmed protocol areas are not removed, reinterpreted or changed speculatively.** UI-only preparation is allowed when it does not transmit an unconfirmed command. See `PROTOCOL.md` and the integration notes for protocol-specific details.

## Documentation

Relevant project documents include:

- `PROTOCOL.md` - protocol notes and confirmed/observed packet information
- `UPSTREAMS.md` - upstream provenance and integration policy
- `UI_STYLE_GUIDE.md` - WebUI style structure
- `MISSION_PLANNER_INTEGRATION.md` - mission-planner integration
- `MAP_INTEGRATION_NOTES.md` - map integration
- `SYSTEM_UI_REORGANIZATION.md` - Engineering -> System reorganization
- `UI_DETAIL_IMPLEMENTATION_2026-09-29.md` - audit and implementation of the current UI detail request
- `README_AUDIT_2026-09-29.md` - README review: valid, outdated and added content

## Known limitations relevant to the current UI

- A continuous camera zoom setpoint is available in the UI, but no confirmed zoom command/feedback source is currently wired into the protocol layer.
- Controller percentage is shown only when the known controller status response supplies a valid percentage; otherwise voltage is used as fallback.
- Browser hardware codec support varies by device/browser; fallback rendering paths remain available.
- Model-specific protocol support is intentionally profile-driven and should not be generalized without confirmed captures/behavior.
