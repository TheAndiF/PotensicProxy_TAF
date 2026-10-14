# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Kamera-Log-0x39-Dekodierung - v1.5

Stand: 2026-10-02

Dieses Paket enthält ausschließlich die für v1.5 geänderten bzw. neu erzeugten Dateien in ihrer ursprünglichen Projektstruktur. Der Root-Ordner bleibt `PotensicProxy_TAF`.

## Technische Änderungen

- `webui/src/services/CameraMediaService.ts`
  - PotensicPro-konformes 0x39-Layout: Source + uint16-LE Payload-Länge + exakte Payload.
  - Linux Source 0: XOR 0x55 und einzeilige, kontrolliert escapte Textdarstellung.
  - Gimbal Source 2: Binärdaten als begrenzte Hex-Vorschau statt UTF-8-Fehldekodierung.
  - LiteOS Source 1: Raw-Hex bis ein realer Source-1-Capture die Kodierung bestätigt.
  - Längen-/Truncation-/Trailing-Byte-Prüfungen.
- `PROTOCOL.md`
  - Neuer Abschnitt zur bestätigten 0x39-Struktur und Dekoderregel.
- `README.md`
  - v1.5-Kurzbeschreibung der Kamera-Log-Dekodierung.
- `DOCUMENTATION/...v1.5.docx/.pdf`
  - Projektdokumentation mit Quellbelegen, USB-Capture-Abgleich, Umsetzung und Validierung.

## Validierung

- `vue-tsc --noEmit`: PASS.
- USB-Capture: 37 x 0x39, davon 32 Linux und 5 Gimbal; alle deklarierten Payload-Längen passen.
- Linux XOR 0x55: ergibt lesbare Kamera-Diagnosetexte.
- Vite-Produktionsbuild: in dieser Umgebung weiterhin durch fehlendes optionales Linux-Rollup-Binary blockiert.
- Reale Geräteprüfung: offen.
