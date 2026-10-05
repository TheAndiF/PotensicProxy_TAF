# PotensicProxy_TAF - Auslieferungshinweis - AOA-Notification-Reconnect-und-Beenden - v0.970

Datum: 2026-10-05  
Status: umgesetzt, statisch geprüft; vollständiger Android-Build in dieser Umgebung nicht möglich.

## Inhalt

Die bestehende Foreground-Benachrichtigung **Potensic Proxy** erhält zwei Aktionen:

- **AOA neu verbinden**: trennt nur die eigene USB/AOA-Verbindung und startet danach den vollständigen eigenen Verbindungsaufbau erneut.
- **Beenden**: beendet den Foreground-Service sauber und gibt die von PotensicProxy_TAF gehaltenen Ressourcen frei.

Android entscheidet weiterhin über USB-Berechtigung und Gerätezuordnung. Die Aktion kann eine konkurrierende App nicht zwangsweise vom Accessory trennen.

## Versionsstand

- Software: 0.970
- Android versionCode: 43

## Build-Hinweis

Der Gradle-Build konnte in der isolierten Umgebung nicht abgeschlossen werden, da die Gradle-Distribution 8.11.1 nicht lokal vorhanden war und kein Netzwerkzugriff für den Download zur Verfügung stand. Der WebUI-Build scheiterte zusätzlich an dem im Archiv fehlenden optionalen Rollup-Linux-Binary. XML-Ressourcen wurden erfolgreich geparst und die geänderten Quellstellen statisch geprüft.
