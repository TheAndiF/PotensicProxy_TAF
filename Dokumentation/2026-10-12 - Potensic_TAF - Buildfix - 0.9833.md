# PotensicProxy_TAF - Buildkorrektur und Versionspruefung

Datum: 2026-10-12 | App-Version: 0.9833 | Android versionCode: 58 | Status: Quellcode korrigiert, Buildtest offen

## Fehlerursache (hochgeladene GitHub-Actions-Logs)
- Der Schritt 'Build WebUI from source' war erfolgreich.
- Vite meldete einen veralteten Script-Verweis auf taf-pairing-runtime-v0.9831.js in webui/index.html.
- Der nachfolgende Schritt 'Verify embedded WebUI version sync' erwartete 0.9832 und endete mit Exit-Code 1.
- Der Android-APK-Build wurde deshalb nicht erreicht.

## Aenderungen in 0.9833
- Alle aktiven App- und WebUI-Versionsfelder auf 0.9833 vereinheitlicht; versionCode auf 58.
- Quell-HTML verweist auf die aktuelle Pairing-Runtime 0.9833.
- Build-Vorbereitung synchronisiert diesen Verweis automatisch; Versionspruefung kontrolliert auch den Quell-HTML-Verweis.
- GitHub Actions prueft die Runtime-Referenz vor dem WebUI-Build.
- Alte eingebettete Web-Builddateien bewusst aus der Quellauslieferung entfernt: Build generiert diese erneut.
- Die vorhandenen Port-9091/Port-9090- und System-Ansicht-Funktionen bleiben bestehen.

## Commit-Zusammenfuehrung
Die Commit-Nachricht dokumentiert auch die letzten zwei Entwicklungsschritte (System > Ansicht und Version 0.9832) sowie die zuvor eingefuehrte Videoausgabe. Das ist eine konsolidierte Commit-Nachricht; sie schreibt keine bestehende Git-Historie um.

## Pruefung und Einschraenkungen
JS-Syntax und Pairing-Vorbereitung wurden geprueft. Vollstaendiger npm-/Gradle-/APK-Build und Geraetetest sind hier nicht nachgewiesen. Keine freigegebene APK. Das komplette Quellprojekt erfordert bei einem Build npm ci und die vorhandene Signaturkonfiguration.
