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

---

## Flight Commands (TX)

All flight commands use **short 0x0301**, **FE type 0x14**.

### Command format (np1.java)

```
FF FD [len_LE] [01 03] [04] [seq_lo] [seq_hi] [group] [subcmd] [xor]
                        ^^^
                        cmd byte (np1 registered as byte 4 in cr1.java)
```

Sequence counter starts at 125, increments per call (fk5.java).

### Commands (mp1.java enum)

| Command | Group | Subcmd | Description |
|---------|-------|--------|-------------|
| TAKEOFF | 0x01 | 0x01 | Auto takeoff (hover at ~1.2m) |
| CANCEL_TAKEOFF | 0x01 | 0x00 | Cancel takeoff |
| LAND | 0x02 | 0x01 | Auto land |
| CANCEL_LAND | 0x02 | 0x00 | Cancel landing |
| RETURN | 0x03 | 0x01 | Return to home |
| CANCEL_RETURN | 0x03 | 0x00 | Cancel RTH |
| WAYPOINT | 0x04 | 0x01 | Start waypoint mission |

**Important:** Commands must be sent **repeatedly** (20x at 50ms intervals) to simulate button hold, as the official app does.

---

## Camera Commands (TX)

Camera commands use **short 0x1200**, **FE type 0x15**.

### Command format

```
FF FD [len_LE] [00 12] [cmd_byte] [data...] [xor]
```

| Cmd | Description |
|-----|-------------|
| 0x50 | Toggle video recording |
| 0x51 | Take photo |
| 0x73 | Start live view (data: 0x00, 0x64) |
| 0xD8 | LiveViewParams (resolution + bitrate) |
| 0xD9 | Request IDR frame |
| 0xD2 | WifiDirectSwitch (data: 0x01=enter + 16 bytes phoneId) |

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

## OTA Server

- Production: `https://atom-server.potensic.com`
- Auth: AES-256-GCM, key `be0343d13327a710cbed4a2a1e987837`
- Firmware format: DEPS container (magic + JSON manifest + encrypted modules)
- Product ID: ATOM 2 = 179 (DSDR23A)
