# PotensicProxy_TAF v0.974 - Landehilfe und Telemetrie-Lesbarkeit

## Umgesetzt

- Die vier Landehilfe-Regler Throttle, Yaw, Pitch und Roll zentrieren beim Loslassen zuverlässig auf 0.
- Pointer Capture sowie Release-, Cancel- und Lost-Capture-Ereignisse sichern die Neutralisierung auch beim Verlassen des Reglers ab.
- Jede Achse besitzt links eine Minus- und rechts eine Plus-Taste für einen diskreten Einzelschritt.
- Ein Einzelschritt verwendet +/-10 RC-Einheiten für 160 ms und neutralisiert anschließend automatisch.
- Unter System / Anzeige ist die Schriftgröße der unteren Cockpit-Telemetrie-Leiste einstellbar.
- Einstellbereich der Telemetrie-Schriftgröße: 9-24 px, Standard: 10 px.
- Die Schriftgröße kann per Zahlenfeld oder Slider geändert und auf Standard zurückgesetzt werden.
- Die Einstellung wird im LocalStorage gespeichert.
- Version angehoben auf WebUI 0.974 sowie Android versionName 0.974 / versionCode 47.

## Prüfung

- `vue-tsc --noEmit`: erfolgreich.
- Vollständiger Vite-Bundle-Schritt: in der gelieferten Umgebung nicht möglich, da `@rollup/rollup-linux-x64-gnu` im vorhandenen `node_modules` fehlt.
- DOCX und PDF wurden gerendert und visuell geprüft.

## Auslieferungsbestandteile

- vollständiges Projektpaket
- Paket nur mit geänderten/neuen Dateien in Originalstruktur
- Patch-Datei
- englische Commit-Nachricht
- Projektdokumentation als PDF und DOCX
