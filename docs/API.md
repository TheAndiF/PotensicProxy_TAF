# HTTP- und WebSocket-API (Quellcode-Übersicht)

Diese Übersicht ist aus `app/src/main/java/com/potensic/proxy/WebServer.kt` und den `api/*Routes.kt`-Dateien abgeleitet. Sie ist **keine vollständige Spezifikation** sämtlicher Payload-Felder und keine Aussage zur Gerätekompatibilität. Standardmäßig lauscht der Hauptserver auf Port **9090** an allen Netzwerkschnittstellen.

## Status und Diagnose

| Methode | Pfad | Funktion |
| --- | --- | --- |
| GET | `/` | Weboberfläche |
| GET | `/api/status` | USB-/Verbindungsstatus und Statistiken |
| GET | `/api/telemetry` | Telemetrie-Zustand |
| GET | `/api/state` | Anwendungszustand |
| GET | `/api/control/state` | Steuerungszustand |
| GET | `/api/diagnostics` | Aggregierte Diagnostik und Zähler |
| GET | `/api/logs` | Logdaten |
| GET | `/api/version` | Versionsinformationen |

## Video und Medien

| Methode | Pfad | Funktion |
| --- | --- | --- |
| GET | `/api/video/h265` | Rohvideostream |
| GET | `/api/video/h264` | Weiterleitung zum H.265-Endpunkt im aktuellen Code |
| GET | `/api/video/mjpeg` | MJPEG-Stream |
| GET | `/api/video/snapshot` | Einzelbild |
| GET | `/api/video/stats` | Videostatistiken |
| POST | `/api/video/activate` | Livevideo aktivieren |
| POST | `/api/video/request-idr` | IDR-Keyframe anfordern |
| GET | `/api/media/local` | Lokale Medienliste |
| POST | `/api/media/snapshot` | Snapshot sichern |

## Controller, Verbindung und Funkdiagnose

| Methode | Pfad | Funktion |
| --- | --- | --- |
| POST | `/api/connect` | USB-Verbindung aufbauen |
| POST | `/api/disconnect` | Verbindung trennen |
| POST | `/api/cmd/takeoff` | Startbefehl |
| POST | `/api/cmd/land` | Landebefehl |
| POST | `/api/cmd/rth` | Return-to-Home |
| POST | `/api/cmd/emergency` | Notfallbefehl |
| POST | `/api/cmd/photo` | Foto auslösen |
| POST | `/api/cmd/record` | Videoaufnahme steuern |
| POST | `/api/cmd/pair` | Pairing-Befehl |
| POST | `/api/rf/probe` | RF-Parameter-Probe |
| POST | `/api/usb/send` | USB-Daten senden |
| POST | `/api/cmd/raw/{hex}` | Rohbefehl senden |
| POST | `/api/wifi/activate` | WiFi-Direct-Umschaltbefehl |
| POST | `/api/wifi/scan` | BLE-Scan starten |
| POST | `/api/wifi/connect` | WLAN-Verbindung starten |
| GET | `/api/wifi/status` | WLAN-/BLE-Status |

## Missionen, Karten und Updates

| Methode | Pfad | Funktion |
| --- | --- | --- |
| GET | `/api/missions` | Missionen auflisten |
| GET | `/api/missions/{id}` | Mission abrufen |
| PUT | `/api/missions/{id}` | Mission speichern |
| DELETE | `/api/missions/{id}` | Mission löschen |
| GET | `/api/missions/{id}/export/potensic` | Potensic-Export |
| GET | `/api/map/config` | Kartenkonfiguration |
| POST | `/api/map/config` | Kartenkonfiguration speichern |
| GET | `/api/map/regions` | Offline-Regionen |
| GET | `/api/updates/status` | Update-Status |
| GET | `/api/updates/check` | Updates prüfen |
| POST | `/api/updates/download` | Update herunterladen |
| POST | `/api/updates/install` | Updateinstallation anfordern |

## WebSockets

| Pfad | Zweck |
| --- | --- |
| `/ws/usb` | USB-Pakete / Überwachung |
| `/ws/video` | Videodaten |
| `/ws/control` | Steuerungs- und Statuskommunikation |

## Sicherheit

**Die API ist kein öffentlicher Fernsteuerungsdienst.** Steuernde und administrative Endpunkte können physische Aktionen oder Änderungen auslösen. Authentifizierung, Autorisierung und Netzexposition müssen vor Remote-Zugriff gesondert auditiert werden. Für Flugbefehle gelten zusätzliche Hardware-, Verbindungs- und Sicherheitsprüfungen. Roh-, RF- und Debug-Kommandos nicht unkontrolliert ausführen.

Weitere Endpunkte sind insbesondere in `WebServer.kt` und den separaten Routenklassen implementiert. Beim Ändern von Payloads oder Routen diese Übersicht anhand des Codes aktualisieren.
