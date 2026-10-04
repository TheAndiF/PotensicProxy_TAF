# Nur Änderungen in Originalstruktur – Map-Backend-Erreichbarkeit v0.962

Datum: 2026-10-04

## Anlass

In der Map-WebUI konnten Kartenkacheln und Offline-Bereiche mit `NetworkError when attempting to fetch resource` ausfallen. Die Map-Requests wurden bislang aus `potensic_target_host` / `store.normalizedHost` aufgebaut. Dieser Host ist jedoch für die Drohnen-/Relay-Verbindung konfigurierbar und muss nicht mit dem Android-Gerät identisch sein, das die WebUI und das lokale Map-Backend bereitstellt.

Zusätzlich wird der Ktor-Webserver nun explizit auf `0.0.0.0` gebunden, damit die beabsichtigte Erreichbarkeit über die Android-LAN/WLAN-IP nicht von einem impliziten Engine-Default abhängt.

## Änderungen

- `webui/src/services/MapService.ts`
  - Produktionsbetrieb: Map-API und Tile-URLs verwenden `window.location.origin`.
  - Damit bleiben `/api/version`, `/api/map/config`, `/api/map/test`, `/api/map/tiles/*` und `/api/map/regions*` immer an das Backend gekoppelt, das die laufende WebUI ausgeliefert hat.
  - `potensic_target_host` bzw. die Remote-/Relay-Zieladresse beeinflusst die Kartenfunktion nicht mehr.
  - Im Vite-Entwicklungsbetrieb bleibt die bisherige Weiterleitung über `store.normalizedHost` erhalten.

- `app/src/main/java/com/potensic/proxy/WebServer.kt`
  - Ktor/CIO wird explizit mit `host = "0.0.0.0"` und Port `9090` gestartet.
  - Start-Log weist die LAN-Bindung explizit aus.

- Versionsstand
  - Android/WebUI: `0.962`
  - Android `versionCode`: `35`
  - Build-Datum: `2026-10-04`

## Nicht geändert

- Keine Änderung an USB/BX3-Protokollen, Flugsteuerung oder Kamera-Protokollen.
- Keine Änderung an Mapbox-Token-Speicherung oder Provider-URLs.
- Die tatsächliche LAN-Erreichbarkeit setzt weiterhin voraus, dass der Android-Prozess läuft und das verwendete WLAN/LAN Client-to-Client-Verbindungen nicht blockiert.

## Validierung

- `vue-tsc --noEmit` läuft mit den gelieferten Quellen fehlerfrei durch.
- Die Vite-Bündelung konnte in der isolierten Linux-Umgebung nicht abgeschlossen werden, weil das mitgelieferte `webui/node_modules` nur die Windows-Rollup-Nativmodule enthält (`@rollup/rollup-linux-x64-gnu` fehlt). Der Android-Gradle-Build ruft `npm run build` über `preBuild` auf und erzeugt die eingebetteten WebUI-Assets auf der normalen Build-/CI-Plattform neu.
- Die Ktor-3.1.x-`embeddedServer`-Signatur unterstützt `host = "0.0.0.0"`; die explizite Angabe ist daher quellseitig kompatibel.
