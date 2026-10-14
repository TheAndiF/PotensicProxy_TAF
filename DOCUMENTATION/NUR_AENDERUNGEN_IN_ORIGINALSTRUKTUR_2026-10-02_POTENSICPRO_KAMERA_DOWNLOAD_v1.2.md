# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - PotensicPro Kamera/Download - v1.2

Datum: 2026-10-02

Dieser Stand baut auf der vorherigen v1.1-Auslieferung auf. Gegen PotensicPro bestätigte Korrekturen betreffen normale Foto-/Videoaufnahme, Record-ACK, Galerie-Metadaten (`0x20`) sowie den Datei-Download (`0x1B`).

Geänderte bzw. neu hinzugefügte Dateien:

- `README.md`
- `PROTOCOL.md`
- `app/src/main/java/com/potensic/proxy/DroneProtocol.kt`
- `app/src/main/java/com/potensic/proxy/WebServer.kt`
- `app/src/main/java/com/potensic/proxy/protocol/PotensicProtocol.kt`
- `webui/src/components/cockpit/FlightActions.vue`
- `webui/src/components/gallery/GalleryView.vue`
- `webui/src/components/usb/PacketConstructor.vue`
- `webui/src/i18n/index.ts`
- `webui/src/protocol/PacketBuilder.ts`
- `webui/src/services/CameraMediaService.ts`
- `webui/src/services/DroneControlService.ts`
- `webui/src/stores/useCameraStore.ts`
- `DOCUMENTATION/2026-10-02 - PotensicProxy_TAF - Projektdokumentation - PotensicPro-Kamera-Download-Abgleich - v1.2.docx`
- `DOCUMENTATION/2026-10-02 - PotensicProxy_TAF - Projektdokumentation - PotensicPro-Kamera-Download-Abgleich - v1.2.pdf`

Wesentliche Protokollkorrekturen:

- Foto: `0x0020` Payload `01`.
- Video Start: `0x0020` Payload `00 01`.
- Video Stop: `0x0020` Payload `00 00`.
- Galerie-Metadaten: `0x20` mit JSON `filelist`, Antwort `file_info` mit `file`, `len`, `lrv_len`, `createtime`.
- Download: `0x1B` Requests bis 102400 Byte; RX-Offset `uint64 LE`, RX-Payloadlänge `uint16 LE`, finaler Block mit 32-Byte-Zusatzbereich.
- Download-Unit-Retry nach 1 s; Abbruch über `0x1E` nach Gesamt-Timeout.

Prüfstatus:

- `vue-tsc --noEmit`: bestanden.
- Vite-Produktionbuild: in der Ausführungsumgebung nicht möglich, da das gelieferte `node_modules` nur Windows-Rollup-Binaries enthält.
- Android-Gradle-Compile: in der Ausführungsumgebung nicht möglich, da Gradle 8.11.1 heruntergeladen werden müsste und kein Netzwerkzugriff besteht.
- Reale ATOM-Geräteabnahme: offen.
