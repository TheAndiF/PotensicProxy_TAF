# PotensicProxy_TAF - Live Reco / Drone Reco

Datum: 2026-10-01
Version: 0.956 / Android versionCode 29
Ausgangsstand: 0.955 Image Recognition Prerequisites

## 1. Ziel

Die normale Foto-/Kamerafunktion und der fortschrittliche Recognition-Weg sind getrennt. Recognition besitzt zwei Bildquellen, die hinter der Aufnahmequelle dieselbe Speicher-, Metadaten- und spätere Erkennungspipeline verwenden:

- **Live Reco**: aktuelles dekodiertes LiveView-JPEG wird direkt auf Android gespeichert.
- **Drone Reco**: echtes Kamerafoto wird auf der Drohne erzeugt, nach Android übertragen, lokal verifiziert und erst danach auf der Drohne gelöscht.

Die eigentliche KI-/Objekterkennung ist in diesem Stand noch nicht implementiert. Der gemeinsame Datensatz enthält bereits `recognition.processed=false` und `recognition.runs=[]` als Erweiterungspunkt.

## 2. Speichertrennung

Normale Kamera-Downloads:

`Pictures/PotensicProxy/Camera/`

Recognition-Aufnahmen:

`Pictures/PotensicProxy/Recognition/`

Beide Pfade werden über Android MediaStore veröffentlicht. Die App führt zusätzlich einen eigenen Index mit `content://`-URI.

## 3. Camera Gallery

Die bestehende Kamera-/SD-Galerie bleibt erhalten. Ein manuell heruntergeladenes Foto wird nach `Pictures/PotensicProxy/Camera/` gespeichert. Es wird **nicht** automatisch auf der Drohne gelöscht.

Damit bleibt der bisherige Benutzerweg von der neuen Recognition-Funktion unabhängig.

## 4. Recognition Gallery

Auf der Gallery-Seite existieren zwei klar getrennte Tabs:

- `Camera`
- `Recognition`

Der Recognition-Tab zeigt alle lokalen Recognition-Bilder. Jedes Bild wird als `LIVE` oder `DRONE` gekennzeichnet. Verifizierte Dateien tragen zusätzlich den Status `verified`. Die vollständigen gespeicherten Metadaten können pro Bild aufgeklappt werden.

Filter:

- All
- Live
- Drone

## 5. Live Reco

Ablauf:

1. aktuelles Telemetrie-/Kamera-/Steuerungsabbild erzeugen;
2. letztes dekodiertes LiveView-JPEG übernehmen;
3. unter `Pictures/PotensicProxy/Recognition/` speichern;
4. MediaStore-Datei zurücklesen;
5. Dateigröße und SHA-256 mit dem Quelldatensatz vergleichen;
6. Bild als Recognition-Eingabe bereitstellen.

Auf der Drohne entsteht hierbei keine zusätzliche Fotodatei.

## 6. Drone Reco

Sicherheitsorientierter Ablauf:

1. aktuelle Kamera-Dateiliste vollständig einlesen;
2. Kamera-Galerie verlassen;
3. Recognition-Metadaten zum Auslösezeitpunkt erfassen;
4. normalen Potensic-Fotobefehl senden;
5. Kamera-Galerie erneut öffnen;
6. neu hinzugekommene Fotodatei gegenüber der Ausgangsliste identifizieren; bei RAW+JPEG wird für Recognition ein direkt dekodierbares JPG/JPEG/PNG bevorzugt, zusätzliche Dateien bleiben unberührt;
7. Originalfoto von der Kamera nach Android übertragen;
8. unter `Pictures/PotensicProxy/Recognition/` speichern;
9. gespeicherte MediaStore-Datei zurücklesen;
10. Byteanzahl und SHA-256 verifizieren;
11. **nur bei erfolgreicher Verifikation** Löschbefehl für exakt diese Quelldatei senden;
12. Kamera-Löschbestätigung abwarten;
13. erst danach den Drone-Reco-Vorgang als erfolgreich melden.

Bei fehlendem neuen Foto, Downloadfehler, Speicherfehler, Verifikationsfehler oder fehlender Löschbestätigung gilt der Vorgang als fehlgeschlagen. Die Implementierung führt dann keinen erfolgreichen Auto-Delete-Abschluss aus.

## 7. Metadaten

Für Recognition wird Schema-Version 1 verwendet. Gespeichert werden alle zum Aufnahmezeitpunkt in der App tatsächlich verfügbaren Werte, insbesondere:

- UTC/Unix-Aufnahmezeit;
- Recognition-Quelle `LIVE_RECO` oder `DRONE_RECO`;
- vollständiger aktueller Telemetrie-State;
- Latitude/Longitude und GPS-Gültigkeitsstatus;
- relative Höhe, Altitude, Distanz und Geschwindigkeiten soweit vorhanden;
- Heading, Pitch, Roll;
- Gimbal Pitch/Roll/Yaw, Geschwindigkeiten und Steuerwert;
- RC-Hardwarewerte;
- virtuelle/angeforderte Steuerwerte;
- Akku-/Spannungswerte soweit vorhanden;
- Flug-/GPS-/Statusflags;
- Kamera-Auflösungsindizes, EV, Zoom, Manual/ISO/Shutter/WB, RAW/OSD/GPS-Einstellungen;
- SD-Kartenstatus;
- Verbindungsstatus;
- TAF-Version und Metadaten-Schema;
- tatsächliches Bildformat, Bytegröße, Bildabmessungen soweit dekodierbar;
- SHA-256;
- MediaStore-Verifikationsstatus;
- vorbereiteter Recognition-Ergebnisbereich.

Nicht bekannte Werte werden nicht geschätzt.

## 8. Gemeinsame Recognition-Pipeline

Beide Quellen erzeugen denselben `AndroidStoredImage`-/Recognition-Datensatz. Damit kann die spätere Erkennung unabhängig von der Aufnahmequelle implementiert werden.

Logische Struktur:

```text
LiveView frame -----\
                    > Recognition image -> Metadata -> Recognition engine -> Results
Camera photo -------/
```

Ein späterer Hybrid-Modus kann dadurch Live Reco zur schnellen Kandidatensuche und Drone Reco zur hochauflösenden Bestätigung verwenden, ohne eine zweite Erkennungsengine einzuführen.

## 9. Geänderte Kernmodule

- `app/src/main/java/com/potensic/proxy/AndroidMediaRepository.kt`
- `app/src/main/java/com/potensic/proxy/WebServer.kt`
- `webui/src/services/AndroidMediaService.ts`
- `webui/src/services/CameraMediaService.ts`
- `webui/src/services/RecognitionCaptureService.ts` (neu)
- `webui/src/services/RecognitionMetadataService.ts` (neu)
- `webui/src/services/DroneControlService.ts`
- `webui/src/components/gallery/GalleryView.vue`
- `webui/src/i18n/index.ts`
- `README.md`
- Versionsdateien

## 10. Verifikation

Erfolgreich ausgeführt:

*`./node_modules/.bin/vue-tsc --noEmit`*

Ergebnis: ohne TypeScript-/Vue-Typfehler.

Der vollständige Vite-Build wurde in der Linux-Arbeitsumgebung versucht:

*`npm run build`*

Ergebnis: nicht aufgrund des Quellcodes, sondern wegen des im übernommenen `node_modules` fehlenden optionalen Linux-Pakets `@rollup/rollup-linux-x64-gnu` abgebrochen. Das Paket enthält Windows-Rollup-Binaries. Auf dem Windows-Build-PC sollte ein sauberes *`npm ci`* vor dem Build ausgeführt werden.

Android-Kotlin-Kompilierung wurde ebenfalls angestoßen:

*`./gradlew :app:compileDebugKotlin --offline`*

Der Wrapper versucht die nicht lokal vorhandene Gradle-8.11.1-Distribution zu beziehen; Netzwerkzugriff auf `services.gradle.org` ist in der Arbeitsumgebung nicht verfügbar. Daher konnte der native Android-Compile hier nicht abgeschlossen werden.

## 11. Hardwaretest erforderlich

Folgende Punkte müssen mit echter Drohne/Controller bestätigt werden:

- neues Foto erscheint nach dem Auslösen zuverlässig in der Dateiliste;
- das richtige neue Foto wird eindeutig ausgewählt;
- vollständiger Foto-Download funktioniert;
- MediaStore-Verifikation liefert `verified=true`;
- der bekannte Kamera-Löschbefehl löscht exakt die übertragene Quelldatei;
- Löschbestätigung wird zuverlässig empfangen;
- bei absichtlich unterbrochenem Transfer bleibt die Quelldatei auf der Drohne erhalten.

Bis zu diesem Gerätetest ist die Auto-Delete-Logik **implementiert, aber nicht hardwareseitig bestätigt**.
