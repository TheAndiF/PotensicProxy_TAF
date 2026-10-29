# PotensicProxy_TAF

**Unofficial Android USB-to-Web proxy and experimental control/diagnostics interface for Potensic ATOM and ATOM 2 drones.**

[Compatibility](docs/COMPATIBILITY.md) · [API reference](docs/API.md) · [Related USB-C hardware project](https://github.com/TheAndiF/Potensic-ATOM-USB-C-Replacement-Cable)

> **Active development:** `main` · **Historical references:** `legacy-original`, `archive-liert-review`. This is a community reverse-engineering project, not affiliated with or endorsed by Potensic.

## What can it do?

The Android service bridges an attached controller over Android Open Accessory (AOA) to a browser-based interface. The codebase also contains BLE/Wi-Fi connection paths. Features present in the source include:

| Area | Features found in the code | Important caveat |
| --- | --- | --- |
| Live view | Video extraction, H.264/H.265 decoding, MJPEG, H.265 and WebSocket streams | Codec and controller compatibility vary |
| Telemetry and cockpit | Flight state, virtual sticks, gimbal, camera actions, takeoff, landing and return-to-home commands | A displayed control is **not** proof that every controller accepts it |
| Missions | Waypoint editing, circle/polygon/grid/spiral tools, saved missions and Potensic `map.db` export | Autonomous mission execution is **not** established |
| Maps and media | Map sources, tile cache/offline regions, gallery and snapshots | Some features depend on device/network setup |
| Precision tools | PrecisionStart/PrecisionLanding settings, image/session handling and OpenCV processing paths | Real-world precision and failsafes require testing |
| Diagnostics | USB capture, packet monitor, RF parameter probe, Remote ID query and logs | RF commands are experimental, **not proven range enhancements** |
| Distribution | Version synchronization, GitHub Actions APK builds and update checks | Build signing and installed-app compatibility matter |

**Source-verified, not flight-certified:** These are implementations observed in the supplied TAF source snapshot (October 15, 2026, central version `0.9846.6`). They must not be interpreted as end-to-end tested behavior on every drone, firmware or phone. See the [compatibility evidence and open test cases](docs/COMPATIBILITY.md).

## Quick start: open the Web UI

1. Check your drone/controller combination in the [compatibility matrix](docs/COMPATIBILITY.md).
2. Connect the Android phone and controller using a suitable **data** cable. Confirm the Android AOA permission if prompted.
3. Start PotensicProxy_TAF, verify that the Android service and USB connection are running, and keep the devices on a trusted network.
4. From a browser with network access to the Android device, visit:

   **`http://<ANDROID-PHONE-IP>:9090`**

5. Verify live telemetry and connection health **on the ground** before attempting any flight-related command.

The main server runs on port **9090**; an optional separate video output service uses **9091**. The Android device IP depends on your network. These ports are bound to network interfaces in the source; **do not expose control or diagnostic endpoints to the public internet** without a separate security review and access controls.

### Build from source

The project's central configuration specifies Java 17, Android SDK 36, Node.js 24.11.1, Gradle 8.11.1, Kotlin 2.1.20 and Vite 6.4.3 (resolved). For a Web UI source verification/build:

```powershell
python scripts/sync_versions.py --check
cd webui
npm ci --include=optional --no-audit --no-fund
npm run verify:source
npm run build
```

For a local Android debug build from the repository root, the Gradle wrapper entry point is `./gradlew.bat assembleDebug` on Windows or `./gradlew assembleDebug` on Unix-like systems. APK installation via `adb install -r` requires a correctly built APK, a configured device, and **compatible signing credentials for in-place updates**. The actual CI/release workflows may have additional signing requirements; read `.github/workflows/` before building or publishing an APK. A successful fresh Android build was **not** independently verified for this documentation update.

## Drone profiles and hardware compatibility

The Android profile configuration (`app/src/main/res/xml/drone_protocol_profiles.xml`) contains:

- **ATOM:** H.264 / 1280×720 / `atom_h264_fe06` (configured default).
- **ATOM 2:** `w42` transport / 1920×1080 / automatic codec detection with H.265 preferred.

These are software settings, **not certified support claims**. The [original upstream README](https://github.com/sk7n4k3d/potensic-proxy) reports an ATOM 2 test with a basic Deepsea controller and notes a limitation on virtual joystick control for that hardware. Such upstream tests are not automatically tests of TAF's newer functionality. See [docs/COMPATIBILITY.md](docs/COMPATIBILITY.md).

## Related project: Potensic ATOM USB-C Replacement Cable

<https://github.com/TheAndiF/Potensic-ATOM-USB-C-Replacement-Cable>

An independently documented, reverse-engineered **directional USB-C replacement cable** for the **Potensic ATOM / DSRC02A controller and Android phone**, including KiCad schematics, measurements, a prototype test and a printable holder.

**Caution:** Its special CC/SBU wiring is not a general-purpose USB-C or charging cable. Controller and phone ends must not be swapped. That project's reported ATOM/DSRC02A test does **not** establish ATOM 2 compatibility. Improving this cable's USB reliability does **not directly increase the radio range** from controller to drone.

## Project layout

| Location | Purpose |
| --- | --- |
| `app/` | Android/Kotlin services, USB, video, protocol handling, local HTTP/WebSocket server |
| `webui/` | Vue 3 / TypeScript cockpit, mission planner, maps, gallery and system tools |
| `config/versions.json` | Central version/toolchain source |
| `.github/workflows/` | Prefix-routed `BA_` updates, `BS_` cached builds, `BL_` full builds |
| `docs/API.md` | HTTP and WebSocket endpoint index |
| `docs/COMPATIBILITY.md` | Hardware and testing evidence matrix |
| `DOCUMENTATION/`, `PRIVACY/`, `release-docs/` | Historical technical notes, audits and release records |

For protocol background, see the original [upstream `PROTOCOL.md`](https://github.com/sk7n4k3d/potensic-proxy/blob/master/PROTOCOL.md). TAF-specific protocol behavior must be checked against this fork's source. For history and provenance see [DOCUMENTATION/UPSTREAMS.md](DOCUMENTATION/UPSTREAMS.md).

## Known limitations and safety

- Physical controller stick feedback and **virtual** stick control are different; availability varies by controller and firmware.
- Wi-Fi/BLE implementation does not establish Wi-Fi capability in controllers lacking suitable hardware.
- Mission export and precision tooling must not be mistaken for validated autonomous flight capabilities.
- The virtual Android webcam setting is currently a placeholder, **not a working webcam adapter**.
- Raw packet injection, RF reset/unlock and flight commands can be hazardous. Range, legal compliance and failsafe behavior are **not established** by the presence of a UI control.
- API and WebSocket endpoints can affect physical equipment and are not documented here as authenticated for untrusted networks.

## Contributing and project status

Useful contributions include reproducible device/firmware tests, non-sensitive diagnostic logs, protocol findings, documentation corrections and compatibility reports. Include the exact drone/controller model, Android version, cable revision, TAF commit and reproduction steps. Never publish credentials, private keys, location-sensitive flight logs or personal identifiers.

Please use the existing GitHub Issues workflow to report problems or propose improvements. A screenshot or short demo showing real behavior would help other developers evaluate support, but only share media you have permission to publish.

## Credits

PotensicProxy_TAF is derived from [sk7n4k3d/potensic-proxy](https://github.com/sk7n4k3d/potensic-proxy), with additional implementation work, review history and independent hardware research. Other references are listed in [DOCUMENTATION/UPSTREAMS.md](DOCUMENTATION/UPSTREAMS.md). Follow the applicable licensing and attribution requirements of each project component.
