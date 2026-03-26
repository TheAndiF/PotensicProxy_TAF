# Potensic Atom 2 — Integritetsrevision: Data som skickas utan användarens vetskap (Swedish / Svenska)

> **Analyserad firmware:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID-bibliotek:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Kontinuerlig BLE/WiFi-sändning (mest integritetskränkande)

Via `libridtrans.so` (ASTM F3411 / OpenDroneID-protokoll) sänder drönaren kontinuerligt följande data via BLE och WiFi:

| Data | API-funktion |
|------|-------------|
| **Serienummer** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **GPS-position i realtid** (lat, lon, alt) | `RIDTRANS_SetLocation` |
| **Horisontell/vertikal hastighet** | `RIDTRANS_SetLocation` |
| **Flygriktning** | `RIDTRANS_SetLocation` |
| **Barometrisk + geodetisk höjd** | `RIDTRANS_SetLocation` |
| **Horisontell/vertikal/hastighetsnoggrannhet** | `RIDTRANS_SetLocation` |
| **Pilotposition** (Operator Location) | `RIDTRANS_SetSystem` |
| **EU-kategori + klass** för drönaren | `RIDTRANS_SetSystem` |
| **Operatörs-ID** | `RIDTRANS_SetOperatorID` |
| **Fritext** (Self ID) | `RIDTRANS_SetSelfID` |
| **Autentiseringsdata** | `RIDTRANS_SetAuth` |
| **Tidsstämpel** | `RIDTRNAS_SetTime` |

**Vem som helst** med en BLE/WiFi-mottagare inom ~1 km räckvidd kan läsa all denna data i realtid. Detta är **avsiktligt** (EU/FAA-regler), men användare kanske inte är fullt medvetna om omfattningen av den data som sänds.

## 2. EXIF/XMP-metadata i foton och videor

Varje foto- och videofil innehåller inbäddad metadata (XMP-namnrymd `http://www.ipotensic.com/drone/1.0/`):

| Fält | Innehåll |
|------|----------|
| `GPSLatitude` / `GPSLongitude` | Exakt position |
| `GPSAltitude` | Höjd |
| `AbsoluteAltitude` / `RelativeAltitude` | Absolut och relativ höjd |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Kameraorientering |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Drönarorientering |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3D-hastighet |
| `CameraSerialNumber` / `BodySerialNumber` | Serienummer |
| `Make` / `Model` | Hårdvaruidentifierare |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Kamerainställningar |

Denna data är **inbäddad i filerna** — om du delar ett foto eller en video, följer all denna information med.

## 3. Privat "Potensic MetaData"-spår i MP4-videor

MP4-videoinspelningar innehåller ett **privat dataspår** (`Create private data track`) med `UserDefAtom`-poster — en komplett telemetriström kodad i videofilen (GPS, attityd, hastighet, etc. per bildruta).

## 4. Heartbeat till telefonappen — Kontinuerligt dataflöde

`camera_heartbeat` skickar kontinuerligt till den anslutna telefonappen:
- Driftläge
- SD-kortstatus
- Mediastatus
- WiFi Direct-status
- Sammansatt status
- Aktivt medialäge

## 5. Telefonautentisering

Drönaren **identifierar och autentiserar** den anslutna telefonen:
- `is_cellphone_id_authenticated` — kontrollerar om telefonen är auktoriserad
- `cellphone id authenticated: %s` — loggar telefonens ID
- Token lagrad i `/data/config/token`

## 6. Flygförbudszoner — Tyst tillämpning

NFZ-systemet (`deepsea_nfz`):
- Laddar ner restriktionszoner från Potensics servrar (via telefonappen)
- Lagrar dem i `/data/no_fly_zone/` (cirkel- och polygonformat)
- Flygkontrollern **vägrar flyga** i dessa zoner
- Användaren **kan inte ta bort dem** utan root-åtkomst

## Vad som INTE görs (positivt)

- Drönaren **ansluter inte direkt till internet** — all kommunikation går via telefonappen
- Ingen direkt molntelemetri från drönaren
- Inget autonomt "phone home"-beteende

## Risksammanfattning

| Risk | Allvarlighetsgrad | Användarkontroll |
|------|--------------------|-----------------|
| RemoteID sänder position/serienummer kontinuerligt | **Hög** | Ingen (kan inte inaktiveras utan root) |
| GPS/serienummer inbäddat i delade foton | **Medel** | Ta bort EXIF innan delning |
| Telemetrispår i videor | **Medel** | Inget enkelt sätt att ta bort |
| Flygförbudszoner påtvingade av server | **Medel** | Ingen utan root |
| Telefonautentisering | **Låg** | Normalt för parkoppling |
