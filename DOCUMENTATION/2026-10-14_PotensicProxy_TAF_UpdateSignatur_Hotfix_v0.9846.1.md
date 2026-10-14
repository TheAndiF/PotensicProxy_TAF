# PotensicProxy_TAF – v0.9846.1

## Fehler
Android meldete `APK signing certificate differs from installed app`, obwohl installierte BA_-APK und heruntergeladenes Update dasselbe Signaturzertifikat besitzen.

## Aenderung
`UpdateManager.verifyPackage()` fragt `GET_SIGNING_CERTIFICATES` und `GET_SIGNATURES` an und nutzt die ermittelten APK-Zertifikate als SHA-256-Digests. Wenn moderne Archive-SigningInfo auf Android 10 nicht belegt ist, wird die vom Paketmanager bereitgestellte klassische Zertifikatssignatur verwendet. Fehlende Daten werden explizit diagnostiziert und blockieren die Installation. Signaturgleichheit bleibt Pflicht.

## Bestandsschutz
Keine Aenderungen an Drohnensteuerung, PStart, PLand, PPort, Webnavigation, Datenablage oder APK-Paketkennung; keine Deinstallation vorgesehen.

## Abnahme offen
GitHub-BA_-Build, Installationstest auf Android 10, Update 0.9846 -> 0.9846.1 bei unveraenderten Daten, Offline-/Abbruchtest und Sperre bei falschen Zertifikaten.

## Versionslogik
Aktive Version 0.9846.1, historische Dokumentationen seit 0.9845 bleiben erhalten.

## Projektregel
Ergaenzung zur Dateibenennung (ab 0.9846.1)
Verbindlich fuer alle zukuenftigen Projektlieferungen:
1. Keine Leerzeichen in neu erzeugten Lieferdateinamen.
2. Keine URL-Kodierungen (%20, _20) in Lieferdateinamen.
3. Schema: YYYY-MM-DD_PotensicProxy_TAF_Dokumenttyp_vVERSION.Dateiendung.
4. Betrifft Gesamtprojekt, Aenderungspaket, Release-PDF, Release-DOCX, Git-Patch und Commit-Datei.
5. Vorhandene Projektpfade und historische Namen nicht ohne technischen Grund umbenennen.
6. Ausgabe-Dateinamen vor Auslieferung automatisiert auf Leerzeichen und Kodierungen pruefen.
