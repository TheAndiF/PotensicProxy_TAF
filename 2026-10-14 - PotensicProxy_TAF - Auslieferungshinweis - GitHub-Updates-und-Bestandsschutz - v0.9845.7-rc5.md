# PotensicProxy_TAF – Auslieferung – v0.9845.7-rc5

Stand: 2026-10-14 · Status: **Release-Kandidat, keine APK-Abnahme**

Quelle: PotensicProxy_TAF (9).zip. Root: `PotensicProxy_TAF/` (unverändert).

## Github-Voraussetzungen

- Debug-Updates: `TAF_DEBUG_KEYSTORE_B64`, `TAF_DEBUG_STORE_PASSWORD`, `TAF_DEBUG_KEY_ALIAS`, `TAF_DEBUG_KEY_PASSWORD` als GitHub Secrets hinterlegen. Der Debug-Keystore muss dauerhaft derselbe sein.
- Stable-Releases: `TAF_RELEASE_KEYSTORE_B64`, `TAF_RELEASE_STORE_PASSWORD`, `TAF_RELEASE_KEY_ALIAS`, `TAF_RELEASE_KEY_PASSWORD` und geschütztes Environment `production` konfigurieren.
- Bereits installierte APKs mit anderslautender Signatur sind **nicht** in-place updatefähig; vor Migration Daten sichern.
- GitHub Actions Workflow muss Schreibrechte für die Erstellung öffentlicher Releases besitzen.
- Die Update-App nutzt das öffentliche Repository `TheAndiF/PotensicProxy_TAF`, ohne eingebettete GitHub-Tokens.
- Benachrichtigungen und die Android-Berechtigung „Unbekannte Apps installieren“ ggf. manuell freigeben.

## Einschränkungen

- Auto-Prüfung nur bei geöffneter Updateoberfläche; keine permanente Hintergrundplanung.
- Keine garantierte Unterbrechung des Android-PackageInstaller-Vorgangs und **kein** automatisches Downgrade/Rollback.
- Telefonbatterie > 40 %, keine Drohnenverbindung/erkannten Flugzustände, Benutzer bestätigt zusätzlich sicheren Zustand vor Installation.
- APK und Signatur werden bei Download und vor Installationsstart geprüft. Zur Installation ist eine Aktion am Handy nötig.
- Kein lokaler vollständiger APK-Build; TypeScript-Check und Workflow-Syntax geprüft, Vite-Build durch Linux-Rollup-Binärdatei der bereitgestellten node_modules blockiert.
- Gerätetests inkl. SAF/Datenbestandsschutz sind noch offen.

## Änderungsliste
- `.github/workflows/build-apk.yml`
- `.github/workflows/release-apk.yml`
- `app/build.gradle.kts`
- `app/src/main/AndroidManifest.xml`
- `app/src/main/java/com/potensic/proxy/MainActivity.kt`
- `app/src/main/java/com/potensic/proxy/WebServer.kt`
- `app/src/main/java/com/potensic/proxy/UpdateManager.kt`
- `app/src/main/res/xml/update_file_paths.xml`
- `webui/src/components/debug/DebugConsoleView.vue`
- `webui/src/components/settings/AppUpdateSettings.vue`
- `DOCUMENTATION/Update_Bestandsschutz/2026-10-14 - PotensicProxy_TAF - Projektvorgabe - Update-Bestandsschutz-und-Wiederherstellung - v1.0.docx`
- `DOCUMENTATION/Update_Bestandsschutz/2026-10-14 - PotensicProxy_TAF - Projektvorgabe - Update-Bestandsschutz-und-Wiederherstellung - v1.0.pdf`
- `DOCUMENTATION/Update_Bestandsschutz/2026-10-14 - PotensicProxy_TAF - Release-Dokumentation - GitHub-Updates-und-Bestandsschutz - v0.9845.7-rc5.docx`
- `DOCUMENTATION/Update_Bestandsschutz/2026-10-14 - PotensicProxy_TAF - Release-Dokumentation - GitHub-Updates-und-Bestandsschutz - v0.9845.7-rc5.pdf`
