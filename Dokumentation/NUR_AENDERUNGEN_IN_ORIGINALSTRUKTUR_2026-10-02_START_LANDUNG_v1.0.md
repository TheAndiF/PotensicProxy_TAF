# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Start/Landung SendCtrlData - v1.0

Datum: 2026-10-02
Status: Umgesetzt / geprüft

## Inhalt
Dieses Paket enthält ausschließlich die für den Änderungsauftrag Start/Landung geänderten oder neu angelegten Dateien in ihrer ursprünglichen Projektstruktur. Der Root-Ordner bleibt `PotensicProxy_TAF`.

## Kernänderungen
- Takeoff: SendCtrlData Function 0x0014, command 3, result_param2 0.
- Land: SendCtrlData Function 0x0014, command 4, result_param2 0x55.
- Cancel Land: command 4, result_param2 0xAA.
- RTH: command 8, result_param2 0.
- Cancel Auto Fly: command 99, result_param2 0.
- Keine automatische 20x/50-ms-Wiederholung für diese SendCtrlData-Aktionen.
- Zustandsabhängige UI mit Startbestätigung und Cancel Land bei aktivem Landing-State.
- Engineering-Logging der vollständigen Sollbytes vor dem Senden.

## Verifikation
- Vue/TypeScript Typprüfung (`vue-tsc --noEmit`): bestanden.
- Quellcode-/Byteprüfung gegen Änderungsauftrag: bestanden.
- Vite-Bundle: nicht vollständig ausführbar, weil im gelieferten `node_modules` die Linux-Rollup-Optionaldependency fehlt und die isolierte Umgebung keine Nachinstallation zuließ.
- Android/Kotlin Gradle: nicht ausführbar, weil der Gradle-Wrapper die Distribution aus dem Internet laden müsste und die Umgebung keinen externen Netzwerkzugriff hat.

Die fehlenden Build-Schritte sind Umgebungsgrenzen und keine als bestanden markierten Tests.
