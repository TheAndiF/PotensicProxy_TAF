# PotensicProxy_TAF - Auslieferungshinweis - Precision Start v1 Buildfix - v0.977

Datum: 2026-10-08  
Status: Implementiert - Buildfix  
App-Version: 0.977  
versionCode: 50

## Anlass

Der hochgeladene GitHub-Actions-Log `logs_102382585082.zip` zeigt, dass der WebUI-Build erfolgreich abgeschlossen wurde. Der Android-Build erreichte `:app:compileDebugKotlin` und brach an einer konkreten Kotlin-Fehlerstelle ab:

`AndroidMediaRepository.kt:301:22 Unresolved reference 'setLatLong'`

Ursache war die Verwendung von `setLatLong()` auf `android.media.ExifInterface`.

## Korrektur

Die GPS-Schreiblogik verwendet in v0.977 keine `setLatLong()`-Methode mehr. Stattdessen werden die standardisierten EXIF-GPS-Tags direkt gesetzt:

- `GPSLatitudeRef`
- `GPSLatitude`
- `GPSLongitudeRef`
- `GPSLongitude`

Latitude und Longitude werden dafür in EXIF-konforme DMS-Rationalwerte umgerechnet. XMP und der übrige PStart-Datensatz bleiben unverändert.

## Prüfungen

- Aufruf `.setLatLong(...)` aus dem Quellcode entfernt.
- DMS-Konvertierung mit Kotlin-Testwerten erfolgreich geprüft.
- `vue-tsc --noEmit` für WebUI v0.977 erfolgreich.
- Der hochgeladene CI-Lauf hatte `npm ci`, `vue-tsc` und `vite build` bereits erfolgreich ausgeführt.
- Vollständiger Android/Gradle-Build kann in der aktuellen Offline-Arbeitsumgebung nicht erneut ausgeführt werden, weil Gradle/Android-Abhängigkeiten nicht heruntergeladen werden können. Die im CI protokollierte konkrete Kotlin-Fehlerstelle wurde beseitigt.

## Geänderte Quell-/Versionsdateien

- `app/build.gradle.kts`
- `app/src/main/java/com/potensic/proxy/AndroidMediaRepository.kt`
- `webui/package.json`
- `webui/package-lock.json`

## Dokumentation

- `DOCUMENTATION/2026-10-08 - PotensicProxy_TAF - Projektdokumentation - Precision-Start-v1-Buildfix - v0.977.pdf`
- `DOCUMENTATION/2026-10-08 - PotensicProxy_TAF - Projektdokumentation - Precision-Start-v1-Buildfix - v0.977.docx`

Die vorhandene PStart-v1-Funktionalität bleibt fachlich unverändert. Dieser Stand ist ein gezielter Buildfix für die EXIF-GPS-Integration.
