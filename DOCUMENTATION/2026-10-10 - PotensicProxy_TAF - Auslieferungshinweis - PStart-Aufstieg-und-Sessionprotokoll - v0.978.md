# PotensicProxy_TAF – Auslieferungshinweis – PStart-Aufstieg und Sessionprotokoll – v0.978

**Datum:** 2026-10-10  
**App-Version:** 0.978  
**Android versionCode:** 51

## Inhalt

Diese Auslieferung erweitert PStart um eine robustere Erkennung der ersten Luftreferenz und der weiteren Höhenstufen, konfigurierbare horizontale GPS-Positionstoleranzen sowie ein dauerhaftes PStart-Sessionprotokoll.

Die stabile Schwebehöhe wird über ein Zeitfenster gemittelt. Der erste Referenzpunkt bleibt bei Schwebehöhe + 0,10 m. Beim Erreichen bzw. Überschreiten einer Zielhöhe wird Throttle neutralisiert; PStart wartet anschließend auf eine ausreichend geringe Vertikalbewegung und akzeptiert eine begrenzte Höhenabweichung, ohne ein Absenken zu befehlen. Ein deutlicher Höhenabfall unter das Toleranzband setzt den vertikalen Aufstieg fort.

Unter **System → PStart** stehen zusätzlich ein Positions-Warnradius (Standard 3,0 m) und ein Positions-Abbruchradius (Standard 6,0 m) zur Verfügung. Innerhalb des Warnradius blockiert GPS-Drift keine Höhenstufe. Zwischen Warn- und Abbruchradius läuft PStart mit Positionswarnung weiter. Die Abbruchgrenze muss 1,0 s kontinuierlich überschritten sein, bevor PStart abbricht. Es erfolgt weiterhin keine automatische Pitch-/Roll-/Yaw-Positionskorrektur.

Jede PStart-Session zeichnet ein JSONL-Protokoll mit 5 Hz auf. Es enthält Telemetrie, PStart-Steuerbefehle, Zustandswechsel, Zielhöhen, Positionsqualität, Gimbal-/Zoom-/Bildereignisse sowie Abschluss- oder Abbruchstatus. Die Bilder und die JSONL-Datei werden nach Möglichkeit im gemeinsamen Sessionordner `Pictures/PotensicProxy/Recognition/PStart_<SessionId>/` gespeichert.

Das erste STEP0-Bild ohne Zoom ist das Session-Masterbild. Nach Sessionende wird das vollständige JSONL-Protokoll gzip-komprimiert und in eigene, chunkbare JPEG-APP15-Segmente eingebettet. Diese Einbettung wird unabhängig vom JSONL-Sidecar versucht; wenn Android Scoped Storage die Nicht-Mediendatei im Pictures-Ordner ablehnt, bleibt die vollständige Session daher im Masterbild erhalten.

## Validierung

- Vue/TypeScript: bestanden (`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit`).
- Kotlin-Syntaxscan: keine Parser-/Syntaxfehler festgestellt; Android-/Projektklassen sind ohne Android-Gradle-Classpath erwartungsgemäß nicht auflösbar.
- JPEG-APP15-Container: mit realem 1280×720-PStart-JPEG getestet; JPEG blieb nach Einbettung decodierbar.
- Vite-Bundle: in der Arbeitsumgebung blockiert, da das gelieferte `node_modules` das Linux-Rollup-Optionalpaket `@rollup/rollup-linux-x64-gnu` nicht enthält.
- Android-Gradle-Build: in der Arbeitsumgebung blockiert, da der Wrapper Gradle 8.11.1 herunterladen möchte und kein Netzzugriff verfügbar ist.
- Freiflug-/Hardwaretest bleibt erforderlich, insbesondere für Nahbereichs-Throttle 150, Windverhalten, GPS-Toleranzen und die Sichtbarkeit des JSONL-Sidecars auf dem Ziel-Android-Gerät.

## Ausgelieferte Artefakte

- vollständiges Codepaket v0.978
- Änderungspaket v0.978 in Originalstruktur
- Projektdokumentation PDF und DOCX
- Unified-Diff-Patch der Text-/Quelldateien
- englische Commit-Nachricht
- dieser Auslieferungshinweis
