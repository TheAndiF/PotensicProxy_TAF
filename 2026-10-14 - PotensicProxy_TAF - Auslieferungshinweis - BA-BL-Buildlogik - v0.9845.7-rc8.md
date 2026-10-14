# PotensicProxy_TAF – Auslieferungshinweis – BA-BL-Buildlogik – v0.9845.7-rc8

Datum: 2026-10-14 | Status: Entwicklungskandidat – Gerätetest offen

## Verbindliche Buildlogik

- BL_: vollständiger, cachefreier Debug-APK-Build; normales Build-Artefakt.
- BS_: schneller Debug-APK-Build mit gültigen Caches.
- BA_: derselbe vollständige, cachefreie Debug-APK-Build wie BL_, ausgeführt **einmal** innerhalb des BA-Workflows, ergänzt um verpflichtende feste Debug-Signierung, APK-/Versionsprüfung, SHA-256, Manifest und GitHub-Prerelease.
- BA_-Commits lösen keinen zweiten BL_-Workflow-Job aus; der BA-Workflow verwendet den identischen Android-Gradle-Befehl wie BL_.

## Eingriff

BA-Workflow: Gradle-/npm-Cache-Konfigurationen entfernt, Gradle-Aufruf auf `./gradlew --no-build-cache :app:assembleDebug --stacktrace` vereinheitlicht. Signing-/Freigabeprüfungen bleiben erhalten. Kommentar zur BA-Signierung in app/build.gradle.kts korrigiert.

## Bestandsschutz

Keine absichtliche Änderung von applicationId, Programmdaten, SAF-Zugriffen oder Update-Installationslogik. Die Kompatibilität einer vorhandenen APK-Signatur und die Datenübernahme müssen auf einem Gerät geprüft werden.

## Offen

GitHub-Secrets, erfolgreiche Workflow-Ausführung, reale APK-Signatur und Android-Gerätetest sind extern nachzuweisen. Die Versionskennung rc8 ist die Liefer-/Entwicklungskennung; webui/package.json bleibt als bisherige authoritative versionName 0.9845.7 unverändert.
