# Potensic Atom 2 — Privacy Audit: Data Sent Without User Knowledge

> **Firmware analyzed:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID library:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Continuous BLE/WiFi Broadcast (Most Invasive)

Via `libridtrans.so` (ASTM F3411 / OpenDroneID protocol), the drone continuously broadcasts the following data over BLE and WiFi:

| Data | API Function |
|------|-------------|
| **Serial number** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Real-time GPS position** (lat, lon, alt) | `RIDTRANS_SetLocation` |
| **Horizontal/vertical speed** | `RIDTRANS_SetLocation` |
| **Flight direction** | `RIDTRANS_SetLocation` |
| **Barometric + geodetic altitude** | `RIDTRANS_SetLocation` |
| **Horizontal/vertical/speed accuracy** | `RIDTRANS_SetLocation` |
| **Pilot position** (Operator Location) | `RIDTRANS_SetSystem` |
| **EU category + class** of the drone | `RIDTRANS_SetSystem` |
| **Operator ID** | `RIDTRANS_SetOperatorID` |
| **Free text** (Self ID) | `RIDTRANS_SetSelfID` |
| **Authentication data** | `RIDTRANS_SetAuth` |
| **Timestamp** | `RIDTRNAS_SetTime` |

**Anyone** with a BLE/WiFi receiver within ~1km range can read all this data in real time. This is **by design** (EU/FAA regulations), but users may not be fully aware of the extent of data broadcast.

## 2. EXIF/XMP Metadata in Photos and Videos

Every photo and video file contains embedded metadata (XMP namespace `http://www.ipotensic.com/drone/1.0/`):

| Field | Content |
|-------|---------|
| `GPSLatitude` / `GPSLongitude` | Exact position |
| `GPSAltitude` | Altitude |
| `AbsoluteAltitude` / `RelativeAltitude` | Absolute and relative altitudes |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Camera orientation |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Drone orientation |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3D speed |
| `CameraSerialNumber` / `BodySerialNumber` | Serial numbers |
| `Make` / `Model` | Hardware identifiers |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Camera settings |

This data is **embedded in the files** — if you share a photo or video, all of this goes with it.

## 3. Private "Potensic MetaData" Track in MP4 Videos

MP4 video recordings contain a **private data track** (`Create private data track`) with `UserDefAtom` entries — a complete telemetry stream encoded within the video file (GPS, attitude, speed, etc. on a per-frame basis).

## 4. Heartbeat to Phone App — Continuous Data Stream

The `camera_heartbeat` continuously sends to the connected phone app:
- Operating mode
- SD card status
- Media status
- WiFi Direct status
- Composite status
- Active media mode

## 5. Phone Authentication

The drone **identifies and authenticates** the connected phone:
- `is_cellphone_id_authenticated` — checks if the phone is authorized
- `cellphone id authenticated: %s` — logs the phone's ID
- Token stored in `/data/config/token`

## 6. No-Fly Zones — Silently Enforced

The NFZ system (`deepsea_nfz`):
- Downloads restriction zones from Potensic servers (via the phone app)
- Stores them in `/data/no_fly_zone/` (circle + polygon formats)
- The Flight Controller **refuses to fly** in these zones
- The user **cannot remove them** without root access

## What is NOT Done (Positive)

- The drone **does not connect directly to the Internet** — all communication goes through the phone app
- No direct cloud telemetry from the drone
- No autonomous "phone home" behavior

## Risk Summary

| Risk | Severity | User Control |
|------|----------|-------------|
| RemoteID broadcasting position/serial continuously | **High** | None (cannot be disabled without root) |
| GPS/serial embedded in shared photos | **Medium** | Strip EXIF before sharing |
| Telemetry track in videos | **Medium** | No simple way to remove |
| NFZ enforced by server | **Medium** | None without root |
| Phone authentication | **Low** | Normal for pairing |
