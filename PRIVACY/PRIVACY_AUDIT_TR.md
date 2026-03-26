# Potensic Atom 2 — Gizlilik Denetimi (Turkish / Turkce): Kullanicinin Bilgisi Olmadan Gonderilen Veriler

> **Analiz edilen yazilim:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID kutuphanesi:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Surekli BLE/WiFi Yayini (En Invazif)

`libridtrans.so` (ASTM F3411 / OpenDroneID protokolu) araciligiyla drone, asagidaki verileri BLE ve WiFi uzerinden surekli olarak yayin yapar:

| Veri | API Fonksiyonu |
|------|----------------|
| **Seri numarasi** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Gercek zamanli GPS konumu** (enlem, boylam, yukseklik) | `RIDTRANS_SetLocation` |
| **Yatay/dikey hiz** | `RIDTRANS_SetLocation` |
| **Ucus yonu** | `RIDTRANS_SetLocation` |
| **Barometrik + jeodezik yukseklik** | `RIDTRANS_SetLocation` |
| **Yatay/dikey/hiz dogrulugu** | `RIDTRANS_SetLocation` |
| **Pilot konumu** (Operator Konumu) | `RIDTRANS_SetSystem` |
| **AB kategorisi + sinifi** | `RIDTRANS_SetSystem` |
| **Operator Kimlik Numarasi** | `RIDTRANS_SetOperatorID` |
| **Serbest metin** (Self ID) | `RIDTRANS_SetSelfID` |
| **Kimlik dogrulama verileri** | `RIDTRANS_SetAuth` |
| **Zaman damgasi** | `RIDTRNAS_SetTime` |

~1km menzil icindeki bir BLE/WiFi alicisina sahip **herkes** tum bu verileri gercek zamanli olarak okuyabilir. Bu **tasarim geregi** boyledir (AB/FAA yonetmelikleri), ancak kullanicilar yayinlanan verilerin kapsaminin tamamen farkinda olmayabilir.

## 2. Fotograf ve Videolarda EXIF/XMP Meta Verileri

Her fotograf ve video dosyasi gomulu meta veriler icerir (XMP ad alani `http://www.ipotensic.com/drone/1.0/`):

| Alan | Icerik |
|------|--------|
| `GPSLatitude` / `GPSLongitude` | Kesin konum |
| `GPSAltitude` | Yukseklik |
| `AbsoluteAltitude` / `RelativeAltitude` | Mutlak ve bagil yukseklikler |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Kamera yonelimi |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Drone yonelimi |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3 boyutlu hiz |
| `CameraSerialNumber` / `BodySerialNumber` | Seri numaralari |
| `Make` / `Model` | Donanim tanimlayicilari |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Kamera ayarlari |

Bu veriler **dosyalara gomulmustur** — bir fotograf veya video paylasirseniz, tum bu bilgiler de beraberinde gider.

## 3. MP4 Videolarda Ozel "Potensic MetaData" Parcasi

MP4 video kayitlari, `UserDefAtom` girisleriyle birlikte **ozel bir veri parcasi** (`Create private data track`) icerir — video dosyasinin icine kodlanmis eksiksiz bir telemetri akisi (her kare bazinda GPS, tutum, hiz vb.).

## 4. Telefon Uygulamasina Kalp Atisi — Surekli Veri Akisi

`camera_heartbeat`, bagli telefon uygulamasina surekli olarak su verileri gonderir:
- Calisma modu
- SD kart durumu
- Medya durumu
- WiFi Direct durumu
- Birlesik durum
- Aktif medya modu

## 5. Telefon Kimlik Dogrulamasi

Drone, bagli telefonu **tanimlar ve kimlik dogrulamasi yapar**:
- `is_cellphone_id_authenticated` — telefonun yetkili olup olmadigini kontrol eder
- `cellphone id authenticated: %s` — telefonun kimligini kaydeder
- Token `/data/config/token` icinde saklanir

## 6. Ucusa Yasak Bolgeler — Sessizce Uygulanan

NFZ sistemi (`deepsea_nfz`):
- Potensic sunucularindan kisitlama bolgelerini indirir (telefon uygulamasi araciligiyla)
- Bunlari `/data/no_fly_zone/` icinde saklar (daire + cokgen formatlari)
- Ucus Kontroloru bu bolgelerde **ucmayi reddeder**
- Kullanici root erisimi olmadan **bunlari kaldirmaz**

## Yapilmayan Seyler (Olumlu)

- Drone **dogrudan internete baglanmaz** — tum iletisim telefon uygulamasi uzerinden gerceklesir
- Drone'dan dogrudan bulut telemetrisi yok
- Otonom "eve telefon" davranisi yok

## Risk Ozeti

| Risk | Ciddiyet | Kullanici Kontrolu |
|------|----------|-------------------|
| RemoteID surekli konum/seri numarasi yayinliyor | **Yuksek** | Yok (root olmadan devre disi birakilamaz) |
| Paylasilan fotograflara gomulu GPS/seri numarasi | **Orta** | Paylasmadan once EXIF'i temizleyin |
| Videolarda telemetri parcasi | **Orta** | Kaldirmanin basit bir yolu yok |
| Sunucu tarafindan uygulanan NFZ | **Orta** | Root olmadan yok |
| Telefon kimlik dogrulamasi | **Dusuk** | Eslestirme icin normal |
