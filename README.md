# PotensicProxy_TAF

Unoffizieller Android-Proxy für die Potensic ATOM / ATOM 2: USB-/AOA-Anbindung der Fernsteuerung, Livevideo, Telemetrie, Weboberfläche und Steuerfunktionen.

**Dokumentationsstand:** Quellcode des bereitgestellten Entwicklungsstands (Commit `80a4229`, 15.10.2026) statisch ausgewertet. Die zentrale Versionskonfiguration `config/versions.json` und `webui/package.json` nennen **0.9846.6** (`defaultVersionCode` 68). Die vorhandene Implementierung ist **kein Beleg für erfolgreiche Geräte- oder Flugtests**.

> **Aktiver Entwicklungsstand:** `usb-liveview-import` (geplanter neuer Name: `main`). Die Branch-Umbenennung auf GitHub ist noch **nicht** durchgeführt. `master` und `liert-reviewed` sind historische Referenzstände; sie werden nicht aktiv fortentwickelt.

## Verwandtes Hardwareprojekt: USB-C-Ersatzkabel

**[Potensic ATOM USB-C Replacement Cable](https://github.com/TheAndiF/Potensic-ATOM-USB-C-Replacement-Cable)** dokumentiert die rekonstruierte, gerichtete USB-C-Sonderbeschaltung zwischen einer Potensic-ATOM-Fernsteuerung **DSRC02A** und einem Android-Smartphone. Das eigenständige Projekt enthält KiCad-Schaltpläne, Messungen, Bauhinweise und einen getesteten Prototyp.

- Der dokumentierte Kabelprototyp wurde mit **ATOM / DSRC02A / Android** getestet. Eine Kompatibilität mit ATOM 2 oder anderen Controllern ist damit **nicht** belegt.
- Die Richtungskennzeichnung (Controller/Telefon) und elektrische Prüfung sind zwingend zu beachten; das Kabel ist kein allgemeines Lade- oder USB-C-Kabel.
- Das Kabel ersetzt lediglich die physische Verbindung zwischen Fernsteuerung und Smartphone. Es vergrößert **nicht unmittelbar** die Funkreichweite zwischen Fernsteuerung und Drohne.

Die Hardwareanleitung und die tatsächliche Verdrahtung sind ausschließlich im Kabel-Repository maßgeblich.

## Funktionen im aktiven Entwicklungsbranch

Die folgende Liste ist durch Komponenten, Backend-Klassen und Routen im **Quellcode** belegt. Ohne gesonderten Testnachweis wird keine erfolgreiche Ausführung auf echter Drohnenhardware behauptet.

| Bereich | Im Code enthalten | Wichtige Einschränkung |
| --- | --- | --- |
| Cockpit | Livebild, Telemetrie, virtuelle Joysticks, Gimbal, Start/Landung, RTH, Foto/Video und Flug-/Landeassistenz | Flug- und Sicherheitsverhalten vor realem Einsatz prüfen |
| Video | Paketextraktion, Android-MediaCodec-Decoder, H.264/H.265, H.265-/MJPEG-HTTP-Ausgabe, Snapshot und WebSocket | Decoder-/Transportkompatibilität geräteabhängig |
| Missionen | Wegpunkte, Kreis-/Polygon-/Raster-/Spiralmuster, Validierung, lokale Speicherung und `map.db`-Export | **Kein Nachweis einer autonomen Missionsausführung** durch die Missionsoberfläche |
| Karten | Kartenquellen, Tile-Proxy, temporärer Cache und Offline-Regionen | Kartenanbieter und Netzverfügbarkeit beachten |
| Medien | Galerie, lokale Medien, Snapshot, Kamera-Medienoberfläche | Einzelne Kameraaktionen hängen vom Controller-/Drohnenprofil ab |
| USB | AOA-Transport, Paketmonitor, Capture, HEX-Paketkonstruktion und Rohversand | Rohbefehle können Hardwareverhalten beeinflussen |
| System | RF-Probe/Status, Remote-ID-Abfrage, Kamera-Diagnose, Log-/Relay-Oberfläche | RF-Unlock/-Reset ist nicht als sichere Reichweitensteigerung belegt |
| PStart / PLand | Einstellungsoberflächen, Bild- und Session-Verwaltung, OpenCV-Analyse sowie Steuerungslogik | Präzision und Failsafes sind separat auf Geräten zu validieren |
| Updates | GitHub-Release-Prüfung, Download, Hash-/Signaturprüfung, Installation mit Bedingungen | Signaturidentität und installierte Version beachten |
| Zusätzliche Videoausgabe | Video-/Overlay-Server auf Port 9091 | **Virtuelle Android-Webcam nur vorbereitet**, noch kein fertiger Adapter |

### Konfigurierte Drohnenprofile

`app/src/main/res/xml/drone_protocol_profiles.xml` definiert:

| Profil | Vorgabe |
| --- | --- |
| `ATOM` (Standard) | H.264, 1280 × 720, Transport `atom_h264_fe06` |
| `ATOM_2` | Transport `w42`, automatische Codec-Erkennung, 1920 × 1080, H.265 bevorzugt |

Dies sind **Softwareprofile**, keine umfassende Kompatibilitätszertifizierung für alle Controller- und Firmwarevarianten.

### Architektur und Schnittstellen

Die Fernsteuerung kommuniziert über USB-C/AOA mit `UsbAccessoryManager` und `ProxyService`. `DroneProtocol`, Videoextraktion, Decoder und Webserver verarbeiten Daten und Steuerbefehle für die Vue-/TypeScript-Oberfläche. Zusätzlich sind BLE-/WLAN-Pairing und ein WLAN-Transportpfad im Code vorhanden.

- **Port 9090:** Hauptserver (`WebServer.kt`, Bindung an `0.0.0.0`) mit unter anderem `/api/status`, `/api/video/h265`, `/api/video/mjpeg`, `/api/video/snapshot`, `/api/video/stats`, `/api/missions`, `/api/map/...`, `/api/updates/status`, `/ws/usb`, `/ws/video` und `/ws/control`.
- **Port 9091:** bei Aktivierung separater Videoausgabe-Server (`StreamOutputServer.kt`, ebenfalls an `0.0.0.0` gebunden).

**Sicherheit:** Die Netzwerkserver sind nicht auf `localhost` begrenzt. Die API-Authentifizierung wurde nicht als wirksam verifiziert. Steuerungs-Endpunkte deshalb nur in einem kontrollierten, vertrauenswürdigen Netz bereitstellen und vor externem Zugriff absichern.

### Weboberfläche

Die Hauptnavigation (`webui/src/App.vue`, `HeaderBar.vue`) umfasst **Cockpit, Mission, Karte, Galerie, USB und System**. In „System“ gibt es unter anderem Video-/RF-, Remote-ID-, Sprach-/Anzeige- und Remote-/Relay-Funktionen.

## Projektaufbau

| Pfad | Zweck |
| --- | --- |
| `app/` | Android-Anwendung (Kotlin), USB-Anbindung, Webserver und Update-Funktionen |
| `webui/` | Weboberfläche und TypeScript/Vue-Logik |
| `config/versions.json` | Zentrale Versionskonfiguration |
| `.github/workflows/` | Build-, Release- und Update-Workflows |
| `docs/`, `DOCUMENTATION/` | Technische Dokumentation und historische Änderungsnachweise |
| `PRIVACY/` | Datenschutz-/Firmware-Analysen |
| `scripts/` | Versionsabgleich und weitere Projektwerkzeuge |
| `release-docs/` | Historische Release-Unterlagen |

Die Anwendung ist experimentell und nicht von Potensic unterstützt. Flugsteuerung und Verbindungswiederherstellung müssen vor realen Flügen geprüft werden. Geltende Flug- und Funkvorschriften beachten.

## Branches und Migration

Die angestrebte, kürzere Namensstruktur lautet:

| Aktuell | Geplant | Rolle |
| --- | --- | --- |
| `usb-liveview-import` | `main` | einzige aktiv fortentwickelte Version |
| `master` | `legacy-original` | historischer Ursprungsstand |
| `liert-reviewed` | `archive-liert-review` | historischer Review-Stand |

**Wichtig:** Derzeit sind die Namen in der Spalte *Aktuell* gültig. Die Reihenfolge für die sichere GitHub-Umstellung sowie die Prüfung der CI-/Update-Pfade stehen in [docs/BRANCH_MIGRATION.md](docs/BRANCH_MIGRATION.md). Keine historischen Branches zusammenführen oder löschen.

## Builds und Releases

Der Dispatcher in `.github/workflows/build-dispatch.yml` verwendet Commit-Präfixe `BA_`, `BS_` und `BL_` und startet die zugehörigen Workflows auf dem Quellbranch. Details zur Versionsführung: [VERSIONSVERWALTUNG.md](VERSIONSVERWALTUNG.md).

| Commit-Präfix | Workflow | Zweck laut Konfiguration |
| --- | --- | --- |
| `BA_` | `ba-update.yml` | Update-/Release-Strecke |
| `BS_` | `bs-build.yml` | Build mit Cache-Strategie |
| `BL_` | `build-apk.yml` | Vollständiger nicht gecachter APK-Build |

### Entwicklungsumgebung und statische Prüfschritte

Die zentrale Konfiguration nennt Node.js **24.11.1**, Java **17**, Gradle **8.11.1**, Android Gradle Plugin **8.7.3**, Kotlin **2.1.20**, `minSdk` **26** und `targetSdk` **36**. Die Weboberfläche verwendet Vue 3, TypeScript und Vite (aufgelöste Version **6.4.3**).

```bash
python3 scripts/sync_versions.py --check
cd webui
npm ci --include=optional --no-audit --no-fund
npm run verify:source
npm run build
```

Diese Befehle dokumentieren den Quell-/WebUI-Buildpfad. Der Android-Build verwendet Gradle und kann Signatur-Secrets benötigen; die CI-Workflows sind für die jeweiligen Buildvarianten maßgeblich. **Während dieser README-Prüfung wurden kein vollständiger Android-Build und keine Hardwaretests durchgeführt.** Signaturschlüssel und Passwörter nicht veröffentlichen.

### Herkunft

Das Projekt ist ein Fork von [sk7n4k3d/potensic-proxy](https://github.com/sk7n4k3d/potensic-proxy). Weitere Herkunfts- und Integrationshinweise: [DOCUMENTATION/UPSTREAMS.md](DOCUMENTATION/UPSTREAMS.md). Bestehende Lizenz- und Urheberhinweise der Projektbestandteile beachten.

Bestehende Build-, Signatur-, Update- und Datenbestandslogik darf durch die Branch-Umbenennung nicht verändert werden. Vor der Veröffentlichung einer APK die Workflows, Signaturen und Gerätefunktion testen.
