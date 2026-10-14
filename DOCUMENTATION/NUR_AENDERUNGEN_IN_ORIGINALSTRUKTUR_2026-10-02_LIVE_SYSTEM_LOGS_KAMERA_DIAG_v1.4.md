# Nur Änderungen in Originalstruktur - Live-System-Logs / Kamera-Diagnose v1.4

Projekt: PotensicProxy_TAF  
Datum: 2026-10-02  
Status: Software umgesetzt; reale Geräteabnahme K1-K8 offen

Enthalten sind ausschließlich die in diesem Änderungsstand geänderten bzw. neu erzeugten Dateien, jeweils unter ihrem ursprünglichen Projektpfad. Der Root-Ordner bleibt `PotensicProxy_TAF`.

## Geänderte Quelldateien

- `webui/src/components/logs/LogConsole.vue`
- `webui/src/stores/useDroneStore.ts`
- `webui/src/services/CameraMediaService.ts`
- `webui/src/services/UsbTransportService.ts`
- `README.md`
- `PROTOCOL.md`

## Neue Auslieferungsdateien

- `DOCUMENTATION/2026-10-02 - PotensicProxy_TAF - Projektdokumentation - Live-System-Logs-Kamera-Diagnose - v1.4.docx`
- `DOCUMENTATION/2026-10-02 - PotensicProxy_TAF - Projektdokumentation - Live-System-Logs-Kamera-Diagnose - v1.4.pdf`
- `PATCH_LIVE_SYSTEM_LOGS_CAMERA_DIAG_2026-10-02_v1.4.patch`
- `COMMIT_MESSAGE_LIVE_SYSTEM_LOGS_CAMERA_DIAG_2026-10-02_v1.4.txt`
- `NUR_AENDERUNGEN_IN_ORIGINALSTRUKTUR_2026-10-02_LIVE_SYSTEM_LOGS_KAMERA_DIAG_v1.4.md`

## Prüfstand

- TypeScript/Vue Typprüfung: bestanden (`vue-tsc --noEmit`).
- Vite-Build: in dieser Linux-Umgebung nicht ausführbar, weil das gelieferte `node_modules` nur Windows-Rollup-Binaries enthält.
- Android/Gradle: nicht ausführbar, weil der Wrapper Gradle 8.11.1 aus dem Netz laden müsste.
- Reale Geräteabnahme: offen.
