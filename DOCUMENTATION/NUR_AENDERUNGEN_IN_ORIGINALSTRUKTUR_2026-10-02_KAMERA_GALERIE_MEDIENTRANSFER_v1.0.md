# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Kamera, Galerie und Medientransfer - v1.0

Datum: 2026-10-02  
Status: umgesetzt mit dokumentierten Restpunkten für geräteabhängige Thumbnail-/Record-State-Validierung

## Geänderte Dateien

- `README.md`
- `PROTOCOL.md`
- `app/src/main/java/com/potensic/proxy/AndroidMediaRepository.kt`
- `app/src/main/java/com/potensic/proxy/DroneProtocol.kt`
- `app/src/main/java/com/potensic/proxy/WebServer.kt`
- `webui/src/components/gallery/GalleryView.vue`
- `webui/src/protocol/DroneProtocol.ts`
- `webui/src/protocol/PacketBuilder.ts`
- `webui/src/services/CameraMediaService.ts`
- `webui/src/services/DroneControlService.ts`
- `webui/src/stores/useCameraStore.ts`

## Umgesetzt

- Kamera-RX auf `FE 0x05 + FF FE + Function 0x0020` korrigiert; TX bleibt `FF FD`.
- Foto auf normalen PotensicPro-Kamerapfad `0x0020 / cmd 0x01` umgestellt.
- Record-Kommando auf normalen PotensicPro-Kamerapfad `0x0020 / cmd 0x00` umgestellt.
- Galerie-Zustandsmaschine `CLOSED`, `OPENING`, `OPEN`, `LOADING_COUNT`, `LOADING_LIST`, `READY`, `ERROR` ergänzt.
- Begrenzte Timeouts/Retries für `0x21`, `0x18`, `0x19` ergänzt; kein endloses „Reading media list…“ mehr.
- `0x18` Count-Auswertung little-endian beibehalten und leere Galerie sauber abgeschlossen.
- `0x19` primär ab dem bestätigten Namensoffset ausgewertet; toleranter Altpfad bleibt Fallback.
- Pagination in Seiten bis 50 getrennt für Fotos und Videos validiert und vollständigkeitsgeprüft.
- Statusfehler werden als verständliche Meldungen in Log/UI geführt.
- Normaler `0x1B`-Download verwendet die ausgewählte Originaldatei statt LRV als Voll-Download.
- MP4 wird in Android MediaStore unter `Movies/PotensicProxy/Camera` gespeichert und per Größe/SHA-256 verifiziert; Fotos bleiben unter `Pictures/PotensicProxy/Camera`.
- Recognition-Pfad bleibt getrennt; automatisches Löschen bleibt nur für verifizierten Drone-Reco-Fototransfer bestehen.
- README und `PROTOCOL.md` an den bestätigten Stand angepasst.

## Bewusst nicht geraten / Restpunkte

- Der Änderungsauftrag fordert `0x20`-Metadaten und `0x1C`-Thumbnail-Blockassembly inklusive MD5. Die bereitgestellten Unterlagen nennen Befehle und Ablauf, aber nicht das vollständige Byte-Layout der blockweisen Antworten. Entsprechend wurde kein spekulativer Parser implementiert.
- Für Video Start/Stop ist der normale Record-Befehl `0x00` bestätigt; ein belastbarer separater Start-/Stop-Zustandswert aus der Kameraantwort ist in den bereitgestellten Unterlagen nicht bytegenau beschrieben. Die UI setzt daher keinen erfundenen Recording-Zustand.
- Reale Geräteabnahme G1-G12 bleibt erforderlich.

## Build-/Prüfstand

- `vue-tsc --noEmit`: erfolgreich.
- Vite-Bundle: nicht ausführbar, weil im gelieferten `node_modules` die optionale Linux-Rollup-Binary `@rollup/rollup-linux-x64-gnu` fehlt.
- Android/Kotlin Gradle-Compile: nicht ausführbar, weil der Wrapper Gradle 8.11.1 aus dem Internet laden müsste und die Ausführungsumgebung keinen Netzwerkzugriff hat.
- Kein physisches ATOM-System in der Ausführungsumgebung; gerätebezogene G1-G12-Tests sind daher als offen dokumentiert.
