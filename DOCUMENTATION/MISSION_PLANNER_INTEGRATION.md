# TAF Missionsplanung – Integration 0.950

## Ziel
Die Missionsplanung ist als eigener Hauptbereich in derselben Navigationsreihe wie das Flug-Cockpit integriert. Sie verwendet die vorhandene TAF-Kartenversorgung und hält Missionsdaten unabhängig von den derzeitigen Fähigkeiten der ATOM 1 vollständig vor.

## Funktionsumfang
- Hauptnavigation `Missionsplanung`
- manuelle Wegpunkte per Kartenklick
- Generatoren für Kreis, Polygon, Survey-Raster und Spirale
- Routenreihenfolge umkehren
- vollständige Wegpunktdaten: Latitude, Longitude, Höhe, Geschwindigkeit, Yaw, Gimbal, Zoom, Verweildauer, Missionsaktion und Kameraaktion
- persistente Missionen unter dem Android-App-Dateibereich `missions/`
- Missionen laden, speichern und löschen
- ATOM-1-Prüfung mit Hinweisen zu Waypoint-Limit und derzeit nicht ausgeführten Feldern
- PotensicPro-kompatibler `map.db`-Export über das Android-Backend
- automatische Aufteilung des ATOM-1-Exports auf maximal 45 Wegpunkte je `flightrecordbean`

## Architektur
`TAFMission` ist das führende Datenformat. Der Potensic-Export ist ein Adapter und entfernt keine Felder aus der gespeicherten TAF-Mission.

Frontend:
- `webui/src/types/mission.ts`
- `webui/src/mission/geometry.ts`
- `webui/src/services/MissionService.ts`
- `webui/src/components/mission/MissionPlannerView.vue`

Backend:
- `app/src/main/java/com/potensic/proxy/MissionBackend.kt`
- REST-Routen in `WebServer.kt`

## ATOM-1-Export
Der Export erzeugt die bekannten PotensicPro-Tabellen `flightrecordbean`, `multipointbean`, `android_metadata`, `table_schema` sowie die erwarteten leeren Begleittabellen. `user_version=5`, `page_size=4096` und die Potensic-Locale werden gesetzt.

Die ATOM 1 erhält über `multipointbean` weiterhin nur die 2D-Koordinaten. Höhe und Geschwindigkeit werden als Missionsmetadaten geschrieben. Yaw, Gimbal, Zoom und Kameraaktionen bleiben im TAF-Masterdatensatz erhalten, werden aber nicht in unbestätigte ATOM-1-Felder hineinerfunden.

## Nicht verändert
Die bestehenden USB-, FE/FF/FD-, Video-, Joystick- und Drohnenprotokollmodule wurden für diese Integration nicht verändert. Die Missionsplanung greift in dieser Version nicht direkt in das Flugprotokoll ein.

## Prüfung
`vue-tsc` läuft für die WebUI fehlerfrei. Der Vite-Bundle-Lauf kann in der Bearbeitungsumgebung nicht vollständig ausgeführt werden, weil das mitgelieferte `node_modules` Windows-Rollup-Binaries enthält. Der Gradle/Kotlin-Build konnte dort ebenfalls nicht vollständig ausgeführt werden, weil die Gradle-Distribution ohne Netzwerkzugriff nicht nachgeladen werden konnte. Auf dem Zielsystem daher `npm ci && npm run build` sowie den regulären Gradle-Build ausführen.


## Integration in die aktuelle TAF-Struktur
Der Missionsplaner wurde in die aktuelle Projektstruktur integriert. Die bestehenden Hauptpunkte Map und Galerie bleiben erhalten; Missionsplanung wird direkt hinter Flug-Cockpit ergänzt. Frontend (`webui/`) und Android-Backend (`app/`) bleiben getrennt.
