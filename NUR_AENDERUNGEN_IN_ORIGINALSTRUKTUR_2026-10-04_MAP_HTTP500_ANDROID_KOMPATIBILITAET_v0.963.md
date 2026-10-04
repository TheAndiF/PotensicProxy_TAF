# Nur Änderungen in Originalstruktur - Map HTTP-500 / Android-Kompatibilität v0.963

Datum: 2026-10-04

## Anlass

Nach der v0.962-Korrektur ist das lokale Karten-Backend über die WebUI wieder erreichbar. Der neue Laufzeittest zeigt nun `HTTP 500` bei `POST /api/map/test`. Damit ist die vorherige Netzwerk-/Same-Origin-Störung überwunden; der Fehler entsteht jetzt innerhalb des Android-Backends beziehungsweise im Provider-Request-Pfad.

Im Karten-Backend wurde die Provider-Antwort bisher mit `InputStream.readNBytes(Int)` gelesen. Die Anwendung unterstützt Android ab `minSdk = 26`. Diese API steht nicht auf allen von der Anwendung unterstützten Android-Versionen zur Verfügung und kann auf betroffenen Geräten als Laufzeit-/Linkage-Fehler auftreten. Ein solcher Fehler wurde vom bisherigen `catch (Exception)` nicht erfasst und konnte deshalb als undiagnostizierter Ktor-HTTP-500 bis zur WebUI durchlaufen.

## Änderungen

- `app/src/main/java/com/potensic/proxy/MapBackend.kt`
  - `InputStream.readNBytes(Int)` entfernt.
  - API-26-kompatiblen, begrenzten Stream-Reader mit `InputStream.read(...)` und `ByteArrayOutputStream` ergänzt.
  - Bestehende Größenlimits bleiben erhalten; eine zusätzliche Sentinel-Byte-Prüfung erkennt zu große Antworten ohne unbeschränktes Puffern.
  - `HttpURLConnection.disconnect()` wird in `finally` ausgeführt.
  - Provider-HTTP-Fehler sowie Transport-/Runtimefehler werden in das bestehende Systemlog geschrieben.
  - Provider-Fehlermeldungen werden vor der Ausgabe gegen den konfigurierten Token bereinigt.
  - Der HTTP-`User-Agent` verwendet jetzt die tatsächliche Backend-Version statt des alten festen Werts `0.5`.
  - `LinkageError` wird im Provider-Pfad gesondert abgefangen, damit ein vergleichbarer Android-Laufzeitfehler als reguläres Testergebnis sichtbar wird.

- `app/src/main/java/com/potensic/proxy/WebServer.kt`
  - `POST /api/map/test` unterscheidet ungültige Eingaben (`HTTP 400`) von unerwarteten Backendfehlern (`HTTP 500`).
  - Unerwartete `Exception`- und `LinkageError`-Fehler werden in das Systemlog geschrieben und als JSON-Fehler an die WebUI geliefert.

- Versionsstand
  - Android/WebUI: `0.963`
  - Android `versionCode`: `36`
  - Map API: `2` unverändert
  - Build-Datum: `2026-10-04`

## Nicht geändert

- Kein Eingriff in USB/BX3, Flugsteuerung, Kamera, LiveView oder Telemetrie.
- Keine Änderung an den Mapbox-Provider-URLs oder am Token-Speichermodell.
- Keine Änderung am Same-Origin-Routing aus v0.962.
- Keine Erweiterung des Map-API-Schemas.

## Erwartetes Verhalten nach Installation

1. Die WebUI bleibt unter `http://<Android-IP>:9090` erreichbar.
2. `Test connection` erreicht `POST /api/map/test` ohne undiagnostizierten Laufzeitfehler durch `readNBytes`.
3. Bei erfolgreichem Mapbox-Zugriff wird der bestehende Erfolgsstatus angezeigt.
4. Bei einem Provider-/Tokenproblem wird ein konkreter Providerstatus wie `401`, `403`, `404` oder `429` angezeigt.
5. Bei DNS-, TLS-, Timeout- oder vergleichbaren Transportproblemen wird `HTTP -` zusammen mit der konkreten Fehlerklasse/-meldung im Testergebnis angezeigt.
6. Vergleichbare Backend-Runtimefehler werden zusätzlich im Live-Systemlog sichtbar und nicht mehr nur als generisches `HTTP 500` verschluckt.

## Validierung

- `git diff --check`: fehlerfrei.
- `vue-tsc --noEmit`: fehlerfrei.
- Quellprüfung: Im produktiven Karten-Backend existiert kein ausführbarer Aufruf von `readNBytes` mehr; der Begriff kommt nur noch in der erklärenden Kompatibilitäts-Dokumentation vor.
- Der neue begrenzte Reader wurde separat mit Kotlin/JVM 1.8 kompiliert und gegen Normalfall, exaktes Größenlimit, Überlauf und leeren Stream geprüft; alle Tests erfolgreich.
- Die Vite-Produktionserzeugung kann in der isolierten Linux-Umgebung mit dem gelieferten `node_modules` nicht abgeschlossen werden, weil nur die Windows-Rollup-Nativabhängigkeit vorhanden ist (`@rollup/rollup-linux-x64-gnu` fehlt). `vue-tsc` selbst ist erfolgreich.
- `:app:compileDebugKotlin` wurde über den Gradle-Wrapper angestoßen; die Umgebung besitzt die Gradle-8.11.1-Distribution nicht lokal und darf `services.gradle.org` nicht auflösen. Der Wrapper stoppt deshalb vor dem eigentlichen Projekt-Build mit `UnknownHostException`.
- Der abschließende Android-/Geräte-/CI-Test bleibt Bestandteil der Abnahme.
