# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Kamera Capture State - v1.3

Datum: 2026-10-02

Geänderte Dateien:

- `webui/src/protocol/PacketBuilder.ts`
- `webui/src/stores/useCameraStore.ts`
- `webui/src/services/CameraMediaService.ts`
- `webui/src/services/DroneControlService.ts`
- `webui/src/components/cockpit/FlightActions.vue`
- `app/src/main/java/com/potensic/proxy/DroneProtocol.kt`
- `README.md`
- `PROTOCOL.md`

Neue Dokumentationsdateien:

- `DOCUMENTATION/2026-10-02 - PotensicProxy_TAF - Projektdokumentation - Kamera-Capture-State-Machine - v1.3.pdf`
- `DOCUMENTATION/2026-10-02 - PotensicProxy_TAF - Projektdokumentation - Kamera-Capture-State-Machine - v1.3.docx`

Schwerpunkt der Änderung: PotensicPro-konforme CaptureMode-Synchronisation für Foto und Video mit Statusabfrage `02`, Moduswechsel `03 01`/`03 00`, ACK-gesteuertem Foto/Record Start/Stop, Timeout und einmaligem Retry bei `Current mode not allowed`.
