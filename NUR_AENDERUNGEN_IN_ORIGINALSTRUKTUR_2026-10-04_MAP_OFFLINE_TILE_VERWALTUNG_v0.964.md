# Nur Änderungen in Originalstruktur - Map Offline-Tile-Verwaltung v0.964

Datum: 2026-10-04

## Anlass

Die Kartenfunktion soll nach der Wiederherstellung der Backend-Erreichbarkeit und der Android-kompatiblen Providerkommunikation als dauerhaft nutzbare Kartenlösung erweitert werden. Gewünscht sind eine persistente Speicherung des Karten-Keys, die direkte Umschaltung zwischen Satellit/Karte/weiteren Quellen innerhalb der Karte, ein eindeutig steuerbares Offline-/Online-Verhalten sowie Wartungsfunktionen für bereits heruntergeladene Tiles.

## Änderungen

- `app/src/main/java/com/potensic/proxy/MapBackend.kt`
  - Bestehende backendseitige Token-/Providerkonfiguration wird als dauerhafte app-interne Konfiguration beibehalten und jetzt atomarer geschrieben (`config.json.tmp` -> Ziel). Der Token wird weiterhin nicht im Klartext an die WebUI zurückgegeben.
  - Eigene `customTileUrlTemplate`-Konfiguration ergänzt, damit die Umschaltung auf OpenStreetMap eine konfigurierte Custom-XYZ-Quelle nicht überschreibt.
  - Karten-Datenmodi präzisiert:
    - `auto`: lokaler Cache wird bevorzugt; nur fehlende/ungültige Tiles werden online geladen und gespeichert.
    - `offline`: ausschließlich lokaler Cache; keine Provideranfrage.
    - `online`: Provider wird bevorzugt abgefragt und der Cache aktualisiert; bei temporärem Providerfehler kann ein bereits gültiger Cache-Tile als Fallback genutzt werden.
  - Offline-Regionen speichern zusätzlich die für einen späteren Update-/Reload-Vorgang notwendige Quellenidentität sowie `cachedTiles` und `sizeBytes`.
  - `Update` lädt nur fehlende/ungültige Tiles nach.
  - `Reload` lädt alle Tiles erneut vom gespeicherten Provider und ersetzt vorhandene Dateien erst nach erfolgreichem Download.
  - `Delete tiles` löscht die nur dieser Region zugeordneten Cache-Tiles, lässt die Regionsdefinition bestehen und erhält Tiles, die von einer anderen gespeicherten Region mit gleichem Cache-Namespace mitbenutzt werden.
  - `Remove` entfernt die Regionsdefinition und löscht nicht geteilte Tiles asynchron.
  - Nach Prozess-/App-Neustart werden liegen gebliebene aktive Statuswerte als `interrupted` wieder freigegeben.
  - Regionsmetadaten werden ebenfalls atomarer geschrieben.

- `app/src/main/java/com/potensic/proxy/WebServer.kt`
  - Browserseitiges Tile-Caching wird für `/api/map/tiles/*` mit `Cache-Control: no-store` unterbunden, damit allein der Backendmodus Auto/Offline/Online über die Cache-Nutzung entscheidet.
  - Neue Map-API-v3-Endpunkte:
    - `POST /api/map/regions/{id}/update`
    - `POST /api/map/regions/{id}/reload`
    - `DELETE /api/map/regions/{id}/tiles`
  - Laufende Regionsoperationen liefern bei konkurrierenden Wartungsaufrufen `HTTP 409`.

- `webui/src/components/cockpit/MapView.vue`
  - Direktes Kartenmenü als Overlay in der Karte ergänzt.
  - Umschaltung zwischen OpenStreetMap, Mapbox Satellite, Mapbox Streets, Mapbox Outdoors, dem konfigurierten Mapbox-Stil und Custom XYZ möglich.
  - Direkte Umschaltung zwischen `Auto`, `Offline only` und `Online first` möglich.
  - Gespeicherter/fehlender Mapbox-Token wird im Kartenoverlay nur als Status angezeigt.
  - Nach Provider-/Modusänderung werden sichtbare Tiles mit neuer Revision angefordert, ohne Position oder Zoom zurückzusetzen.

- `webui/src/components/settings/MapSettingsView.vue`
  - Dauerhafte Token-Speicherung und deren Grenzen werden in der Oberfläche sichtbar erklärt.
  - Datenmodus-Verhalten wird verständlich beschrieben.
  - Offline-Bereichsverwaltung um `Update`, `Reload`, `Delete tiles` und `Remove` erweitert.
  - Bestätigungsdialoge für Reload, Tile-Löschung und Regionsentfernung ergänzt.
  - Cache-Größe und vorhandene Tile-Anzahl werden angezeigt.
  - Konfigurationsänderungen aus dem Kartenoverlay werden live in die Einstellungen übernommen.

- `webui/src/services/MapService.ts`
  - Konfigurationsänderungsereignis zwischen Kartenoverlay und Einstellungsansicht ergänzt.
  - Tile-Revision für kontrolliertes Neuladen ergänzt.
  - API-Aufrufe für Update, Reload und Tile-Löschung ergänzt.

- `webui/src/types/map.ts`
  - `MapDataMode`, `customTileUrlTemplate` und zusätzliche Offline-Regionsmetadaten ergänzt.

- Versionsstand
  - Android/WebUI: `0.964`
  - Android `versionCode`: `37`
  - Map API: `3`
  - Build-Datum: `2026-10-04`

## Erwartetes Verhalten

1. Ein einmal gespeicherter Token bleibt nach WebUI-, App- und Geräte-Neustart im Android-Backend erhalten und wird an den Browser nur maskiert zurückgegeben. Android-App-Daten löschen bzw. Deinstallation entfernt die gespeicherte Konfiguration.
2. Kartenquelle und Datenmodus können direkt in der Karte umgeschaltet werden; Position und Zoom bleiben erhalten.
3. `Auto` verwendet vorhandene Offline-/Cache-Tiles zuerst und lädt nur Fehlendes online nach.
4. `Offline only` erzeugt keine Provideranfragen und zeigt nur bereits lokal vorhandene Tiles.
5. `Online first` aktualisiert Tiles bevorzugt vom Provider und nutzt vorhandene lokale Tiles nur als Fallback bei einem Providerfehler.
6. Offline-Regionen können nachgeladen, vollständig aktualisiert, von lokalen Tiles bereinigt oder vollständig entfernt werden.
7. Das Löschen von Tiles einer Region zerstört keine Tiles, die von einer weiteren gespeicherten Region mit derselben Kartenquelle benötigt werden.
8. Die öffentliche OpenStreetMap-Tile-Infrastruktur bleibt für Bulk-/Offline-Prefetch gesperrt.

## Validierung

- `vue-tsc --noEmit`: fehlerfrei.
- `MapBackend.kt` wurde mit Kotlin/JVM und lokalen Stubs für Android-/Projektabhängigkeiten syntaktisch und typseitig kompiliert; keine Kotlin-Fehler in der geänderten Backenddatei.
- `git diff --check`: wird vor Auslieferung ausgeführt.
- Vite-Produktionserzeugung kann in der isolierten Linux-Umgebung mit dem im Paket enthaltenen `node_modules` nicht abgeschlossen werden, da die optionale Linux-Rollup-Nativabhängigkeit `@rollup/rollup-linux-x64-gnu` fehlt.
- Der vollständige Android-Gradle-Build kann in dieser Umgebung nicht gestartet werden, weil Gradle 8.11.1 nicht lokal vorliegt und `services.gradle.org` aufgrund fehlenden Netzwerkzugriffs nicht aufgelöst werden kann.
- Der Geräte-/CI-Lauf bleibt Bestandteil der Abnahme.

## Nicht geändert

- Keine Änderung an USB/BX3, Kamera, LiveView, Telemetrie oder Flugsteuerungsprotokollen.
- Keine Auslagerung des Mapbox-Tokens in die WebUI.
- Keine Freigabe von OSM-Bulk-/Offline-Prefetch.
