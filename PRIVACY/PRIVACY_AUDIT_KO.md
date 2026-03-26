# Potensic Atom 2 — 개인정보 감사: 사용자 모르게 전송되는 데이터 (Korean / 한국어)

> **분석된 펌웨어:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID 라이브러리:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — 지속적인 BLE/WiFi 브로드캐스트 (가장 침해적)

`libridtrans.so` (ASTM F3411 / OpenDroneID 프로토콜)를 통해 드론은 BLE 및 WiFi로 다음 데이터를 지속적으로 브로드캐스트합니다:

| 데이터 | API 함수 |
|------|-------------|
| **시리얼 넘버** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **실시간 GPS 위치** (위도, 경도, 고도) | `RIDTRANS_SetLocation` |
| **수평/수직 속도** | `RIDTRANS_SetLocation` |
| **비행 방향** | `RIDTRANS_SetLocation` |
| **기압 + 측지 고도** | `RIDTRANS_SetLocation` |
| **수평/수직/속도 정확도** | `RIDTRANS_SetLocation` |
| **조종사 위치** (Operator Location) | `RIDTRANS_SetSystem` |
| **EU 카테고리 + 클래스** (드론 분류) | `RIDTRANS_SetSystem` |
| **운영자 ID** | `RIDTRANS_SetOperatorID` |
| **자유 텍스트** (Self ID) | `RIDTRANS_SetSelfID` |
| **인증 데이터** | `RIDTRANS_SetAuth` |
| **타임스탬프** | `RIDTRNAS_SetTime` |

~1km 범위 내에서 BLE/WiFi 수신기를 가진 **누구나** 이 모든 데이터를 실시간으로 읽을 수 있습니다. 이는 **설계에 의한 것**입니다 (EU/FAA 규정). 그러나 사용자는 브로드캐스트되는 데이터의 범위를 충분히 인식하지 못할 수 있습니다.

## 2. 사진 및 동영상의 EXIF/XMP 메타데이터

모든 사진 및 동영상 파일에는 메타데이터가 포함되어 있습니다 (XMP 네임스페이스 `http://www.ipotensic.com/drone/1.0/`):

| 필드 | 내용 |
|-------|---------|
| `GPSLatitude` / `GPSLongitude` | 정확한 위치 |
| `GPSAltitude` | 고도 |
| `AbsoluteAltitude` / `RelativeAltitude` | 절대 및 상대 고도 |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | 카메라 방향 |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | 드론 방향 |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3D 속도 |
| `CameraSerialNumber` / `BodySerialNumber` | 시리얼 넘버 |
| `Make` / `Model` | 하드웨어 식별자 |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | 카메라 설정 |

이 데이터는 **파일에 내장**되어 있습니다 — 사진이나 동영상을 공유하면 이 모든 데이터가 함께 전송됩니다.

## 3. MP4 동영상 내 비공개 "Potensic MetaData" 트랙

MP4 동영상 녹화에는 `UserDefAtom` 항목이 포함된 **비공개 데이터 트랙** (`Create private data track`)이 있습니다 — 동영상 파일 내에 인코딩된 완전한 텔레메트리 스트림입니다 (프레임별 GPS, 자세, 속도 등).

## 4. 휴대폰 앱으로의 하트비트 — 지속적인 데이터 스트림

`camera_heartbeat`는 연결된 휴대폰 앱으로 지속적으로 다음을 전송합니다:
- 작동 모드
- SD 카드 상태
- 미디어 상태
- WiFi Direct 상태
- 복합 상태
- 활성 미디어 모드

## 5. 휴대폰 인증

드론은 연결된 휴대폰을 **식별하고 인증**합니다:
- `is_cellphone_id_authenticated` — 휴대폰이 인가되었는지 확인
- `cellphone id authenticated: %s` — 휴대폰의 ID를 로깅
- 토큰은 `/data/config/token`에 저장

## 6. 비행 금지 구역 — 무단으로 적용됨

NFZ 시스템 (`deepsea_nfz`):
- Potensic 서버에서 제한 구역을 다운로드 (휴대폰 앱을 통해)
- `/data/no_fly_zone/`에 저장 (원형 + 다각형 형식)
- 비행 컨트롤러가 해당 구역에서 **비행을 거부**
- 루트 접근 없이는 사용자가 **제거할 수 없음**

## 수행되지 않는 것 (긍정적)

- 드론은 **인터넷에 직접 연결하지 않음** — 모든 통신은 휴대폰 앱을 통해 이루어짐
- 드론에서 직접적인 클라우드 텔레메트리 없음
- 자율적인 "phone home" 동작 없음

## 위험 요약

| 위험 | 심각도 | 사용자 제어 |
|------|----------|-------------|
| RemoteID가 위치/시리얼을 지속적으로 브로드캐스트 | **높음** | 없음 (루트 없이 비활성화 불가) |
| 공유된 사진에 GPS/시리얼 내장 | **중간** | 공유 전 EXIF 제거 |
| 동영상 내 텔레메트리 트랙 | **중간** | 간단한 제거 방법 없음 |
| 서버에 의해 NFZ 적용 | **중간** | 루트 없이 불가 |
| 휴대폰 인증 | **낮음** | 페어링에 일반적 |
