# Hardware- und Funktionskompatibilität

Diese Matrix trennt **Softwarekonfiguration**, **fremde Testberichte** und **bestätigte Tests dieses TAF-Stands**. Eine implementierte Funktion darf nicht als auf jeder Hardware funktionsfähig bezeichnet werden.

| Kombination | AOA/USB | Video | Telemetrie | Flugsteuerung | Nachweis |
| --- | --- | --- | --- | --- | --- |
| ATOM / DSRC02A / Android mit nachgebautem USB-C-Kabel | Prototyp-Anmeldung berichtet | Kurzer Testflug mit Livebild im Kabelprojekt berichtet | Nicht separat belegt | Controller-Eingaben im Kabelprojekt berichtet | [Kabelprojekt](https://github.com/TheAndiF/Potensic-ATOM-USB-C-Replacement-Cable), **kein vollständiger TAF-Systemtest** |
| ATOM / Android / TAF-Profil `ATOM` | Im Code vorgesehen | H.264 1280×720 konfiguriert | Im Code vorgesehen | Im Code vorgesehen | TAF-Gerätetest offen |
| ATOM 2 / einfacher Deepsea-Controller / Pixel 9 Pro Fold (Android 15) | Im Upstream getestet | H.265 1920×1080 im Upstream berichtet | Im Upstream berichtet | Virtuelle Joysticks laut Upstream beim einfachen Controller eingeschränkt | [Upstream-README](https://github.com/sk7n4k3d/potensic-proxy), **nicht automatisch TAF-Test** |
| ATOM 2 / Android / TAF-Profil `ATOM_2` | Im Code vorgesehen | `w42`, 1920×1080, H.265 bevorzugt | Im Code vorgesehen | Implementiert, controllerabhängig | TAF-Gerätetest offen |
| ATOM SE / LT, andere Controller oder iOS | Nicht nachgewiesen | Nicht nachgewiesen | Nicht nachgewiesen | Nicht nachgewiesen | Offen |

## Wichtige Unterschiede

- **Physischer Controller-Stick:** Rückmeldung über gemessene Positionen ist nicht gleichbedeutend mit funktionierender **virtueller** Joystick-Steuerung.
- **USB-C-Kabel:** Das DIY-Projekt verwendet eine gerichtete, spezielle Beschaltung und ist kein universelles USB-C- oder Ladekabel. Eine ATOM-2-Kompatibilität des Prototyps ist nicht belegt.
- **WiFi Direct:** Vorhandener Code bedeutet nicht, dass die Fernsteuerung WLAN-Hardware besitzt oder der Pfad aktiviert werden kann.
- **RF:** Diagnosebefehle beweisen keine Reichweitensteigerung; Sendeleistungs-/Regelbereichsänderungen sind nicht als getestet oder zulässig dokumentiert.
- **Missionsplanung:** Planen, speichern und `map.db` exportieren sind nicht gleichbedeutend mit bestätigter autonomer Missionsausführung.

## Vorlage für neue Tests

Für jeden Test mindestens festhalten: Datum, TAF-Commit/Version, Drohnenmodell und Firmware, Controller-Typ/Revision, Smartphone und Android-Version, Kabeltyp/Revision, Verbindungsweg, geprüfte Funktion, Ergebnis, Log-/Video-Nachweis, Randbedingungen und bekannte Einschränkungen.

Erst bei reproduziertem Test mit dokumentiertem Nachweis den Status von „offen“ auf „getestet“ ändern.
