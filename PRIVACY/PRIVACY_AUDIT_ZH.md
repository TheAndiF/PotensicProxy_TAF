# Potensic Atom 2 — 隐私审计：用户不知情下发送的数据 (Chinese / 中文)

> **分析固件：** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID 库：** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC：** HiSilicon Hi3519DV500

---

## 1. RemoteID — 持续 BLE/WiFi 广播（最具侵入性）

通过 `libridtrans.so`（ASTM F3411 / OpenDroneID 协议），无人机通过 BLE 和 WiFi 持续广播以下数据：

| 数据 | API 函数 |
|------|----------|
| **序列号** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **实时 GPS 位置** (纬度, 经度, 高度) | `RIDTRANS_SetLocation` |
| **水平/垂直速度** | `RIDTRANS_SetLocation` |
| **飞行方向** | `RIDTRANS_SetLocation` |
| **气压高度 + 大地高度** | `RIDTRANS_SetLocation` |
| **水平/垂直/速度精度** | `RIDTRANS_SetLocation` |
| **飞手位置** (操控者位置) | `RIDTRANS_SetSystem` |
| **欧盟类别 + 等级** | `RIDTRANS_SetSystem` |
| **操控者 ID** | `RIDTRANS_SetOperatorID` |
| **自由文本** (Self ID) | `RIDTRANS_SetSelfID` |
| **认证数据** | `RIDTRANS_SetAuth` |
| **时间戳** | `RIDTRNAS_SetTime` |

在约 1 公里范围内，**任何人**使用 BLE/WiFi 接收器都可以实时读取所有这些数据。这是**设计如此**（欧盟/FAA 法规要求），但用户可能并未充分了解广播数据的范围。

## 2. 照片和视频中的 EXIF/XMP 元数据

每张照片和视频文件都包含嵌入的元数据（XMP 命名空间 `http://www.ipotensic.com/drone/1.0/`）：

| 字段 | 内容 |
|------|------|
| `GPSLatitude` / `GPSLongitude` | 精确位置 |
| `GPSAltitude` | 高度 |
| `AbsoluteAltitude` / `RelativeAltitude` | 绝对高度和相对高度 |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | 云台朝向 |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | 无人机姿态 |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 三维速度 |
| `CameraSerialNumber` / `BodySerialNumber` | 序列号 |
| `Make` / `Model` | 硬件标识 |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | 相机设置 |

这些数据**嵌入在文件中** — 如果您分享照片或视频，所有这些数据都会一同传出。

## 3. MP4 视频中的私有 "Potensic MetaData" 轨道

MP4 视频录制包含一个**私有数据轨道**（`Create private data track`），其中包含 `UserDefAtom` 条目 — 一个完整的遥测数据流编码在视频文件中（GPS、姿态、速度等，逐帧记录）。

## 4. 心跳包至手机应用 — 持续数据流

`camera_heartbeat` 持续向已连接的手机应用发送以下数据：
- 操作模式
- SD 卡状态
- 媒体状态
- WiFi Direct 状态
- 综合状态
- 当前媒体模式

## 5. 手机认证

无人机会**识别和认证**已连接的手机：
- `is_cellphone_id_authenticated` — 检查手机是否已授权
- `cellphone id authenticated: %s` — 记录手机 ID
- 令牌存储在 `/data/config/token`

## 6. 禁飞区 — 静默执行

禁飞区系统（`deepsea_nfz`）：
- 从 Potensic 服务器下载限制区域（通过手机应用）
- 存储在 `/data/no_fly_zone/`（圆形 + 多边形格式）
- 飞控**拒绝在这些区域飞行**
- 用户**无法在没有 root 权限的情况下移除**这些限制

## 未执行的操作（积极方面）

- 无人机**不会直接连接互联网** — 所有通信都通过手机应用进行
- 无人机不存在直接的云端遥测上传
- 无自主"回传"行为

## 风险总结

| 风险 | 严重程度 | 用户控制 |
|------|----------|----------|
| RemoteID 持续广播位置/序列号 | **高** | 无（未经 root 无法禁用） |
| GPS/序列号嵌入在分享的照片中 | **中** | 分享前清除 EXIF |
| 视频中的遥测轨道 | **中** | 无简单方法移除 |
| 禁飞区由服务器强制执行 | **中** | 未经 root 无法控制 |
| 手机认证 | **低** | 配对的正常行为 |
