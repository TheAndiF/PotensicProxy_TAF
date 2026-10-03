# Potensic Atom 2 — USB Protocol Reference

Reversed from the official `com.ipotensic.atom` APK (Potensic Eve v2.9.6) via jadx decompilation (8072 classes).

## Architecture

```
Browser (:9090)
  → HTTP/WebSocket
  → ProxyService (Android foreground service)
  → UsbAccessoryManager (AOA read/write threads)
  → USB Accessory (deepsea controller)
  → PixSync 4.0 RF (2.4 GHz)
  → Drone (Potensic Atom 2)
```

**USB AOA identifiers:**
- Manufacturer: `deepsea`
- Model: `android.potensic.atom`

---

## FE Transport Layer

All USB data is encapsulated in FE frames.

### FE Header (16 bytes)

```
Offset  Size  Field
0       1     Magic: 0xFE
1-6     6     Reserved: 0x00
7       1     Type (see table below)
8-11    4     Reserved: 0x00
12-15   4     Payload length (BIG-ENDIAN)
```

### FE Types

| Type | Direction | Description |
|------|-----------|-------------|
| 0x05 | RX | Camera response (has cmd byte at inner offset 6) |
| 0x06 | RX | Video stream (H265) |
| 0x12 | TX | Handshake |
| 0x14 | TX/RX | Flight commands / telemetry |
| 0x15 | TX | Camera commands |
| 0x21 | RX | Flight telemetry (GPS, state, joystick) |
| 0x31 | RX | Flight command response |
| 0x32 | RX | GPS data |
| 0x41 | RX | Remoter status (battery, buttons, joystick) |

---

## Inner FF FD Frame

Inside each FE payload (except video), data is wrapped in FF FD/FE frames.

```
Offset  Size  Field
0       1     0xFF
1       1     0xFD or 0xFE
2-3     2     Length (uint16 LE) = iW
4-5     2     Command short (uint16 LE)
6+      N     Data (for FE types 0x21/0x41, NO cmd byte)
              Data (for FE type 0x05, cmd byte at offset 6, data at 7)
3+iW    1     XOR checksum (bytes 2 through 3+iW-1)
```

### Checksum calculation

```kotlin
var xor = 0
for (i in 2 until frame.size - 1) xor = xor xor (frame[i].toInt() and 0xFF)
frame[frame.size - 1] = xor.toByte()
```

---

## Telemetry (RX)

### FE 0x21, short 0x0000 — ATOM FlightRevFlightInfoData (PotensicPro)

The original PotensicPro parser supplies the cockpit battery percentage and relative height directly from this Flight Info frame. The aircraft battery percentage is **not derived from voltage**.

For the long layout, PotensicPro reads `horizontalDistance` as a 32-bit value and then advances the parser base by two bytes before all following fields. Effective long-layout offsets are therefore:

| Offset | Type | Scale | Field |
|--------|------|-------|-------|
| +0 | uint16 LE | /100 | flightVoltage |
| +2 | uint16 LE | /100 | remoterVoltage |
| +4 | int32 LE | /1E7 | longitude |
| +8 | int32 LE | /1E7 | latitude |
| +12 | uint8 | | satellitesNum |
| +13 | uint16 LE | | directToNorth |
| +15 | int32 LE | /10 | horizontalDistance |
| +19 | int16 LE | /10 | **verticalDistance** (relative cockpit height) |
| +21 | uint16 LE | /10 | horizontalSpeed |
| +23 | int16 LE | /10 | verticalSpeed |
| +25 | uint8 | | **remainedBattery (0-100%)** |
| +26 | uint8 | | remainedFlyTime |
| +27 | int16 LE | | angleOfPitch |
| +29 | int16 LE | | angleOfRoll |
| +33 | int16 LE | /100 | windSpeed |
| +35 | int16 LE | /100 | windDirection |
| +37 | int64 LE | | gpsUtcTime |
| +45 | int32 LE | /1000 | altitude (separate altitude field) |
| +49 | int8 | | tofHeight |

TAF cockpit semantics follow PotensicPro: **Height/Höhe = `verticalDistance`**. The separate `altitude` and `tofHeight` values remain available as technical telemetry and must not overwrite the cockpit height.

PotensicPro battery display threshold: **green above 20%**, **red at 20% or below**. The original takeoff logic additionally warns below 20% and suppresses takeoff below 5%; these behavioral thresholds are documented here but are not automatically applied to unrelated controls.

### FE 0x21, short 0x0200 — FlightRevGps (vt1.java)

Main GPS/flight telemetry. Data starts at inner offset 6.

| Offset | Type | Scale | Field |
|--------|------|-------|-------|
| +0 | uint16 LE | /1000 | flightVoltage (V) — 7.5V for 2S LiPo |
| +2 | uint16 LE | /100 | remoterVoltage (V) — 3.48V for controller |
| +4 | int32 LE | /1E7 | longitude (degrees) |
| +8 | int32 LE | /1E7 | latitude (degrees) |
| +12 | uint8 | | satellitesNum |
| +13 | uint16 LE | | directToNorth (heading, degrees) |
| +15 | int32 LE | /10 | horizontalDistance (m) |
| +19 | int16 LE | /10 | verticalDistance (m) |
| +21 | uint16 LE | /10 | horizontalSpeed (m/s) |
| +23 | int16 LE | /10 | verticalSpeed (m/s) |
| +25 | uint8 | | remainedBattery (0-100%) |
| +26 | uint8 | | reserve1 |
| +27 | int16 LE | | angleOfPitch (degrees) |
| +29 | int16 LE | | angleOfRoll (degrees) |
| +33 | int16 LE | /100 | windSpeed (m/s) |
| +35 | int16 LE | /100 | windDirection (degrees) |
| +37 | int32 LE | | gpsUtcTime |
| +45 | uint16 LE | | timeFromAutoGoHome |
| +47 | uint8 | | accuracy (GPS SNR) |
| +48 | int32 LE | /1000 | altitude (m) — only if dataLen >= 52 |

### FE 0x21, short 0x0202 — FlightRevState (mu1.java)

Flight state flags (motor state, flight mode, warnings). 32 bytes of bit fields.

### FE 0x21, short 0x0206 — FlightRevLog (au1.java)

Raw flight log data (507 bytes). Not parsed.

### FE 0x21, short 0x0211 — FlightRevRcValue (fu1.java)

Physical joystick positions from controller. Data at inner offset 6.

| Offset | Type | Field |
|--------|------|-------|
| +0 | int16 LE | leftRockerUpDown (throttle, -1000..+1000) |
| +2 | int16 LE | leftRockerLeftRight (yaw) |
| +4 | int16 LE | rightRockerUpDown (pitch) |
| +6 | int16 LE | rightRockerLeftRight (roll) |
| +8 | int16 LE | leftWheel (gimbal tilt) |
| +10 | int16 LE | rightWheel |
| +12-18 | int16 LE x4 | additional fields |

### FE 0x41, short 0x1131 — RemoterRevBattery (hw4.java)

| Offset | Type | Scale | Field |
|--------|------|-------|-------|
| +0 | uint16 LE | /100 | remoterBatteryVoltage (V) |
| +2 | float32 LE | | electricity (percentage) |
| +6 | uint16 LE | | capacity |
| +8 | int8 | | remoterBatteryCap |

### FE 0x41, short 0x1133 — RemoterRevState (kw4.java)

Controller buttons and joystick values.

| Offset | Type | Field |
|--------|------|-------|
| +0 | uint8 bits | bit0=power, bit1=record, bit2=photo, bit3=RTH, bit4=C1, bit5=C2 |
| +1 | uint16 LE | keyFunction |
| +3 | uint16 LE | leftRockerHorizontal |
| +5 | uint16 LE | leftRockerVertical |
| +7 | uint16 LE | rightRockerHorizontal |
| +9 | uint16 LE | rightRockerVertical |
| +11 | uint16 LE | leftWheel |
| +13 | uint16 LE | rightWheel |

### Telemetry dispatch table (du1.java)

| Short | Decimal | Class | Description |
|-------|---------|-------|-------------|
| 0x0200 | 512 | vt1 | FlightRevGps |
| 0x0201 | 513 | it1 | FlightRevLocation |
| 0x0202 | 514 | mu1 | FlightRevState |
| 0x0203 | 515 | eu1 | - |
| 0x0204 | 516 | gt1 | - |
| 0x0205 | 517 | xt1 | FlightRevSpeed |
| 0x0206 | 518 | au1 | FlightRevLog |
| 0x0207 | 519 | gu1 | - |
| 0x0211 | 529 | fu1 | FlightRevRcValue |

### Remoter dispatch table (jw4.java)

| Short | Decimal | Class | Description |
|-------|---------|-------|-------------|
| 0x1130 | 4400 | lw4 | RemoterRevVersion |
| 0x1131 | 4401 | hw4 | RemoterRevBattery |
| 0x1132 | 4402 | iw4 | RemoterRevCalibration |
| 0x1133 | 4403 | kw4 | RemoterRevState |

### FPV / RF Telemetry (RX)

#### FE 0x16 / 0x18 / 0x31, short 0x1719 (5913) — FpvRevFreqParams (射频实时工作参数)

Reported by the remote/drone when RF frequency probe is active (requested via Command 5656 / `0x1618`).
Contains real-time frequency, MCS, SNR, and noise floor per antenna channel.

| Offset | Type | Scale / Unit | Field | Description |
|--------|------|--------------|-------|-------------|
| +0 | uint8 | | result | Operation result code (0 = success) |
| +1 | uint16 LE | MHz | cur_freq | Current RF frequency (e.g. 2412, 5745) |
| +3 | int8 | -2 | cur_mcs | Modulation & Coding Scheme (raw - 2) |
| +4 | uint16 LE | dB: `10*log10(x/36)` | cur_ap_snr | AP Signal-to-Noise Ratio |
| +6 | uint8 | MHz | cur_bandwidth | Current channel bandwidth (10 or 20 MHz) |
| +7 | uint8 | enum | cur_available_band | Country frequency band (1=Single, 2=Dual, 3=Tri) |
| +8 | uint16 LE | dB: `10*log10(x/512)` | tx_2g_chan_snr | 2.4GHz TX channel SNR |
| +10 | int8 | | tx_2g_gain_a | 2.4GHz TX gain antenna A |
| +11 | int8 | | tx_2g_gain_b | 2.4GHz TX gain antenna B |
| +12 | uint16 LE | dB: `10*log10(x/512)` | tx_5g_chan_snr | 5.8GHz TX channel SNR |
| +14 | int8 | | tx_5g_gain_a | 5.8GHz TX gain antenna A |
| +15 | int8 | | tx_5g_gain_b | 5.8GHz TX gain antenna B |
| +16 | uint16 LE | dB: `10*log10(x/512)` | rx_2g_chan_snr | 2.4GHz RX channel SNR |
| +18 | int8 | | rx_2g_gain_a | 2.4GHz RX gain antenna A |
| +19 | int8 | | rx_2g_gain_b | 2.4GHz RX gain antenna B |
| +20 | uint16 LE | dB: `10*log10(x/512)` | rx_5g_chan_snr | 5.8GHz RX channel SNR |
| +22 | int8 | | rx_5g_gain_a | 5.8GHz RX gain antenna A |
| +23 | int8 | | rx_5g_gain_b | 5.8GHz RX gain antenna B |
| +24 | int8 | dBm: `* -1` | rx_2g_noise | 2.4GHz RX noise floor |
| +25 | int8 | dBm: `* -1` | rx_5g_noise | 5.8GHz RX noise floor |
| +26 | int8 | dBm: `* -1` | tx_2g_noise | 2.4GHz TX noise floor |
| +27 | int8 | dBm: `* -1` | tx_5g_noise | 5.8GHz TX noise floor |

### FPV dispatch table (n52.java)

| Short | Decimal | Class | Description |
|-------|---------|-------|-------------|
| 0x1700 | 5888 | FpvRevVersion | FPV module firmware version |
| 0x170B | 5899 | FpvRevSupportFreq | Supported frequency bands list |
| 0x1715 | 5909 | FpvRevConnectState | RF link and pairing connection state |
| 0x1716 | 5910 | FpvRevScanFreq | Channel scan spectrum analysis |
| 0x1717 | 5911 | FpvRevDebug | Low-level RF debug telemetry |
| 0x1719 | 5913 | FpvRevFreqParams | Real-time RF frequency parameters |

---

## Flight Commands (TX)

### App-confirmed flight actions: SendCtrlData / function 0x0014

Takeoff, landing, cancel landing, Return-to-Home and cancel automatic flight use PotensicPro `SendCtrlData` on **FE type 0x14 (APP_TO_FLIGHT)**. The application payload is always 32 bytes. Only `command` and `result_param2` are written; all other payload bytes remain zero.

| Payload offset | Length | Encoding | Meaning |
|---:|---:|---|---|
| +0..+1 | 2 | `00 00` | reserved / zero |
| +2..+3 | 2 | uint16 LE | `command` |
| +4..+19 | 16 | `00` | reserved / zero |
| +20..+23 | 4 | int32 LE | `result_param2` |
| +24..+31 | 8 | `00` | reserved / zero |

| Action | Function | command | result_param2 | TAF builder |
|---|---:|---:|---:|---|
| Takeoff | 0x0014 | 3 | 0 | `buildTakeoff()` |
| Land | 0x0014 | 4 | 0x55 | `buildLand()` |
| Cancel Land | 0x0014 | 4 | 0xAA | `buildCancelLand()` |
| RTH | 0x0014 | 8 | 0 | `buildRTH()` |
| Cancel Auto Fly | 0x0014 | 99 | 0 | `buildCancelAutoFly()` |

The inner FF-FD frame continues to use the normal New-FC 16-bit function field and is transported in the existing 16-byte FE wrapper with **FE type 0x14**. `SendReplyTakeoff` function `0x0015` is a different reply frame. Its documented 5x/50-ms send sequence must not be transferred to `SendCtrlData` takeoff. TAF therefore sends the above `0x0014` actions once per confirmed UI action and does not apply the former 20x/50-ms repetition.

### Legacy 0x0301 path

The older TAF `buildFlightCommand(group, subcmd)` / short `0x0301` path remains only for functions for which no replacement is documented (currently the emergency-stop implementation). It is **not** used for Takeoff, Land, Cancel Land or RTH.

---

## Camera Commands (TX)

TAF uses the PotensicPro USB camera function **0x0020** for normal capture, settings and gallery/media transfer. FE type `0x15` with inner TX header `FF FD` is used for requests; FE type `0x05` with RX header `FF FE` is used for camera responses. LiveView/engineering functions that are independently confirmed remain on short `0x1200`; normal photo/video capture no longer uses `0x1200/0x51` or `0x1200/0x50`.

PotensicPro `UsbCameraHandler` confirms the normal capture payloads: photo `[01]`, video start `[00 01]`, video stop `[00 00]`. Recording state in TAF is updated from the camera response for command `0x00`, where data byte `1` means started and `0` means stopped.

### Command format

```
FF FD [len_LE] [00 12] [cmd_byte] [data...] [xor]
```

| Cmd | Description |
|-----|-------------|
| 0x50 | Engineering/live-view camera command; not used for normal PotensicPro USB recording |
| 0x51 | Engineering/live-view camera command; not used for normal PotensicPro USB photo capture |
| 0x73 | Start live view (data: 0x00, 0x64) |
| 0xD8 | LiveViewParams (resolution + bitrate) |
| 0xD9 | Request IDR frame |
| 0xD2 | WifiDirectSwitch (data: 0x01=enter + 16 bytes phoneId) |

### PotensicPro-compatible USB camera capture/settings/gallery path (short `0x0020`)

The capture/settings/gallery/zoom path sends FE `0x15` APP_TO_CAMERA with inner header `FF FD` and receives FE `0x05` CAMERA_TO_APP with inner header `FF FE`. The inner message short is `0x0020`. The response layout is `cmd`, `status`, then command-specific data. Status `0` indicates success.

Confirmed capture payloads from PotensicPro `UsbCameraHandler`:

| Action | Command payload after function `0x0020` |
|---|---|
| Take photo | `01` |
| Start video | `00 01` |
| Stop video | `00 00` |

Gallery metadata and download details confirmed from `RemoteFileThumbLoader`, `RemoteFileDownloader` and `DownloadData`:

- `0x20` request: command byte followed by ASCII JSON `{"filelist":[...]}`; response JSON field `file_info` provides `file`, `len`, `lrv_len`, and `createtime`.
- `0x1B` request: command byte + offset `uint64 LE` + requested length `uint64 LE` + filename; PotensicPro requests up to `102400` bytes per unit.
- `0x1B` RX normal block after command/status: flag + offset `uint64 LE` + payload length `uint16 LE` + payload.
- `0x1B` RX final block (flag `2`): flag + 32-byte final-block area + offset `uint64 LE` + payload length `uint16 LE` + payload.
- PotensicPro retries after a 1-second unit timeout from the current local file offset and sends `0x1E` when the overall download timeout expires.

| Cmd | Direction | Description |
|-----|-----------|-------------|
| `0x18` | TX/RX | File count; photo/video counts are uint16 little-endian. |
| `0x19` | TX/RX | Paged filename list; photo/video pagination is separate and page size is at most 50. |
| `0x1A` | TX/RX | File details. |
| `0x1B` | TX/RX | Full file download. |
| `0x1C` | TX/RX | Thumbnail download. |
| `0x1D` | TX/RX | Delete file. |
| `0x1E` | TX/RX | Cancel file download. |
| `0x1F` | TX/RX | Cancel thumbnail download. |
| `0x20` | TX/RX | File length/metadata list. |
| `0x21` | TX/RX | Enter gallery. |
| `0x22` | TX/RX | Quit gallery. |

| Cmd | Direction | Description |
|-----|-----------|-------------|
| `0x3E` | TX/RX | Set zoom ratio. TX data is `round(zoom * 100)` as uint32 little-endian. Successful RX returns the applied zoom value in the same integer format. |
| `0x3F` | TX/RX | Get current zoom ratio. TX has no data. Successful RX returns `zoom * 100` as uint32 little-endian. |

Example: `1.50x` is encoded as decimal `150`, bytes `96 00 00 00`, so the inner request payload is `3E 96 00 00 00`.

Zoom capability is not a universal fixed constant. The camera config-menu response (`0x11`) contains resolution/max-zoom pairs for supported video and photo sizes; the current video-resolution entry is used by the cockpit as the active upper zoom limit.

---

## Video Stream (RX)

### FE type 0x06 → Video frame header (CC BB AA FF)

```
Offset  Size  Field
0-3     4     Magic: 0xCC 0xBB 0xAA 0xFF
4-5     2     Width (uint16 LE) — 1920
6-7     2     Height (uint16 LE) — 1080
8-9     2     Frame order (uint16 LE)
10      1     Data type (0=video, 1=data, 2=other)
11      1     Reserved (0=normal, 1=intra-frame)
12-15   4     Payload length (int32 LE)
16-19   4     Real data length (int32 LE)
20-23   4     CRC32 checksum (int32 LE)
24+     N     H265 NAL data
```

### H265 NAL types

| Byte after 00 00 00 01 | Type |
|------------------------|------|
| 0x02 | P-frame |
| 0x26 | IDR (keyframe) |
| 0x40 | VPS |
| 0x42 | SPS |
| 0x44 | PPS |
| 0x4E | SEI |

### Frame reassembly

Video frames span multiple FE packets. Only `feType == 0x06` packets contain video.
A new frame starts when the FE payload begins with `CC BB AA FF`.
Subsequent FE type 0x06 packets are continuation data.
Validate: `width == 1920 && height == 1080` (or 1280x720) to avoid false positives.

---

## Init Sequence (TX)

Sent on USB connection, with 50ms delay between commands:

| # | Type | Description | Hex |
|---|------|-------------|-----|
| 1 | 0x16 | GET_FPV_INFO | `fffd030000161500` |
| 2 | 0x17 | REMOTER_GET_INFO | `fffe04007310006700` |
| 3 | 0x16 | GET_SETTINGS | `fffd030035162000` |
| 4 | 0x15 | CAMERA_GET_MODE | `fffd040000122036` |
| 5 | 0x16 | GET_FPV_INFO | `fffd030000161500` |
| 6 | 0x14 | FLIGHT_INIT | `fffd0600010300 7e 00 7a` |
| 7 | 0x15 | CAMERA_GET_MODE | `fffd040000122036` |
| 8 | 0x15 | CAMERA_GET_STATUS | `fffd040000120117` |
| 9 | 0x15 | LIVEVIEW_START | `fffd050000127300 64` |

Then send LiveViewParams (1080p, 5000 Kbps).

**Note:** `FLIGHT_SET_MODE` removed from init to preserve user controller config (stick mode left/right).

### Heartbeat (TX)

Sent every 100ms to keep connection alive:
```
fe0000000000001400000000000000 0a fffd060000030000000500
```

### Handshake (TX)

First packet sent on AOA connection:
```
fe00000000000012000000000000000100
```

---

## Settings (FlightRevSetting, lu1.java)

| Field | Default | Range | Description |
|-------|---------|-------|-------------|
| limitHeight | 120m | 0-255 | Max altitude |
| limitDistance | 500m | 0-255 | Max distance from home |
| returnHeight | 120m | 0-255 | RTH altitude |
| isBeginnerModeOpen | false | bool | Beginner mode (30m limits) |
| rockerMode | AMERICAN | 0-2 | Stick mode (American/Japanese/Custom) |
| lostAction | RETURN | 0-3 | Signal loss: Return120m/Hover/Land/Return |
| speedMode | NORMAL | 0-2 | Low/Normal/High |

---

## BLE Protocol (WiFi Direct Pairing)

Service: `0000fff0-0000-1000-8000-00805f9b34fb`

| Characteristic | Direction | Description |
|---------------|-----------|-------------|
| fff1 | Read/Notify | Drone → Phone (heartbeats, responses) |
| fff2 | Write | Phone → Drone (commands) |

### Phone ID command (→ fff2)

```
FF FD [len=0x14] [short=0x0000] [mode] [16 bytes phoneId] [xor]
mode: 0x01=2.4GHz, 0x02=5GHz
```

### Heartbeat (← fff1, every 1s)

```
FF FE [len=0x22] [short=0x0001] [battery] [wifiFlags] [wifiMode] [SSID 15B] [0x00] [password 11B] [xor]
```

- `wifiFlags` bit0=2.4GHz, bit1=5.8GHz, bit2=5.1GHz
- `wifiMode` bits 0-2 = mode, bit 4 = open (no password)
- SSID format: `ATOM_XXXX` (null-padded)

### Response (← fff1)

```
FF FE [len=0x05] [short=0x0000] [code] [??] [xor]
code: 1=accepted, 2=rejected
```

**Note:** On the Atom 2 with basic controller, BLE connects and phone ID is accepted, but SSID/password remain empty — the basic controller lacks WiFi hardware. WiFi Direct requires the PTD-1 controller.

---

## Network (WiFi Direct mode)

Only available with PTD-1 controller or equivalent WiFi-equipped hardware.

| Service | Address | Protocol |
|---------|---------|----------|
| Control | 192.168.29.1:8889 | TCP (same FF FD commands) |
| Video | 192.168.29.1:8080 | RTMP |
| Files | 192.168.29.1:80 | HTTP |

---

## Hardware

| Component | Chip | Description |
|-----------|------|-------------|
| Flight Controller | GD32F470VGH6 | ARM Cortex-M4, firmware 725KB |
| Camera SoC | HiSilicon SD3403V100 | Linux, firmware 77MB |
| Secondary MCU | HC32F460JEUA | |
| WiFi/BT | RTL8821CS | Present on PCB but not activated by basic controller |
| NAND | Macronix MX35UF4GE4AD | 4Gbit SPI |
| RAM | Samsung K4A8G16 x2 | |

## OTA Firmware Update Protocol

### Server

| Environment | URL |
|-------------|-----|
| Production | `https://atom-server.potensic.com` |
| Test | `http://atom-admin-test.potensic.com:18080/` |

### Authentication

All API requests use an `Authorization` header encrypted with AES-128-GCM.

**Keys:**
- Primary: `be0343d13327a710cbed4a2a1e987837` (16 bytes)
- Alternate: `dadfa106e2ec41f5a7433d9e0fa8528b`
- Key selection: `zd4.c` flag in APK (default = primary)

**Header format:**
```
Base64( [IV_length (4B BE)] [IV (12B)] [AES-GCM ciphertext] )
```

**Plaintext payload:**
```json
{"userToken": "<token_string>", "timestamp": <unix_epoch>}
```

### Endpoints

| Method | Path | Body | Description |
|--------|------|------|-------------|
| POST | `atom/client/user/login` | Encrypted `{"data": "<AES-GCM(LoginRequest)>"}` | Login, returns encrypted userToken |
| POST | `atom/client/ota/checkUpgrade` | Plain JSON | Check for available updates |
| POST | `atom/client/ota/upgrade` | Plain JSON | Get firmware download URLs |
| POST | `atom/client/ota/upgrade/callback` | Plain JSON | Report upgrade result |
| GET | `@Url` (streaming) | — | Download firmware binary |
| GET | `atom/client/noFlyZone/upgradeV2` | Query params | No-fly zone database update |

### Login request

Body is AES-GCM encrypted and wrapped in `{"data": "<base64>"}`:

```json
{
  "password": "<base64(password)>",
  "clientType": 2,
  "timestamp": 1774461984,
  "appVersion": "2.9.6",
  "confirm": false,
  "mail": "user@example.com",
  "phoneNumber": null,
  "phoneType": "Pixel 7",
  "phoneSystems": "14"
}
```

Response `userToken` is also AES-GCM encrypted. Decrypt to get:
```
<userId>:<email>:<clientType>:<sessionId>:null:null:2
```

### Check upgrade request

Plain JSON body (NOT encrypted):

```json
{
  "appName": "Potensic Eve",
  "appVersion": "2.9.6",
  "clientType": 2,
  "flightVersion": "V021",
  "rcVersion": "V017",
  "flightSN": "<drone_serial>",
  "rcSN": "<rc_serial>",
  "languageType": 1,
  "product": 179
}
```

Response:
```json
{
  "hasNewVersion": true,
  "hasNewAppVersion": false,
  "hasNewFirmVersion": true,
  "forceUpgradeFirm": false
}
```

### Upgrade request (get download URLs)

Same body format as checkUpgrade. Requires valid `userToken` in auth header.

Response contains up to 3 packages:

```json
{
  "dependsApp": false,
  "flightPkg": {
    "name": "FLIGHT",
    "version": "V024",
    "downloadUrl": "https://...oci.customer-oci.com/.../atom2_v024.02.bin",
    "md5": "66a6d86946e3b2cad781f6dda96eca6c",
    "fileName": "atom2_v024.02_20251230_1767094258527.bin",
    "fileSize": 82457205,
    "isForce": false
  },
  "rcPkg": { ... },
  "appPkg": { ... }
}
```

Firmware binaries are hosted on Oracle Cloud Infrastructure (OCI) Object Storage in `eu-frankfurt-1`.

### Product IDs

| Product | Model | ID |
|---------|-------|----|
| ATOM 2 | DSDR23A | 179 |
| ATOM | DSDR04C | — |
| ATOM 2S | DSDR23B | — |
| ATOM SE | DSDR04B | — |

Manufacturer ID: `91440300319694358B` (Shenzhen Botan Intelligence)

---

## DEPS Firmware Container Format

OTA firmware packages use a proprietary container format identified by the `DEPS` magic.

### Header

```
Offset  Size  Field
0       4     Magic: "DEPS" (0x44 0x45 0x50 0x53)
4       4     JSON manifest length (uint32 LE)
8       N     JSON manifest (UTF-8)
8+N     ...   Concatenated firmware modules
```

### Manifest structure

```json
{
  "product_type": "atom2",
  "version": "024.02",
  "modules": [
    {
      "type": "fcs",
      "name": "fcs_atom2_gd32f470vg_v4.8.8_20251230.bin",
      "version": "4.8.8",
      "size": 725136,
      "padded_size": 725136,
      "md5": "d9ba47e76bdab975647352bdd5eff467",
      "dev_id": [179, 186, 187],
      "prio": 30,
      "product_type": "atom2"
    }
  ]
}
```

| Field | Description |
|-------|-------------|
| `type` | Module type: `fcs`, `cam`, `gimbal`, `bms`, `esc`, `rc`, `itg` |
| `size` | Actual module size in bytes |
| `padded_size` | Size with alignment padding (next module starts at offset + padded_size) |
| `md5` | MD5 of the **decrypted** module (not the encrypted data in the package) |
| `dev_id` | Target device IDs on the drone's internal bus |
| `prio` | Flash priority (lower = first) |

### Module layout

Modules are concatenated immediately after the JSON manifest, each occupying `padded_size` bytes:

```
[DEPS header (8B)] [JSON manifest] [module_0 (padded)] [module_1 (padded)] ... [module_N]
```

### Drone firmware V024 — 12 modules

| Type | Name | Version | Size | dev_id | Target |
|------|------|---------|------|--------|--------|
| bms | bt02a | 1.5.5 | 24 KB | 112 | Battery variant A |
| bms | bt02b | 1.3.4 | 24 KB | 113 | Battery variant B |
| bms | bt02c | 2.0.6 | 35 KB | 114 | Battery variant C |
| bms | bt02d | 3.1.0 | 35 KB | 115 | Battery variant D |
| bms | bt02e | 4.0.6 | 36 KB | 116 | Battery variant E |
| bms | bt02f | 5.0.6 | 25 KB | 117 | Battery variant F |
| bms | bt02g | 6.0.4 | 36 KB | 118 | Battery variant G |
| gimbal | bs | 2.6.8 | 104 KB | 133 | Gimbal bootloader |
| gimbal | updata | 2.3.1 | 104 KB | 131 | Gimbal application |
| fcs | gd32f470vg | 4.8.8 | 725 KB | 179,186,187 | Flight controller |
| esc | lk074 | 2.0.9 | 25 KB | 36,37,38,39 | 4x ESC |
| cam | appsw | 8.12.19 | 77 MB | 6 | Camera SoC |

### RC firmware V018 — 2 modules

| Type | Name | Version | Size | dev_id |
|------|------|---------|------|--------|
| rc | atom2rc | 2.1.5 | 36 KB | 88 |
| itg | atom2rc | 1.0.13 | 972 KB | 226 |

---

## Firmware Upload Protocol (WiFi)

### Upload flow

1. **CamUpgradeStart** — send `(length, version)` to initiate upgrade on drone
2. **Upload request** — send JSON metadata to drone:
   ```json
   {
     "filename": "<module_name>",
     "length": "<total_size>",
     "MD5": "<full_file_md5>",
     "purpose": "upgrade",
     "channel": "big_bw"
   }
   ```
3. **Chunked upload** — send firmware data in chunks

### Chunk formats

**Camera/FPV protocol** (command 5664):
```
[length (2B)] [CRC16 (2B)] [offset (4B)] [data (480B)]
```

**Drone protocol** (command 108):
```
[offset (4B)] [length (2B)] [data (960B)]
```

CRC16 polynomial: `0x1021`

### Security

- No encryption on the WiFi link — firmware chunks are sent as-is
- No key exchange or challenge-response
- MD5 integrity check after full transfer
- Firmware modules remain AES-encrypted during transfer — decryption happens on-device in the bootloader

---

## Firmware Encryption

All modules in the DEPS package are AES-encrypted. Analysis:

- Entropy: ~8.0 bits/byte (indistinguishable from random)
- No repeated 16-byte blocks (rules out AES-ECB)
- No repeated 8-byte or 4-byte blocks
- XOR between similar modules (BMS variants) shows 0% zero bytes — different IVs or keys per module
- The two AES keys in the APK (`be03...` and `dadf...`) are for API auth only, not firmware decryption

The decryption key is stored in the drone's bootloader on the NAND flash. The NAND contents are not encrypted (confirmed by [Neodyme's research](https://neodyme.io/en/blog/drone_hacking_part_1/)), meaning physical NAND extraction yields the key.

### NAND extraction reference

- Chip: Macronix MX35UF4GE4AD-241 (WSON-8, 4Gbit, **1.8V**)
- Interface: SPI (CS#, SI, SO, SCLK, WP#, HOLD#)
- Filesystem: UBIFS
- ECC: BCH t=16, primitive polynomial 17475, pre/post transform: reverse bit order + invert

## Virtual joystick and ATOM gimbal control (2026-09-29)

### Virtual joystick / Send4AxisData
PotensicPro sends its virtual flight controls with flight function `0x0001` (`Send4AxisData`) on the APP_TO_FLIGHT transport. The 11-byte payload starts with channel 4 and uses unsigned axis bytes with neutral 125:

| Payload offset | PotensicPro field | TAF control | Encoding |
|---:|---|---|---|
| +0 | channel | fixed 4 | uint8 |
| +1 | accelerator | Throttle | -1000..1000 -> 0..250, neutral 125 |
| +2 | rotate | Yaw | -1000..1000 -> 0..250, neutral 125 |
| +3 | frontBack | Pitch | -1000..1000 -> 0..250, neutral 125 |
| +4 | leftRight | Roll | -1000..1000 -> 0..250, neutral 125 |
| +5 | gimbal | kept neutral for ATOM series | 125 |
| +6 | camera | neutral | 125 |

PotensicPro's `DataManager.startSend4Axis()` transmits the current frame every 80 ms while control is active. TAF mirrors this cadence while either virtual stick is held and sends a final neutral frame after both sticks are released.

### ATOM gimbal
The original app's generic `SlideController` writes the `Send4AxisData.gimbal` byte, but explicitly hides that app-side slider for the ATOM series. TAF therefore does not invent continuous ATOM gimbal motion through that byte and keeps it neutral.

For ATOM, the app-confirmed absolute pitch controls are sent with flight function `0x001A` (`SendGimbalSettingData`): `pitchControl=1` for 0 degrees, `3` for -45 degrees and `2` for -90 degrees. TAF requests the synchronized gimbal settings first, preserves the remaining settings fields and then applies these confirmed presets. Gimbal state feedback is taken from the confirmed gimbal-state receive path and shown separately as the actual value.

## Camera capture mode state machine (PotensicPro-aligned, 2026-10-02 v1.3)

Normal photo/video capture uses the New-FC camera transport `FE 0x15` with inner `FF FD`, function `0x0020`.
TAF must not treat photo or video as a stateless single command. PotensicPro keeps an explicit capture mode and exposes a status query.

Confirmed payloads:

- Get camera status: `02`
- Switch to video/record mode: `03 00`
- Switch to photo mode: `03 01`
- Take photo: `01`
- Start recording: `00 01`
- Stop recording: `00 00`

Response handling on the same camera function:

- Command `02`: data byte 0 = mode (`00` video, `01` photo); when mode is video, data byte 1 indicates recording state and bytes 2..3 contain record time (uint16 LE) when present.
- Command `03`: data byte 0 confirms mode (`00` video, `01` photo).
- Command `01`: successful photo acknowledgement.
- Command `00`: data byte 0 = `01` recording started, `00` recording stopped.

TAF v1.4 capture flow:

1. Before capture, gallery/list/metadata activity is ended so capture owns the camera command state exclusively; an active file download is not interrupted and blocks a new capture.
2. If the local capture mode is unknown, send `02` and wait for the response.
3. If the desired mode differs, send `03 <mode>` and wait for the `03` acknowledgement.
4. A successful `03` ACK alone is not treated as capture-ready. TAF waits for asynchronous mode notification `0x3A` and/or requests `02` again and requires the target mode to be confirmed.
5. Only after this readiness confirmation is photo/start/stop sent. A late `03`/`02` response cannot trigger a duplicate capture while the capture command is already pending.
6. Status `3` (`Device busy`) immediately cancels the pending ACK timer, applies a short backoff, re-synchronizes with `02`, and permits at most one controlled retry. Status `8` likewise permits one controlled mode correction/retry.
7. UI state changes only after the camera acknowledgement. Each capture stage remains bounded by a timeout.

Asynchronous camera records on function `0x0020` are distinguished from ordinary command responses. `0x39` is CameraLogData and is decoded/logged without treating its first data byte as a command status. `0x3A` is the camera mode-switch notification and participates in the readiness state machine.

Gallery metadata command `0x20` may arrive as fragmented JSON. TAF accumulates fragments and calls `JSON.parse()` only after a complete JSON object/array is assembled; the accumulator is discarded on completion, timeout, gallery close, or passthrough disconnect.

Download command `0x1B` is parsed as a stream of declared camera download frames. Partial frames are buffered until the header-declared payload is complete. `flag=0` appends data and resets the inactivity watchdog without sending another request; `flag=1` ends the current unit and permits the next request; `flag=2` finalizes the file. Duplicate blocks do not trigger an extra request. Offset mismatches resynchronize from the locally confirmed offset. The former fixed overall timeout is replaced by progress/inactivity tracking.

On WebSocket/passthrough disconnect, pending capture, gallery metadata, delete and download state is terminated deterministically. The FE stream demuxer is reset. After reconnect, stale state is not resumed automatically; camera status `0x02` is requested before subsequent camera actions.

Potensic camera status codes used by TAF follow the PotensicPro mapping for the relevant range: 1 command not supported, 2 argument invalid, 3 device busy, 4 unknown error, 5 no SD card, 6 SD full, 7 option invalid, 8 current mode not allowed, 9 recording already started, 10 SD needs format, 11 not enough memory, 12 file system error, 23 file offset error, 24 file MD5 error, 37 need sync state error.

## Camera log 0x39 payload decoding (ATOM, validated 2026-10-02 v1.5)

The ATOM camera response path `FE 0x05 -> inner function 0x0020 -> command 0x39` carries `CameraLogData`, not a normal command/status response. PotensicPro parses the bytes relative to command `0x39` as follows:

| Relative offset | Size | Field | Encoding / meaning |
|---:|---:|---|---|
| +0 | 1 | command | `0x39` |
| +1 | 1 | source | `0=Linux`, `1=LiteOS`, `2=Gimbal` |
| +2 | 2 | payloadLength | `uint16 LE` |
| +4 | payloadLength | payload | source-specific raw bytes |

`CameraLogData` copies exactly `payloadLength` bytes. PotensicPro's `CameraLogRecorder` writes the payload byte-for-byte into separate `CAMLinux`, `CAMLiteos`, and `gimbal` log files; it does not pass the raw payload through a generic text decoder.

The USB capture `2026-10-02_23-58-07_log.xml` validates the same layout. Examples include source 0 with lengths `0x003F`, `0x004F`, `0x0044`, `0x0046`, `0x0063`, `0x0062`, `0x005F`, and source 2 with a 256-byte (`0x0100`) binary payload.

For source 0 (Linux), every captured payload byte is XOR-obfuscated with `0x55`. TAF v1.5 therefore decodes Linux camera logs as `decoded = raw XOR 0x55`. Captured records become readable strings such as camera temperature, observer/cpu telemetry, work-mode state and connection-status messages. Embedded CR/LF/TAB/control bytes are escaped before writing to the Live System Log so one camera record remains one UI log entry.

For source 2 (Gimbal), the validated payload is binary and must not be decoded as UTF-8 text. TAF logs a bounded hexadecimal preview together with the declared payload length. Source 1 (LiteOS) did not occur in the validated capture; TAF therefore preserves it as raw hexadecimal data until its encoding is confirmed instead of assuming the Linux XOR rule.

Decoder rules:

1. Handle `0x39` before ordinary command/status parsing.
2. Require at least the 3-byte post-command header (`source + uint16LE length`).
3. Reject a record when `payloadLength` exceeds the available bytes.
4. Slice exactly `payloadLength` bytes; never include the inner-frame checksum or unrelated trailing bytes in the log payload.
5. Linux (`source=0`): XOR each payload byte with `0x55`, then escape controls to one UI line.
6. LiteOS (`source=1`): raw hex until validated.
7. Gimbal (`source=2`): binary raw hex preview, never generic text decoding.
8. Warn if unexpected bytes remain after the declared payload.
