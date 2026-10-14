# PotensicProxy_TAF - Auslieferungshinweis - Build-Korrektur - v0.9845.7-rc1

Datum: 2026-10-14  
Status: Release-Kandidat, nicht produktiv freigegeben  
Projekt: PotensicProxy_TAF  
Verantwortlich: KI-gestützte technische Bearbeitung, fachliche Freigabe ausstehend

Die bestehende GitHub-Actions-Buildkette wird mit `npm ci --include=optional --no-audit --no-fund` versehen und prüft `@rollup/rollup-linux-x64-gnu`. Die Projektversionsmetadaten im Lockfile werden synchronisiert. Die Anwendungsfunktionen werden durch diese Build-Korrektur nicht verändert.

Build: Commit mit `BL_`-Präfix erstellen, GitHub-Push durchführen, Workflow **Build PotensicProxy TAF APK** prüfen, APK nach Erfolg aus Artifacts abrufen. Der tatsächliche GitHub-Build, ein Android-APK-Build und die zehn PStart/PLand-Gerätetests stehen aus. Vorhandene kompilierte Webdateien können veraltet sein und sind kein Nachweis der neuen PLand-Logik.

Die Originalordnerstruktur `PotensicProxy_TAF/` bleibt in beiden ZIPs erhalten. Alle geänderten bzw. zusätzlich ausgelieferten Dateien sind in der englischen Commit-Nachricht verzeichnet.
