# PotensicProxy_TAF - Auslieferungshinweis - Precision Start v1 - v0.976

**Datum:** 2026-10-08  
**Version:** 0.976 / versionCode 49  
**Status:** Implementiert - Teststand

## Inhalt der Auslieferung

Die Auslieferung implementiert die gemeinsam festgelegte erste Version von Precision Start (PStart). PLanding ist als sichtbare, ausgegraute und deaktivierte Schaltfläche vorbereitet, enthält aber noch keine Landelogik.

PStart beginnt mit Schritt 0 (Prüfung + Dokumentation). Die Voraussetzungprüfung hat ein Zeitlimit von 10 Sekunden. Nach erfolgreicher Prüfung werden zwei Dokumentationsbilder (1,00x und Max-Zoom) mit eingebettetem Datensatz erstellt; diese Bilder sind ausdrücklich nicht als PLanding-Referenz freigegeben. Danach wird die bestehende normale Takeoff-Funktion unverändert aufgerufen.

Nach stabilem Schwebeflug wird die erste echte Referenzhöhe bei Schwebehöhe + 0,10 m angeflogen. Anschließend folgen die von 0 m berechneten Rasterhöhen bis zur konfigurierten Endhöhe. PStart Version 1 greift nur über Throttle in die vertikale Bewegung ein; automatische Pitch-/Roll-/Yaw- oder GPS-/Heading-Regelung ist bewusst nicht enthalten. PStart senkt nicht ab, um eine Rasterhöhe zu erreichen.

An jedem Referenzpunkt gilt: Throttle Neutralstellung -> Gimbal-Preset -90° -> Istwert prüfen -> bei Bedarf genau ein zweiter Preset-Versuch -> Stabilisierung -> Bild 1 ohne Digitalzoom (1,00x) -> Bild 2 mit maximal gemeldetem Zoom. Jedes Bild erhält einen eigenen Telemetriesnapshot.

Die PStart-Bilddaten werden nach dem Ablauf **Bild aufnehmen -> Datensatz erstellen -> EXIF/XMP schreiben -> Datei finalisieren -> SHA-256 prüfen** gespeichert. Standardisierte Angaben (Zeit, Software, gültige GPS-Koordinaten) werden in EXIF geschrieben; der vollständige PStart-Datensatz wird als XMP-Payload in das JPEG eingebettet. Damit bleiben Bild und vollständige Flugdaten zusammen.

PStart kann jederzeit durch erneutes Drücken der blinkenden PStart-Taste oder durch manuellen Steuereingriff beendet werden. Ein manueller Abbruch neutralisiert die PStart-Achsbefehle und übergibt an den normalen Schwebeflug/Piloten. Jeder Abbruch zeigt und protokolliert einen konkreten Grund.

## Einstellungen

Unter **System -> PStart** stehen zur Verfügung:

- Endhöhe (Standard 20 m)
- Höhenstaffelung (Standard 5 m)
- Stabilisierungszeit (Standard 2 s)

## Beispiel 20 m / 5 m Raster

Bei stabiler Schwebehöhe 1,80 m entstehen die Punkte Schritt 0, 1,90 m, 5 m, 10 m, 15 m und 20 m. Mit zwei Bildern je Punkt entstehen insgesamt **12 Bilder**: 2 Dokumentationsbilder und 10 echte Referenzbilder.

## Prüfstatus

- `vue-tsc --noEmit`: erfolgreich.
- Vite-Bundle in dieser Linux-Arbeitsumgebung nicht ausführbar: im gelieferten `node_modules` fehlt die Linux-Rollup-Nativkomponente `@rollup/rollup-linux-x64-gnu`; vorhanden sind Windows-Pakete.
- Android/Kotlin-Kompilierung in dieser Arbeitsumgebung nicht ausführbar: der Gradle-Wrapper müsste Gradle 8.11.1 aus dem Internet laden, Netzwerkzugriff steht hier nicht zur Verfügung.
- Hardware-/Flugtest ist vor Einsatz zwingend erforderlich, insbesondere für Throttle-Werte/Höhenüberschwingen, Gimbal-ACK/Timeout, Zoom-ACK, Hardware-RC-Erkennung sowie EXIF/XMP-Ausgabe auf dem Zielgerät.

## Auslieferungsdateien

- vollständiges Codepaket v0.976
- Änderungspaket in Originalstruktur
- Patch-Datei
- Projektdokumentation als PDF und DOCX
- englische Commit-Nachricht
