# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Kamera-Initialisierung und Fotoablauf - v0.961

## Ziel

TAF wird beim Kamera-Start und beim Fotoablauf näher an den aus `PotensicPro.zip` abgeleiteten Originalpfad angeglichen. Der Fokus liegt auf der vollständigen `0x11`-Kamera-Initialisierung vor Capture, den originalen Folgeabfragen und der Synchronisation nach dem Wechsel in den PHOTO-Modus.

## Geänderte Dateien

- `webui/src/services/CameraMediaService.ts`
  - automatische `0x11`-Config-Menu-Anforderung alle 1000 ms bis Erfolg
  - vollständigeres Parsen von Kamera-/SD-/Auflösungs-/EV-/Zoom-Konfiguration
  - originale Post-Init-Abfragen `0x07`, `0x34`, `0x3F`, `0x40`
  - verzögerte Zoomabfrage bis nach erfolgreicher Kamera-Initialisierung
  - `0x3A` als PotensicPro-Pre-Notify statt als Shutter-Readiness-Gate
  - PHOTO-Post-Mode-Sync mit `0x17`, `0x0E 01`, `0x35` bzw. `0x10 01`
  - kein automatischer Foto-Retry bei `Device busy` oder Status 8
  - SD-Status direkt nach erfolgreichem `0x01`-ACK
  - 10-s-Fallback setzt nur den lokalen Foto-Laufzustand zurück
  - mode-/auflösungsabhängige Zoomgrenze
- `webui/src/protocol/PacketBuilder.ts`
  - Builder für `0x07` Set Camera Time
  - Builder für `0x0E 00/01` Record/Photo EV
  - Builder für `0x40` Get Photo Mode
- `webui/src/stores/useCameraStore.ts`
  - Initialisierungsstatus, Kamera-Identität, Photo-Child-Mode und Config-Status ergänzt
- `webui/src/components/cockpit/FlightActions.vue`
  - Foto-/Video-Aktionen bis erfolgreicher `0x11`-Initialisierung deaktiviert
- `README.md`
  - v0.961-Verhalten dokumentiert
- `PROTOCOL.md`
  - Initialisierungs- und Fotoablauf v0.961 dokumentiert
- `VERSIONING.md`
  - Softwarestand 0.961 / versionCode 34
- `app/build.gradle.kts`
  - `versionName = 0.961`, `versionCode = 34`
- `webui/package.json`
  - Frontendversion 0.961
- `webui/package-lock.json`
  - Lockfile-Version 0.961
- `DOCUMENTATION/2026-10-03 - PotensicProxy_TAF - Projektdokumentation - Kamera-Initialisierung-und-Fotoablauf - v0.2.docx`
- `DOCUMENTATION/2026-10-03 - PotensicProxy_TAF - Projektdokumentation - Kamera-Initialisierung-und-Fotoablauf - v0.2.pdf`

## Validierung

- PASS: `node node_modules/vue-tsc/bin/vue-tsc --noEmit`
- PASS: DOCX visuell gerendert und geprüft
- PASS: PDF aus demselben DOCX erzeugt, gerendert und geprüft
- BLOCKIERT DURCH BUILD-UMGEBUNG: Vite-Produktionbuild, weil `@rollup/rollup-linux-x64-gnu` im gelieferten `node_modules` fehlt
- OFFEN: realer Gerätetest auf ATOM

## Erwarteter Gerätetest

1. App starten und Live-Log speichern.
2. Prüfen, dass nach Passthrough OPEN zuerst `0x11`-Initialisierung läuft.
3. Prüfen, dass nach Config-Erfolg `0x07`, `0x34`, `0x3F`, `0x40` folgen.
4. Erster Foto-Button aus VIDEO: nur `03 01`, anschließend `0x17`, `0x0E 01` und `0x10 01` oder `0x35`.
5. Zweiter Foto-Button: genau ein `0x01`.
6. Bei `Device busy`: kein zweites `0x01`, kein automatisches `03 00`.
7. Prüfen, ob die Kamera nun `Work Mode State is Progress` wieder verlässt und Kamera-`0x2A` liefert.
