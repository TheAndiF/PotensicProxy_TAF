# Potensic Atom 2 — Privacyaudit: Gegevens Verzonden Zonder Medeweten van de Gebruiker (Dutch / Nederlands)

> **Geanalyseerde firmware:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID-bibliotheek:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Continue BLE/WiFi-uitzending (Meest Invasief)

Via `libridtrans.so` (ASTM F3411 / OpenDroneID-protocol) zendt de drone continu de volgende gegevens uit via BLE en WiFi:

| Gegevens | API-functie |
|----------|-------------|
| **Serienummer** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Realtime GPS-positie** (lat, lon, hoogte) | `RIDTRANS_SetLocation` |
| **Horizontale/verticale snelheid** | `RIDTRANS_SetLocation` |
| **Vliegrichting** | `RIDTRANS_SetLocation` |
| **Barometrische + geodetische hoogte** | `RIDTRANS_SetLocation` |
| **Horizontale/verticale/snelheidsnauwkeurigheid** | `RIDTRANS_SetLocation` |
| **Pilootpositie** (Operator Location) | `RIDTRANS_SetSystem` |
| **EU-categorie + klasse** van de drone | `RIDTRANS_SetSystem` |
| **Operator-ID** | `RIDTRANS_SetOperatorID` |
| **Vrije tekst** (Self ID) | `RIDTRANS_SetSelfID` |
| **Authenticatiegegevens** | `RIDTRANS_SetAuth` |
| **Tijdstempel** | `RIDTRNAS_SetTime` |

**Iedereen** met een BLE/WiFi-ontvanger binnen een bereik van ~1km kan al deze gegevens in realtime uitlezen. Dit is **by design** (EU/FAA-regelgeving), maar gebruikers zijn zich mogelijk niet volledig bewust van de omvang van de uitgezonden gegevens.

## 2. EXIF/XMP-metadata in foto's en video's

Elke foto en elk videobestand bevat ingesloten metadata (XMP-namespace `http://www.ipotensic.com/drone/1.0/`):

| Veld | Inhoud |
|------|--------|
| `GPSLatitude` / `GPSLongitude` | Exacte positie |
| `GPSAltitude` | Hoogte |
| `AbsoluteAltitude` / `RelativeAltitude` | Absolute en relatieve hoogte |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Camera-orientatie |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Drone-orientatie |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3D-snelheid |
| `CameraSerialNumber` / `BodySerialNumber` | Serienummers |
| `Make` / `Model` | Hardware-identificatoren |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Camera-instellingen |

Deze gegevens zijn **ingesloten in de bestanden** — als u een foto of video deelt, gaat al deze informatie mee.

## 3. Privaat "Potensic MetaData"-spoor in MP4-video's

MP4-video-opnames bevatten een **privaat gegevensspoor** (`Create private data track`) met `UserDefAtom`-vermeldingen — een volledige telemetriestroom gecodeerd in het videobestand (GPS, stand, snelheid, enz. per frame).

## 4. Heartbeat naar telefoon-app — Continue gegevensstroom

De `camera_heartbeat` stuurt continu naar de verbonden telefoon-app:
- Bedieningsmodus
- SD-kaartstatus
- Mediastatus
- WiFi Direct-status
- Samengestelde status
- Actieve mediamodus

## 5. Telefoonauthenticatie

De drone **identificeert en authenticeert** de verbonden telefoon:
- `is_cellphone_id_authenticated` — controleert of de telefoon geautoriseerd is
- `cellphone id authenticated: %s` — logt het ID van de telefoon
- Token opgeslagen in `/data/config/token`

## 6. No-Fly Zones — Stilzwijgend Afgedwongen

Het NFZ-systeem (`deepsea_nfz`):
- Downloadt beperkingszones van Potensic-servers (via de telefoon-app)
- Slaat ze op in `/data/no_fly_zone/` (cirkel- + polygoonformaten)
- De Flight Controller **weigert te vliegen** in deze zones
- De gebruiker **kan ze niet verwijderen** zonder root-toegang

## Wat NIET wordt gedaan (Positief)

- De drone **maakt geen directe verbinding met het internet** — alle communicatie verloopt via de telefoon-app
- Geen directe cloudtelemetrie vanaf de drone
- Geen autonoom "phone home"-gedrag

## Risico-overzicht

| Risico | Ernst | Gebruikerscontrole |
|--------|-------|-------------------|
| RemoteID zendt continu positie/serienummer uit | **Hoog** | Geen (kan niet worden uitgeschakeld zonder root) |
| GPS/serienummer ingesloten in gedeelde foto's | **Gemiddeld** | EXIF verwijderen voor het delen |
| Telemetriespoor in video's | **Gemiddeld** | Geen eenvoudige manier om te verwijderen |
| NFZ afgedwongen door server | **Gemiddeld** | Geen zonder root |
| Telefoonauthenticatie | **Laag** | Normaal voor koppeling |
