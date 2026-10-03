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
- separate power indicators for **phone**, **controller** and **drone** where the corresponding values are available; battery percentages use the Potensic-style threshold coloring (**green > 20%**, **red <= 20%**);
- an always-visible **Camera Control** directly below the joystick controls, with matching vertical Gimbal and Zoom controls;
- a separate collapsible **Camera** settings section below Camera Control;
- a collapsible **Telemetry** details section for relative height, separate altitude field, TOF, speeds, distances and additional technical values;
- a continuous camera-zoom setpoint control in the UI (vertical drag control and direct numeric entry);
- collapsible side controls instead of permanently covering the LiveView with action buttons;
- map zoom using **+ / -** plus direct numeric zoom entry;
- selectable UI backgrounds: **Dark**, **Light** and **Gray**.

### Power-value sources

- **Drone battery:** the explicit `remainedBattery` percentage supplied by the aircraft in Flight Info telemetry. TAF does **not** calculate this percentage from voltage.
- **Controller battery:** controller battery percentage when the existing `0x1131` response provides it; controller voltage is shown as a fallback when a percentage is unavailable.
- **Phone battery:** Android `BatteryManager`, exposed by the local backend status endpoint.

### Height and telemetry display

The cockpit **Height / Höhe** value follows the original Potensic app and uses `verticalDistance`, i.e. the relative flight height. The separate `altitude` field is retained as technical telemetry and is not used to overwrite the cockpit height. `tofHeight` is also kept separate and shown only in the collapsible Telemetry details section.

For the long ATOM Flight Info layout, the parser applies the same +2-byte post-horizontal-distance index shift used by PotensicPro. This places `verticalDistance`, speed fields and the aircraft `remainedBattery` byte at their correct long-layout offsets.


## Camera gallery status

**v0.961 PotensicPro camera-initialization alignment:** camera startup now follows the original app much more closely. After passthrough opens, TAF repeatedly requests the full camera config menu (`0x11`) once per second until it is received, parses camera mode/recording state, SD state and capacity, current photo/video resolution, EV values, RAW/OSD flags, remaining capture value and the mode-dependent zoom limits, and only then enables camera capture actions. After config-menu success TAF sends the same main post-init queries observed in PotensicPro: camera time (`0x07`), manual-mode information (`0x34`), zoom (`0x3F`) and photo child mode (`0x40`). The premature startup zoom query is therefore deferred until config initialization is complete. A successful PHOTO mode switch now follows PotensicPro's `EVENT_SET_CAPTURE_MODE_SUCCESS` path: `0x17` SD status, `0x0E 01` photo-EV query and manual/auto exposure synchronization are sent, while `0x3A` is treated only as the original app's mode-switch pre-notify rather than as a shutter-readiness gate. Photo `Device busy` and current-mode errors no longer trigger an automatic photo retry. A successful `0x01` ACK requests SD status immediately and still waits for `0x2A`; the 10-second fallback now resets only the local taking-photo UI, matching the original app instead of forcing an error or VIDEO mode switch.

**v0.960 photo-flow alignment update:** the cockpit photo action now follows the manufacturer workflow more closely. If the camera is not already in **PHOTO** mode, the first button press only switches the camera from **VIDEO** to **PHOTO** and waits for readiness confirmation (`0x03` + `0x3A`/`0x02`). A second explicit button press is then required to transmit shutter command `0x01`. After a successful or `Device busy` shutter response, TAF no longer performs an automatic retry; instead it waits up to 10 seconds for the actual photo-end event `0x2A`. TAF also no longer auto-switches back to **VIDEO** after the photo path. The cockpit button label now reflects whether the next press will switch to photo mode or actually trigger the shutter.

**v0.959 stream-framing update:** FE `0x05` camera payloads are now reassembled by the declared inner `FF FE` frame length before command decoding. Multiple inner camera frames in one FE payload are processed separately, while incomplete inner frames are retained for the next FE payload. This prevents bytes from a following camera record from being appended to the preceding `0x1B` download body or `0x39` log record. Download-body parsing no longer performs byte-by-byte resynchronization inside media payloads; an impossible `0x1B` body boundary aborts the transfer with a diagnostic instead of interpreting image/video bytes as a new header. Camera commands issued before passthrough readiness are deferred and flushed after WebSocket reconnect/status synchronization.

The drone-SD gallery now follows an explicit state machine (`CLOSED`, `OPENING`, `OPEN`, `LOADING_COUNT`, `LOADING_LIST`, `READY`, `ERROR`). Enter (`0x21`), file count (`0x18`) and paged file list (`0x19`) requests use bounded timeout/retry handling, so the UI no longer remains indefinitely at “Reading media list…”. File counts are decoded little-endian and the primary `0x19` filename parser starts at the PotensicPro-confirmed response offset; the previous tolerant filename scan remains only as a fallback for firmware variants.

The supplied change order also calls for `0x20` metadata and `0x1C` thumbnail block assembly/MD5 validation. The exact block response layout needed to implement those parsers is not present in the supplied TAF package or change-order wire description, so no guessed thumbnail frame parser was added. This remains device/original-app-source dependent.

## Camera zoom status

Camera zoom is wired through the PotensicPro-compatible USB camera path (FE TX `0x15` / RX `0x05`, inner message short `0x0020`). The WebUI sends **SET ZOOM `0x3E`** with `zoom x 100` as a little-endian 32-bit integer and reads **GET ZOOM `0x3F`** using the same response path. Successful `0x3E` and `0x3F` responses provide the camera-reported zoom value, which is shown separately from the requested setpoint.

The minimum zoom is `1.0x`. The upper limit is read from the camera config-menu capability data for the current video resolution when available; `4.0x` is used only as a temporary UI fallback until the camera reports its capability. Drag updates are rate-limited to approximately one command every 33 ms, matching the behavior observed in PotensicPro.

## Video profiles

Model-specific behavior is selected centrally through the drone protocol profiles in `app/src/main/res/xml/drone_protocol_profiles.xml`.

- **Potensic ATOM** is configured for FE `0x06`, `atom_h264_fe06`, three transport bytes stripped per FE payload, H.264 and 1280x720.
- **Potensic ATOM 2** is configured for FE `0x06`, `w42`, automatic codec detection and a 1920x1080 profile target.

The WebUI supports direct WebCodecs rendering plus snapshot/MJPEG fallback paths. Diagnostics expose FE traffic, parser state, codec detection and frame/decode counters.

## Image-recognition prerequisites

The project now has two deliberately separate Android image libraries:

- **Normal Camera:** capture now follows the PotensicPro `UsbCameraHandler` path FE `0x15` / inner `FF FD` / function `0x0020`: photo payload `[0x01]`, video start `[0x00,0x01]`, video stop `[0x00,0x00]`. The same `0x0020` path carries gallery/media commands (`0x18`-`0x22`); responses are accepted on FE `0x05` with inner RX header `FF FE`. Gallery metadata command `0x20` is used for camera `createtime`, `len` and `lrv_len`, with filename timestamps only as fallback. Full-file command `0x1B` uses 102400-byte requests and PotensicPro's RX layout (u64 offset + u16 payload length; final frames include a 32-byte prefix before offset). Downloaded JPG/JPEG/PNG/DNG files are published through Android `MediaStore` under `Pictures/PotensicProxy/Camera`; MP4 files are published under `Movies/PotensicProxy/Camera`. Normal camera downloads are not automatically deleted from the aircraft.
- **Recognition:** all images intended for later image recognition are published under `Pictures/PotensicProxy/Recognition` and shown in the separate **Recognition** tab of the Gallery page.

Recognition has two capture sources that feed the same metadata/index pipeline:

- **Live Reco:** saves the current decoded LiveView JPEG directly to Android. No temporary still image exists on the aircraft.
- **Drone Reco:** records the pre-shot camera file list, leaves gallery mode, triggers a full camera photo, identifies the newly created file, transfers it to Android, reads the MediaStore copy back, verifies byte count plus SHA-256, and only then sends the camera-file delete command. A missing transfer, failed verification, ambiguous/new-file failure or missing delete acknowledgement is treated as an error; the workflow does not intentionally delete an unverified source.

Each Recognition index record can carry a metadata snapshot captured at trigger time: all currently available telemetry fields, GPS state/coordinates, relative height and altitude fields, attitude, gimbal state, RC/user control values, camera settings, SD state, connection state, application/schema version, image dimensions/size/hash and a placeholder for later recognition runs. Unknown values are retained as unknown rather than inferred. The app-owned index lets a future recognition service process its own images without broad access to the user's entire photo library. On Android 10+ no storage permission is required for media created by the app; Android 8/9 request the legacy write permission only for publishing into the public Pictures collection.

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
| `POST /api/media/snapshot` | save a Live Reco frame to Android `Pictures/PotensicProxy/Recognition` with optional metadata |
| `POST /api/media/import?name=...&library=...` | publish camera/Recognition JPG/JPEG/PNG/DNG or camera MP4 to Android MediaStore |
| `GET /api/media/local?library=camera|recognition` | list app-created images, optionally filtered by library |
| `GET /api/media/local/{id}` | read an app-created image by local media index id |
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
- `IMAGE_RECOGNITION_PREREQUISITES_2026-10-01.md` - Android image capture/storage layer prepared for later image recognition

## Known limitations relevant to the current UI

- Controller percentage is shown only when the known controller status response supplies a valid percentage; otherwise voltage is used as fallback.
- Browser hardware codec support varies by device/browser; fallback rendering paths remain available.
- The actual aircraft-side photo command and SD-card transfer still require device-side verification on the target ATOM/firmware. The new Android storage path is implemented, but this source package cannot prove aircraft hardware behavior without a connected drone/controller.
- Model-specific protocol support is intentionally profile-driven and should not be generalized without confirmed captures/behavior.

### Virtual joystick and ATOM gimbal
The cockpit virtual joysticks are connected to PotensicPro's confirmed `Send4AxisData` flight function (`0x0001`). Throttle, yaw, pitch and roll are transmitted at the original app cadence of 80 ms while a virtual stick is actively held, with a neutral frame on release. The ATOM gimbal deliberately does not use the generic `Send4AxisData` gimbal byte because PotensicPro disables that app-side slider for ATOM-series aircraft. The camera control instead uses the confirmed ATOM pitch presets from `SendGimbalSettingData` (`0x001A`) and displays the received gimbal-state feedback as the actual angle.

### Camera capture and media reliability (v1.4)

The cockpit Photo and Video buttons use the PotensicPro capture-mode workflow and now wait for actual camera readiness after a mode change. A successful mode ACK (`0x03`) is followed by the asynchronous mode notification (`0x3A`) and/or a confirming camera-status query (`0x02`) before the photo/record command is sent. `Device busy` (`status 3`) ends the current ACK wait immediately, performs a short backoff and status re-sync, and permits at most one controlled retry. Camera-log records (`0x39`) are handled as asynchronous log data rather than command failures.

Camera metadata (`0x20`) is assembled across fragments before JSON parsing. Download data (`0x1B`) is buffered to complete declared frames; `flag=0` continues the current unit, `flag=1` advances to the next unit, and `flag=2` finalizes the file. Valid transfer progress refreshes the inactivity watchdog. Passthrough disconnects clear transient camera state and require a fresh `0x02` status synchronization after reconnect.

### Live system log

The live system log keeps a deterministic rolling buffer of at most 1000 lines. Its header remains visible while the log body scrolls, shows the current line count, and provides **Save Log** plus **Clear** controls. **Save Log** exports exactly the currently retained snapshot as UTF-8 text without clearing or pausing live logging.

### Camera 0x39 diagnostic log decoding (v1.5)

The browser camera service now follows PotensicPro's `CameraLogData` layout for asynchronous camera log command `0x39`: source byte, uint16-LE payload length, then exactly that many source payload bytes. Linux camera logs are decoded with the `0x55` XOR transformation validated against the 2026-10-02 USB capture and are escaped to one Live System Log entry per record. Gimbal camera logs remain binary and are shown as a bounded hex preview; LiteOS remains raw until a source-1 capture validates its encoding. Malformed/truncated length declarations are rejected instead of being interpreted as text.
