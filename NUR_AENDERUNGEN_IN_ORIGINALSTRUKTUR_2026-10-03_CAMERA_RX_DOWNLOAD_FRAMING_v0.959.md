# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Kamera-RX-/Download-Framing - v0.959

Stand: 2026-10-03
Status: Development / Pre-1.0
Dokumentationsstand: v1.6

## Zweck

Dieser Stand behebt den im Live-System-Log reproduzierten Galerie-Downloadfehler, bei dem der erste 3072-Byte-Block korrekt übernommen wurde und anschließend Daten eines folgenden inneren Kamera-Frames in denselben 0x1B-Downloadbuffer gelangten. Daraus entstanden unplausible Offset-/Längenwerte, Timeouts und schließlich ein Abbruch bei Offset 3072 nach Passthrough-Reconnect.

## Geänderte Dateien

- `app/build.gradle.kts` - Softwareversion 0.959 / versionCode 32.
- `webui/package.json` - Frontendversion 0.959.
- `webui/package-lock.json` - Lockfile-Version 0.959.
- `webui/src/services/CameraMediaService.ts` - persistentes inneres FF-FE-Reassembly für FE 0x05, getrennte Verarbeitung mehrerer innerer Frames, Download-Framing-Härtung, Startup-Command-Deferral.
- `README.md` - Verhalten v0.959 dokumentiert.
- `PROTOCOL.md` - bestätigte innere Kamera-Framegrenze und 0x1B-Regeln ergänzt.
- `VERSIONING.md` - aktueller Entwicklungsstand 0.959 ergänzt.
- `DOCUMENTATION/2026-10-03 - PotensicProxy_TAF - Projektdokumentation - Kamera-RX-Download-Framing - v1.6.docx`
- `DOCUMENTATION/2026-10-03 - PotensicProxy_TAF - Projektdokumentation - Kamera-RX-Download-Framing - v1.6.pdf`
- `PATCH_CAMERA_RX_DOWNLOAD_FRAMING_2026-10-03_v0.959.patch`
- `COMMIT_MESSAGE_CAMERA_RX_DOWNLOAD_FRAMING_2026-10-03_v0.959.txt`

## Validierung

- `vue-tsc --noEmit`: bestanden.
- Synthetischer Reassembly-Test mit zwei realen 0x39-Innenframes: bestanden; kombinierte und gesplittete Anlieferung ergibt exakt zwei ursprüngliche Frames.
- Vite-Produktionbuild in dieser Linux-Umgebung blockiert: optionales Rollup-Paket `@rollup/rollup-linux-x64-gnu` fehlt im gelieferten `node_modules`.
- Reale Gerätetests für Download, Reconnect und Foto/Video-State bleiben offen.
