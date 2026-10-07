# PotensicProxy_TAF v0.972 – Landehilfe

## Änderungen

- Neues ausklappbares Cockpit-Feld **Landehilfe**.
- Ein-/ausblendbares, mittig fixiertes Zielkreuz als reines LiveView-Overlay.
- Vier selbstzentrierende Feinregler für Throttle, Yaw, Pitch und Roll.
  - Bereich: `-250 .. +250`, entsprechend 25 % des normalen virtuellen Joystickbereichs `-1000 .. +1000`.
  - Beim Loslassen wird die jeweilige Achse sofort auf `0` zurückgesetzt.
  - Die bestehende Send4Axis-Schleife mit 80 ms wird weiterverwendet.
- Neuer **Live-Foto**-Button.
  - Speichert den letzten dekodierten Videoframe direkt in `Pictures/PotensicProxy/Camera`.
  - Das Zielkreuz ist nur WebUI-Overlay und wird nicht in das gespeicherte Bild gerendert.
- Neuer RTH-Bereich in der Landehilfe.
  - Voreinstellung: `120 m`.
  - Einstellbar zwischen `20 m` und `120 m`.
  - Vor RTH werden die vorhandenen, bestätigten 0x0003-Flugeinstellungen beibehalten und nur `returnHeight` geändert.
  - RTH wird erst ausgelöst, wenn die gewünschte Rückkehrhöhe anschließend in der Telemetrie bestätigt wurde; andernfalls wird RTH abgebrochen und geloggt.
- Version auf **0.972 / versionCode 45** angehoben.

## Prüfung

- `vue-tsc` lief für die geänderten WebUI-Quellen fehlerfrei durch.
- Der Vite-Bundle-Schritt konnte in der isolierten Linux-Umgebung nicht abgeschlossen werden, weil im gelieferten `node_modules` die optionale Linux-Abhängigkeit `@rollup/rollup-linux-x64-gnu` fehlt und kein Netzwerkzugriff zum Nachladen verfügbar ist.
- Der Gradle/Kotlin-Build konnte ebenfalls nicht vollständig ausgeführt werden, da die Gradle-Distribution 8.11.1 nicht lokal vorhanden war und ohne Netzwerk nicht heruntergeladen werden konnte.
- Das Projekt besitzt bereits den Android-`preBuild`-Schritt zur Neuerzeugung der WebUI-Assets. Auf der normalen Build-/CI-Umgebung daher den regulären Build ausführen.
