# Potensic Proxy

Android app that bridges a Potensic Atom 2 drone controller (USB) to a web browser, providing live video, full telemetry, and flight commands via a cyberpunk web UI.

## Features

- **Live video** — 1920x1080 H265 decoded by Android hardware, streamed as MJPEG
- **Full telemetry** — Battery, voltage, GPS, altitude, speed, heading, pitch/roll, wind, satellites
- **Flight commands** — Takeoff, Land, RTH, Photo, Record
- **Physical joystick feedback** — Real-time display of controller stick positions
- **Remoter battery** — Controller voltage and battery status
- **Web UI** — Cyberpunk-themed dashboard at `http://<phone-ip>:9090`

## How it works

```
Browser (:9090) → ProxyService → USB AOA → Controller → RF → Drone
```

The phone connects to the Potensic controller via USB Accessory (AOA). The app acts as a transparent proxy, forwarding commands from the web UI and streaming video/telemetry back.

## Protocol

The full reversed protocol is documented in [PROTOCOL.md](PROTOCOL.md), including:
- FE transport layer (16-byte headers, type-based routing)
- FF FD inner command frames (checksummed)
- Telemetry parsing (20+ fields from 6 different packet types)
- Flight command format (sequence-numbered, repeated for reliability)
- Video frame reassembly (H265 NAL extraction from FE type 0x06)
- BLE pairing protocol
- WiFi Direct architecture

## API

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web UI |
| `/api/status` | GET | Connection status + stats |
| `/api/telemetry` | GET | Current telemetry JSON |
| `/api/video/mjpeg` | GET | MJPEG live stream |
| `/api/video/snapshot` | GET | Single JPEG frame |
| `/api/video/h265` | GET | Raw H265 Annex B stream (for ffplay/VLC) |
| `/api/video/stats` | GET | Video decoder stats |
| `/api/cmd/takeoff` | POST | Auto takeoff |
| `/api/cmd/land` | POST | Auto land |
| `/api/cmd/rth` | POST | Return to home |
| `/api/cmd/emergency` | POST | Emergency stop |
| `/api/cmd/photo` | POST | Take photo |
| `/api/cmd/record` | POST | Toggle recording |
| `/api/test/joy` | GET | Set joystick values (?t=&y=&p=&r=) |
| `/api/wifi/scan` | POST | Start BLE scan for drone |
| `/api/wifi/activate` | POST | Send WifiDirectSwitch via USB |
| `/api/wifi/connect` | POST | Connect TCP to drone WiFi |
| `/api/wifi/status` | GET | WiFi/BLE connection status |
| `/api/logs` | GET | Log buffer (?since=N) |
| `/ws/control` | WS | Telemetry broadcast |
| `/ws/video` | WS | Raw H265 NAL stream |

## Building

```bash
./gradlew assembleDebug
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Requires Android SDK 36, Kotlin, JDK 17.

## Hardware

Tested with:
- **Drone:** Potensic Atom 2 (DSDR23A)
- **Controller:** Basic deepsea controller (no WiFi)
- **Phone:** Pixel 9 Pro Fold (Android 15)

## Limitations

- **No virtual joystick control** — The basic controller does not forward USB joystick data to the drone. Virtual joystick requires WiFi Direct (PTD-1 controller) or firmware modification.
- **WiFi Direct** — Code is implemented but the basic Atom 2 controller lacks WiFi hardware. The RTL8821CS chip is present on the drone PCB but not activated.

## Reversed from

- Official APK: `com.ipotensic.atom` (Potensic Eve v2.9.6)
- Decompiled with jadx (8072 classes)
- Key classes: `AOAEngine.java`, `dl1.java`, `vt1.java`, `mu1.java`, `fu1.java`, `np1.java`, `mp1.java`, `zy2.java`, `l56.java`, `kc4.java`
