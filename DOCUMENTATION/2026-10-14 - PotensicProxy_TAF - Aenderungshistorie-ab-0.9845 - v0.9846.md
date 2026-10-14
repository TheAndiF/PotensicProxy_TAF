# PotensicProxy_TAF – Version 0.9846
Datum: 14.10.2026
Status: Entwicklungskandidat; GitHub-/Android-Test ausstehend

## Funktionsbestand
Sämtliche Dateien und Programmkomponenten des RC11 wurden übernommen; keine fachlichen Komponenten entfernt.
Die Systembereiche App, Drohne und Web behalten ihre Ansichten. Die folgenden Bereiche werden im Quellcode nachgewiesen: Ansicht/Streams, Flug & Kalibrierung, PStart/PLand, Kamera, Video/RF, Sensoren, Remote ID, Remote/Relay und Logs; ferner Sprache, App-Updates und Drohnenprofil/Kommunikationsprotokoll.
Die Bedienbarkeit und Funktion auf dem Gerät müssen durch einen Regressionstest bestätigt werden.

## Versionierung
Aktive Frontend-Version: 0.9846 (webui/package.json, package-lock.json).
Android versionName wird aus webui/package.json abgeleitet: 0.9846.
Pairing-Runtime und Quell-HTML sind auf 0.9846 ausgerichtet; die eingebettete WebUI wird im GitHub-Build neu kompiliert.
BA_-versionCode wird im GitHub-Workflow laufnummerabhängig gesteigert.
Historische Versionsangaben seit 0.9845 bleiben für die Nachvollziehbarkeit unverändert.

## Historie seit 0.9845
- 0.9845: PStart/PLand/PPort: Modellierung, Auswertung und Anzeigefunktionen
- 0.9845.1–0.9845.6: Schrittweise Erweiterungen der Präzisionsfunktionen und Modelle; Details nach den bestehenden historischen Unterlagen
- 0.9845.7-rc1–rc6: Build- und Updatevorbereitung; Bestandsschutzgrundlagen
- 0.9845.7-rc7: Automatischer BA_-Debug-Updatekanal
- 0.9845.7-rc8: BA_ ohne Buildcache wie BL_
- 0.9845.7-rc9: Gemeinsamer BL_/BA_-GitHub-Workflow
- 0.9845.7-rc10: Permanente BA_-Signatur, frühe Secret-Prüfung
- 0.9845.7-rc11: Systemgruppen App/Drohne/Web und verschobene Sprach-/Protokolleinstellungen
- 0.9846: Einheitliche aktive Frontend-/Android-Version; Pairing-Runtime umgestellt; Navigation beibehalten

## Tests und Einschränkungen
- Statischer Vergleich: alle RC11-Quelldateien übernommen, Versions- und Runtime-Dateien angepasst.
- Menü- und Komponentenreferenzen im Quellcode vorhanden.
- Node-Quellversionsprüfung durchgeführt.
- npm-Abhängigkeitsinstallation im Container nicht abgeschlossen; daher WebUI-Build und Android-Build nicht lokal nachgewiesen.
- Embedded WebUI aus früherem Stand benötigt regulären Neuaufbau durch den GitHub-BA_-Build; nicht als getestete APK verwenden.
- Vor Freigabe: BA_-Build, Versionsprüfung, 12 Navigationseinträge, BA_-Update von RC10 sowie Regression für Kamera/PStart/PLand/Karten/Protokoll/Streams prüfen.
- Privatkeystore und Passwörter sind ausdrücklich nicht Teil der Lieferpakete.
