# HTTP and WebSocket API

This is a source-derived endpoint index for the supplied PotensicProxy_TAF snapshot. The authoritative implementations are `app/src/main/java/com/potensic/proxy/WebServer.kt` and the `api/*Routes.kt` files. This is **not** a complete payload schema or a guarantee of controller support.

The HTTP server listens on port **9090** and binds to `0.0.0.0` in the inspected source.

## Status and diagnostics

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Web interface |
| GET | `/api/status` | Connection and transfer status |
| GET | `/api/telemetry` | Current telemetry |
| GET | `/api/state` | Application state |
| GET | `/api/control/state` | Control state |
| GET | `/api/diagnostics` | Diagnostic snapshot and counters |
| GET | `/api/logs` | Logs |
| GET | `/api/version` | Version information |

## Video and media

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/video/h265` | Raw video stream |
| GET | `/api/video/h264` | Redirect to H.265 endpoint in the inspected code |
| GET | `/api/video/mjpeg` | MJPEG video |
| GET | `/api/video/snapshot` | Single JPEG snapshot |
| GET | `/api/video/stats` | Video statistics |
| POST | `/api/video/activate` | Activate live view |
| POST | `/api/video/request-idr` | Request an IDR/key frame |
| GET | `/api/media/local` | Local media listing |
| POST | `/api/media/snapshot` | Capture/store a snapshot |

## Connections, control and RF diagnostics

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/api/connect` | Connect USB accessory |
| POST | `/api/disconnect` | Disconnect |
| POST | `/api/cmd/takeoff` | Takeoff command |
| POST | `/api/cmd/land` | Land command |
| POST | `/api/cmd/rth` | Return-to-home command |
| POST | `/api/cmd/emergency` | Emergency command |
| POST | `/api/cmd/photo` | Trigger photo |
| POST | `/api/cmd/record` | Control recording |
| POST | `/api/cmd/pair` | Pairing command |
| POST | `/api/rf/probe` | RF parameter probe |
| POST | `/api/usb/send` | Send USB data |
| POST | `/api/cmd/raw/{hex}` | Send raw command |
| POST | `/api/wifi/activate` | Request WiFi Direct switch |
| POST | `/api/wifi/scan` | Start BLE scan |
| POST | `/api/wifi/connect` | Start Wi-Fi connection |
| GET | `/api/wifi/status` | Wi-Fi/BLE status |

## Missions, maps and updates

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/missions` | List missions |
| GET | `/api/missions/{id}` | Read mission |
| PUT | `/api/missions/{id}` | Save mission |
| DELETE | `/api/missions/{id}` | Delete mission |
| GET | `/api/missions/{id}/export/potensic` | Export Potensic mission data |
| GET | `/api/map/config` | Map source configuration |
| POST | `/api/map/config` | Update map configuration |
| GET | `/api/map/regions` | Offline regions |
| GET | `/api/updates/status` | Update status |
| GET | `/api/updates/check` | Check for updates |
| POST | `/api/updates/download` | Download update |
| POST | `/api/updates/install` | Request installation |

## WebSockets

| Path | Purpose |
| --- | --- |
| `/ws/usb` | USB packet monitoring |
| `/ws/video` | Video transport |
| `/ws/control` | Control/status traffic |

The API contains additional endpoints; consult the Kotlin routes for request fields, response formats, requirements and error behavior.

## Security warning

This is **not** a public remote-control API. Control and diagnostic endpoints can affect physical equipment. Authentication/authorization and exposure of this server must be independently reviewed before allowing untrusted clients. Avoid testing raw, RF or flight commands on a live aircraft without appropriate safety controls. Do not share sensitive logs or credentials.
