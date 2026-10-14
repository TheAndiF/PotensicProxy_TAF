# Nur Änderungen in Originalstruktur - Live Reco / Drone Reco

Datum: 2026-10-01
Basis: PotensicProxy_TAF 0.955 Image Recognition Prerequisites
Ziel: PotensicProxy_TAF 0.956

## Geändert

- `README.md` - zwei getrennte Bildbibliotheken und Live-/Drone-Reco-Ablauf dokumentiert.
- `app/build.gradle.kts` - `versionCode 29`, `versionName 0.956`.
- `app/src/main/java/com/potensic/proxy/AndroidMediaRepository.kt`
  - `Pictures/PotensicProxy/Camera/` und `Pictures/PotensicProxy/Recognition/`;
  - Library-Kennzeichnung im Index;
  - SHA-256 und Rücklese-Verifikation;
  - Bildabmessungen/Format/Größe;
  - optionaler umfangreicher Recognition-Metadatensatz.
- `app/src/main/java/com/potensic/proxy/WebServer.kt`
  - Library-Filter für lokale Bilder;
  - Live-Reco-Metadatenannahme;
  - Import mit `library` und `metadata`.
- `webui/package.json`, `webui/package-lock.json` - Version 0.956.
- `webui/src/services/AndroidMediaService.ts` - getrennte Libraries, Recognition-Typen, Verifikations-/Hashfelder.
- `webui/src/services/CameraMediaService.ts`
  - Downloads liefern jetzt einen Abschluss-Promise;
  - normales Foto -> Camera-Library;
  - Recognition-Foto -> Recognition-Library;
  - optionales Löschen ausschließlich nach `verified=true`;
  - Löschbestätigung mit Timeout.
- `webui/src/services/RecognitionMetadataService.ts` - neu; erfasst maximal verfügbare Zustandsdaten zum Aufnahmezeitpunkt.
- `webui/src/services/RecognitionCaptureService.ts` - neu; orchestriert Live Reco und Drone Reco.
- `webui/src/services/DroneControlService.ts` - Cockpit-Live-Snapshot nutzt Recognition-Metadaten.
- `webui/src/components/gallery/GalleryView.vue`
  - Tabs `Camera` / `Recognition`;
  - Recognition-Filter `All` / `Live` / `Drone`;
  - Buttons für Live Reco und Drone Reco;
  - Quellen-/Verified-Badges;
  - aufklappbare vollständige Metadaten.
- `webui/src/i18n/index.ts` - FPV-Snapshot als Live-Reco-Aufnahme bezeichnet.

## Neu

- `IMAGE_RECOGNITION_LIVE_DRONE_RECO_2026-10-01.md`
- `COMMIT_MESSAGE_LIVE_DRONE_RECO_2026-10-01.txt`
- `PATCH_LIVE_DRONE_RECO_v0.956.patch`

## Nicht verändert

- bestätigte Potensic-Protokollwerte und bestehende Kamera-Befehlsstruktur;
- normale Fotoaufnahme bleibt normale Kameraaufnahme;
- nicht bestätigte Protokollbereiche werden nicht umgedeutet.

## Noch nicht Bestandteil dieses Stands

- eigentliches ML-/Objekterkennungsmodell;
- Hybrid-Reco-Entscheidungslogik;
- hardwareseitige Bestätigung des vollständigen Drone-Reco-Auto-Delete-Zyklus;
- zusätzliche EXIF-/XMP-Einbettung in die Bilddatei selbst. Der vollständige Recognition-Datensatz liegt aktuell im app-eigenen Index und ist über die Gallery sichtbar.
