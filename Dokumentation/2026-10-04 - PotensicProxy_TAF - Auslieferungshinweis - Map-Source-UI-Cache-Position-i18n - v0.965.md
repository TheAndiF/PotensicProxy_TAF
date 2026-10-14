# PotensicProxy_TAF - Auslieferungshinweis - Map-Source-UI, Cache, Position und i18n - v0.965

Datum: 2026-10-04
Basis: v0.964
Ziel: v0.965
Status: Umsetzung abgeschlossen, Build-/Geräteprüfung teilweise offen

## Umgesetzt

- Kompaktes Map-Source-Formular mit einheitlichem Raster, Mapbox-Style-Verhalten und bedienbaren Info-Popovern.
- Getrennter Temporary Tile Cache und Offline-Tile-Speicher inklusive Migration des v0.964-Layouts.
- Temporary-Cache-Metadaten und exklusives Leeren über `/api/map/cache/temporary`.
- Manuelle aktuelle Karten-/Referenzposition ohne Änderung von Telemetrie, Home/RTH oder Flugsteuerung.
- Gemeinsame Kartenkomponenten für Cockpit, Missionsplanung und Map-Reiter; Kartenquelle/Style/Map-data wirken ohne Seitenreload.
- i18n der neuen Map-Texte für alle aktuell vorhandenen WebUI-Sprachen (Englisch, Deutsch, Chinesisch).
- Versionsstand 0.965, Android versionCode 38, Map API v4.

## Bewusst offen

`Save as offline area` für die Umwandlung des Temporary Tile Cache in ein dauerhaftes Offline-Gebiet wurde in diesem Schritt nicht implementiert. Der Änderungsauftrag kennzeichnet diese Funktion ausdrücklich als optionale Erweiterung, wenn sie im aktuellen Schritt nicht realisiert wird.

## Prüfung in dieser Umgebung

- `vue-tsc --noEmit -p webui/tsconfig.json`: bestanden.
- i18n-Abdeckung: 125 verwendete `map.*`-Keys, 0 fehlende Einträge in `en`, `de`, `zh`.
- Isolierte Kotlin-Prüfung von `MapBackend.kt` mit lokalen API-Stubs: bestanden; nur die bereits bestehende JDK-Warnung zur `URL(String)`-API.
- Vite-Bundle: nicht ausführbar, weil im gelieferten `node_modules` das Linux-Rollup-Optionalpaket `@rollup/rollup-linux-x64-gnu` fehlt.
- Android-Gradle-Kompilierung: nicht ausführbar, weil Gradle 8.11.1 lokal nicht gecacht ist und die isolierte Umgebung keinen DNS-/Netzzugriff zum Download zulässt.

Daher muss der normale Windows-/CI-Build die WebUI neu bündeln und den vollständigen Android-Build/APK-Test ausführen. `app/src/main/assets/web` enthält bis zu diesem Build noch den zuvor eingebetteten WebUI-Stand.

## Geänderte/neu angelegte Dateien

- `MAP_INTEGRATION_NOTES.md`
- `README.md`
- `VERSIONING.md`
- `app/build.gradle.kts`
- `app/src/main/java/com/potensic/proxy/MapBackend.kt`
- `app/src/main/java/com/potensic/proxy/VersionInfo.kt`
- `app/src/main/java/com/potensic/proxy/WebServer.kt`
- `webui/package-lock.json`
- `webui/package.json`
- `webui/src/components/cockpit/CockpitView.vue`
- `webui/src/components/cockpit/MapView.vue`
- `webui/src/components/map/InfoPopover.vue`
- `webui/src/components/map/MapMainView.vue`
- `webui/src/components/map/MapSourceControls.vue`
- `webui/src/components/map/MapTileLayer.vue`
- `webui/src/components/mission/MissionPlannerView.vue`
- `webui/src/components/settings/MapSettingsView.vue`
- `webui/src/composables/useMapPosition.ts`
- `webui/src/i18n/index.ts`
- `webui/src/services/MapService.ts`
- `webui/src/types/map.ts`
- `webui/src/utils/mapProjection.ts`
- `COMMIT_MESSAGE.txt`
- `2026-10-04 - PotensicProxy_TAF - Commit-Nachricht - Map-Source-UI-Cache-Position-i18n - v0.965.txt`
- `2026-10-04 - PotensicProxy_TAF - Auslieferungshinweis - Map-Source-UI-Cache-Position-i18n - v0.965.md`
- `DOCUMENTATION/2026-10-04 - PotensicProxy_TAF - Aenderungsdokumentation - Map-Source-UI-Cache-Position-und-Sprachsteuerung - v0.1.docx`
- `DOCUMENTATION/2026-10-04 - PotensicProxy_TAF - Aenderungsdokumentation - Map-Source-UI-Cache-Position-und-Sprachsteuerung - v0.1.pdf`
- `2026-10-04 - PotensicProxy_TAF - Patch - Map-Source-UI-Cache-Position-i18n - v0.965.patch`
