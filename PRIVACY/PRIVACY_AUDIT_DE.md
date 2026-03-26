# Potensic Atom 2 — Datenschutz-Audit: Ohne Wissen des Nutzers gesendete Daten (German / Deutsch)

> **Analysierte Firmware:** cam_atom2_v8.12.11 (2025-09-19) — `main_app` (10MB, aarch64 ELF)
> **RemoteID-Bibliothek:** `libridtrans.so` (ASTM F3411 / OpenDroneID)
> **SoC:** HiSilicon Hi3519DV500

---

## 1. RemoteID — Kontinuierliche BLE/WiFi-Ausstrahlung (am invasivsten)

Uber `libridtrans.so` (ASTM F3411 / OpenDroneID-Protokoll) sendet die Drohne kontinuierlich folgende Daten per BLE und WiFi:

| Daten | API-Funktion |
|-------|-------------|
| **Seriennummer** (UASID = `[MFR CODE][SERIAL]`) | `RIDTRANS_SetBasicID` |
| **Echtzeit-GPS-Position** (Breitengrad, Laengengrad, Hoehe) | `RIDTRANS_SetLocation` |
| **Horizontal-/Vertikalgeschwindigkeit** | `RIDTRANS_SetLocation` |
| **Flugrichtung** | `RIDTRANS_SetLocation` |
| **Barometrische + geodaetische Hoehe** | `RIDTRANS_SetLocation` |
| **Horizontal-/Vertikal-/Geschwindigkeitsgenauigkeit** | `RIDTRANS_SetLocation` |
| **Pilotenposition** (Operator Location) | `RIDTRANS_SetSystem` |
| **EU-Kategorie + Klasse** der Drohne | `RIDTRANS_SetSystem` |
| **Betreiber-ID** | `RIDTRANS_SetOperatorID` |
| **Freitext** (Self ID) | `RIDTRANS_SetSelfID` |
| **Authentifizierungsdaten** | `RIDTRANS_SetAuth` |
| **Zeitstempel** | `RIDTRNAS_SetTime` |

**Jeder** mit einem BLE/WiFi-Empfaenger in ca. 1 km Reichweite kann all diese Daten in Echtzeit auslesen. Dies ist **beabsichtigt** (EU/FAA-Vorschriften), aber den Nutzern ist das Ausmass der ausgestrahlten Daten moeglicherweise nicht vollstaendig bewusst.

## 2. EXIF/XMP-Metadaten in Fotos und Videos

Jede Foto- und Videodatei enthaelt eingebettete Metadaten (XMP-Namespace `http://www.ipotensic.com/drone/1.0/`):

| Feld | Inhalt |
|------|--------|
| `GPSLatitude` / `GPSLongitude` | Exakte Position |
| `GPSAltitude` | Hoehe |
| `AbsoluteAltitude` / `RelativeAltitude` | Absolute und relative Hoehe |
| `GimbalPitchDegree` / `GimbalRollDegree` / `GimbalYawDegree` | Kameraausrichtung |
| `FlightPitchDegree` / `FlightRollDegree` / `FlightYawDegree` | Drohnenausrichtung |
| `FlightXSpeed` / `FlightYSpeed` / `FlightZSpeed` | 3D-Geschwindigkeit |
| `CameraSerialNumber` / `BodySerialNumber` | Seriennummern |
| `Make` / `Model` | Hardware-Kennungen |
| `ISOSpeed` / `ShutterSpeedValue` / `FNumber` | Kameraeinstellungen |

Diese Daten sind **in die Dateien eingebettet** — wenn Sie ein Foto oder Video teilen, werden all diese Informationen mitgesendet.

## 3. Privater "Potensic MetaData"-Track in MP4-Videos

MP4-Videoaufnahmen enthalten einen **privaten Datentrack** (`Create private data track`) mit `UserDefAtom`-Eintraegen — ein vollstaendiger Telemetrie-Stream, der in der Videodatei kodiert ist (GPS, Lage, Geschwindigkeit usw. auf Frame-Ebene).

## 4. Heartbeat zur Telefon-App — Kontinuierlicher Datenstrom

Der `camera_heartbeat` sendet kontinuierlich an die verbundene Telefon-App:
- Betriebsmodus
- SD-Kartenstatus
- Medienstatus
- WiFi-Direct-Status
- Zusammengesetzter Status
- Aktiver Medienmodus

## 5. Telefon-Authentifizierung

Die Drohne **identifiziert und authentifiziert** das verbundene Telefon:
- `is_cellphone_id_authenticated` — prueft, ob das Telefon autorisiert ist
- `cellphone id authenticated: %s` — protokolliert die ID des Telefons
- Token gespeichert in `/data/config/token`

## 6. Flugverbotszonen — Still durchgesetzt

Das NFZ-System (`deepsea_nfz`):
- Laedt Beschraenkungszonen von Potensic-Servern herunter (ueber die Telefon-App)
- Speichert sie in `/data/no_fly_zone/` (Kreis- + Polygonformate)
- Der Flight Controller **verweigert den Flug** in diesen Zonen
- Der Nutzer **kann sie nicht entfernen** ohne Root-Zugriff

## Was NICHT getan wird (Positiv)

- Die Drohne **verbindet sich nicht direkt mit dem Internet** — jede Kommunikation laeuft ueber die Telefon-App
- Keine direkte Cloud-Telemetrie von der Drohne
- Kein autonomes "Phone-Home"-Verhalten

## Risikozusammenfassung

| Risiko | Schweregrad | Nutzerkontrolle |
|--------|-------------|-----------------|
| RemoteID sendet Position/Seriennummer kontinuierlich | **Hoch** | Keine (kann ohne Root nicht deaktiviert werden) |
| GPS/Seriennummer in geteilten Fotos eingebettet | **Mittel** | EXIF vor dem Teilen entfernen |
| Telemetrie-Track in Videos | **Mittel** | Keine einfache Moeglichkeit zur Entfernung |
| NFZ vom Server durchgesetzt | **Mittel** | Keine ohne Root |
| Telefon-Authentifizierung | **Niedrig** | Normal fuer Kopplung |
