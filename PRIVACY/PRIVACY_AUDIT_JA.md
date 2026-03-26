# Potensic Atom 2 — プライバシー監査: ユーザーの知らないうちに送信されるデータ (Japanese / 日本語)

> **分析対象ファームウェア:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteIDライブラリ:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — 継続的なBLE/WiFiブロードキャスト（最も侵害性が高い）

`libridtrans.so`（ASTM F3411 / OpenDroneIDプロトコル）を介して、ドローンは以下のデータをBLEおよびWiFi経由で継続的にブロードキャストします:

| データ | API関数 |
|------|-------------|
| **シリアルナンバー** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **リアルタイムGPS位置** (緯度、経度、高度) | `RIDTRANS_SetLocation` |
| **水平/垂直速度** | `RIDTRANS_SetLocation` |
| **飛行方向** | `RIDTRANS_SetLocation` |
| **気圧高度 + 測地高度** | `RIDTRANS_SetLocation` |
| **水平/垂直/速度の精度** | `RIDTRANS_SetLocation` |
| **操縦者の位置** (Operator Location) | `RIDTRANS_SetSystem` |
| **EUカテゴリ + クラス** | `RIDTRANS_SetSystem` |
| **操縦者ID** | `RIDTRANS_SetOperatorID` |
| **自由テキスト** (Self ID) | `RIDTRANS_SetSelfID` |
| **認証データ** | `RIDTRANS_SetAuth` |
| **タイムスタンプ** | `RIDTRNAS_SetTime` |

約1km圏内にBLE/WiFi受信機を持つ**誰でも**、これらのデータをリアルタイムで読み取ることができます。これは**仕様通り**です（EU/FAA規制に基づく）が、ブロードキャストされるデータの範囲についてユーザーが十分に認識していない可能性があります。

## 2. 写真と動画のEXIF/XMPメタデータ

すべての写真および動画ファイルには、メタデータが埋め込まれています（XMP名前空間 `http://www.ipotensic.com/drone/1.0/`）:

| フィールド | 内容 |
|-------|---------|
| `GPSLatitude` / `GPSLongitude` | 正確な位置情報 |
| `GPSAltitude` | 高度 |
| `AbsoluteAltitude` / `RelativeAltitude` | 絶対高度と相対高度 |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | カメラの向き |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | ドローンの姿勢 |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3D速度 |
| `CameraSerialNumber` / `BodySerialNumber` | シリアルナンバー |
| `Make` / `Model` | ハードウェア識別子 |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | カメラ設定 |

このデータは**ファイルに埋め込まれています** — 写真や動画を共有すると、これらすべてのデータが一緒に送信されます。

## 3. MP4動画内のプライベート「Potensic MetaData」トラック

MP4動画録画には、`UserDefAtom`エントリを含む**プライベートデータトラック**（`Create private data track`）が含まれています — 動画ファイル内にエンコードされた完全なテレメトリストリーム（GPS、姿勢、速度など、フレーム単位）です。

## 4. スマートフォンアプリへのハートビート — 継続的なデータストリーム

`camera_heartbeat`は接続されたスマートフォンアプリに継続的に以下を送信します:
- 動作モード
- SDカードの状態
- メディアの状態
- WiFi Directの状態
- 複合ステータス
- アクティブなメディアモード

## 5. スマートフォン認証

ドローンは接続されたスマートフォンを**識別し認証します**:
- `is_cellphone_id_authenticated` — スマートフォンが認可されているか確認
- `cellphone id authenticated: %s` — スマートフォンのIDをログに記録
- トークンは `/data/config/token` に保存

## 6. 飛行禁止区域 — サイレントに適用

NFZシステム（`deepsea_nfz`）:
- Potensicサーバーから制限区域をダウンロード（スマートフォンアプリ経由）
- `/data/no_fly_zone/` に保存（円形 + ポリゴン形式）
- フライトコントローラーがこれらの区域での**飛行を拒否**
- ユーザーはroot権限なしでは**削除できない**

## 行われていないこと（肯定的な点）

- ドローンは**インターネットに直接接続しない** — すべての通信はスマートフォンアプリを経由
- ドローンからの直接的なクラウドテレメトリなし
- 自律的な「フォンホーム」動作なし

## リスクまとめ

| リスク | 深刻度 | ユーザーの制御 |
|------|----------|-------------|
| RemoteIDが位置情報/シリアルを継続的にブロードキャスト | **高** | なし（rootなしでは無効化不可） |
| 共有した写真にGPS/シリアルが埋め込まれている | **中** | 共有前にEXIFを除去 |
| 動画内のテレメトリトラック | **中** | 簡単に削除する方法なし |
| サーバーによるNFZの強制適用 | **中** | rootなしでは制御不可 |
| スマートフォン認証 | **低** | ペアリングとしては通常の動作 |
