# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - 2026-10-02 - v1.1

## Zweck
Dieses Paket enthält ausschließlich die gegenüber der vorherigen Auslieferung v1.0 geänderten bzw. neu benötigten Dateien in ihrer originalen Projektstruktur.

## Umgesetzte Änderungen
- Android-Kotlin-Buildfehler in `ProxyService.kt` behoben: `WebServer` erhält wieder `applicationContext` und `filesDir` in der aktuellen Konstruktorsignatur.
- Start, Landung, Cancel Land, RTH und Cancel RTH bleiben auf dem bestätigten `SendCtrlData`-/Function-`0x0014`-Pfad.
- Landung und RTH erhalten Bestätigungs-/Zustandslogik; aktives RTH kann über `TYPE_CANCEL_AUTO_FLY` abgebrochen werden.
- Not-Aus-Sendepfad bleibt unverändert; davor liegt jetzt ein expliziter Sicherheitsdialog ohne automatische Auslösung.
- Gimbal-Slider arbeitet stufenlos und rundet nicht mehr auf 0°/-45°/-90°.
- Presets 0°/-45°/-90° bleiben auf dem bestehenden Function-`0x1A`-Pfad.
- Kontinuierliche Zwischenwinkel werden über den bestehenden Send4Axis-Gimbal-Kanal im normalen 80-ms-Axis-Zyklus geregelt.
- Sollwinkel, Aktivstatus, Stellwert und Telemetrie-Zeitstempel werden im Store geführt.
- Regelung setzt bei Zielerreichung, Verbindungsverlust, ungültiger/veralteter Gimbal-Telemetrie und Cockpit-Verlassen auf neutral.
- Engineering-Log enthält Ziel/Ist/Fehler/Stellwert sowie Aktiv-/Neutral- und Abbruchgründe.
- Frontend- und Android-Version auf 0.957 / versionCode 30 angehoben.

## Geänderte Code-Dateien
- `app/build.gradle.kts`
- `app/src/main/java/com/potensic/proxy/ProxyService.kt`
- `webui/package.json`
- `webui/package-lock.json`
- `webui/src/components/cockpit/CockpitView.vue`
- `webui/src/components/cockpit/FlightActions.vue`
- `webui/src/components/cockpit/GimbalControl.vue`
- `webui/src/i18n/index.ts`
- `webui/src/services/DroneControlService.ts`
- `webui/src/stores/useDroneStore.ts`

## Validierung
- `vue-tsc --noEmit`: bestanden.
- Logfehler `ProxyService.kt:81` gegen aktuelle `WebServer`-Signatur korrigiert.
- Der lokale Vite-Bundlelauf ist in dieser Arbeitsumgebung nicht vollständig möglich, weil das im gelieferten `node_modules` fehlende optionale Linux-Rollup-Paket `@rollup/rollup-linux-x64-gnu` nicht lokal verfügbar ist. Die GitHub-CI führt vor dem Build `npm ci` aus und installiert optionale Plattformpakete neu.
- Ein vollständiger lokaler Android-Gradle-Build ist in dieser Arbeitsumgebung mangels vorhandener Gradle-8.11.1-Distribution nicht reproduzierbar. Der bereitgestellte CI-Log erreichte bereits `:app:compileDebugKotlin` und enthielt dort genau den nun behobenen Konstruktorfehler.
