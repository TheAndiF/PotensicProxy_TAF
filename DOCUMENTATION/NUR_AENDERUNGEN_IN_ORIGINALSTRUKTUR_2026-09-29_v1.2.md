# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - v1.2

Datum: 2026-09-29  
Status: Arbeitsstand / auslieferungsbereit, Build in Sandbox nicht vollständig ausführbar

## Inhalt

Dieses Paket enthält ausschließlich die für die aktuelle Korrektur geänderten oder neu erstellten Dateien in ihrer ursprünglichen Projektstruktur.

## Geänderte Quelldateien

- `app/build.gradle.kts` - Version auf 0.951 / versionCode 24 angehoben.
- `webui/package.json` - Frontend-Version auf 0.951 angehoben.
- `webui/src/components/cockpit/VideoPlayer.vue` - LiveView füllt die verfügbare Fläche; Seitenverhältnis bleibt durch `object-fit: contain` erhalten.
- `webui/src/components/cockpit/TelemetryBar.vue` - Drohnenakku bevorzugt als bestätigter Prozentwert; Fallback auf gemessene Zell-/Flugspannung, wenn kein gültiger Prozentwert vorliegt.
- `webui/src/types/drone.ts` - bestätigte Zellspannungsfelder für die UI typisiert.
- `README.md` - Verhalten von Fullscreen und Batterieanzeige dokumentiert.

## Begleitdateien

- `COMMIT_MESSAGE_FULLSCREEN_BATTERY_2026-09-29.txt`
- `PATCH_FULLSCREEN_BATTERY_v1.2.patch`
- `DOCUMENTATION/2026-09-29 - PotensicProxy_TAF - Projektdokumentation - Fullscreen-und-Batterieanzeige - v1.2.docx`
- `DOCUMENTATION/2026-09-29 - PotensicProxy_TAF - Projektdokumentation - Fullscreen-und-Batterieanzeige - v1.2.pdf`

## Technische Prüfung

- `vue-tsc --noEmit`: erfolgreich.
- Vite-Build: in der Sandbox nicht ausführbar, da im gelieferten `node_modules` nur Windows-Rollup-Nativepakete vorhanden sind und die Linux-Abhängigkeit ohne Netzwerk nicht nachgeladen werden kann.
- Android `assembleDebug`: in der Sandbox nicht ausführbar, da Gradle 8.11.1 nicht im Cache liegt und der Wrapper die Distribution ohne Netzwerk nicht laden kann.

Es wurden keine unbestätigten Protokollbereiche verändert und kein Drohnen-Akkuprozentwert aus Rohkapazitätsdaten geschätzt.
