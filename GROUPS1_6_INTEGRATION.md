# PotensicProxy_TAF – Integration der Funktionslücken 1–6

Stand: 2026-09-28

Basis: `PotensicProxy_TAF_Group2_CameraMedia`, abgeglichen gegen den dekompilierten Quell-/Ressourcenstand von `PotensicPro(1)`.

## 1. Erweiterte Kameraeinstellungen

Ergänzt auf dem bestätigten PotensicPro-Kamerapfad `FE 0x15 -> FF FD -> message 0x0020`:

- manueller/automatischer Belichtungsmodus (`0x34/0x35` bzw. 52/53)
- Shutter-Denominator
- ISO
- manueller Weißabgleich und Kelvin-Wert
- RAW (`0x24` / 36)
- Photo OSD (`0x26` / 38)
- Photo GPS (`0x3B/0x3C` / 59/60)
- bestehende Auflösung/EV/SD/Galerie-Funktionen bleiben erhalten

## 2. Telemetrie- und Statusauswertung

Der ATOM-Parser wurde anhand der PotensicPro-Parser erweitert:

- `0x0000` FlightInfo: Distanz, Vertikal-/Horizontalgeschwindigkeit, Akku %, Restflugzeit, Pitch/Roll, Wind, GPS-UTC, Höhe, TOF-Höhe
- `0x0002` FlightState: Flug-/RTH-/Landing-/Takeoff-/Smart-Mode-/RC-/GPS-/Warnstatus
- `0x0003` FlightSettings: Höhenlimit, Distanzlimit, RTH-Höhe, Beginner-/Stick-/Circle-/Speed-Parameter
- `0x001A` GimbalSettings: aktuelle Gimbalparameter als sichere Grundlage für Kalibrierbefehle
- `0x001E` NoFlyZone: Zone/Nähe/Restriktionsflags, Höhenlimit und Distanz

Die bestehenden bestätigten `0x0001` Battery- und `0x0005` Home-Point-Parser bleiben erhalten.

## 3. RTH/Home-/Flugparameter

Ergänzt wurde der PotensicPro-New-FC-Pfad `functionCode 3` mit 13-Byte-Payload:

- Höhenlimit
- Distanzlimit
- RTH-Höhe
- Beginner Mode
- American/alternate stick mode
- Circle radius/direction/speed
- Speed Mode

Die WebUI schreibt diese Werte erst, nachdem ein gültiger `0x0003`-Datensatz empfangen wurde, damit unbekannte Werte nicht überschrieben werden. Home-Point-Koordinaten werden aus dem bestätigten `0x0005`-Datensatz angezeigt.

## 4. RC-/Gimbal-/Kompass-/IMU-Kalibrierung

- RC calibration: PotensicPro remoter `function 113`, Start `0xA0` (`FlightConfig.P1_SELF`), Stop `0xF0`, FE remoter path `0x17`, inner marker `FF FE`.
- Gimbal calibration: aktueller `0x001A`-Gimbalzustand wird zuerst synchronisiert; danach wird `function 26` mit `gimbalCalibration=1` und den bestehenden übrigen Gimbalwerten gesendet.
- IMU calibration: PotensicPro General Command `function 27`, command `6`, param `1/0`.
- Compass calibration: bestätigtes Enter/Quit-Telegramm `function 24`, Payload `1/2` ist integriert.

**Wichtige Grenze:** PotensicPro berechnet die eigentliche Magnetometer-Kalibrierlösung mit nativen JNI-Funktionen (`JniUtils.startCalibration` / `magCalibration`) und sendet anschließend Ergebnisse. Diese native Solver-Implementierung liegt im dekompilierten Java-Code nicht vor. TAF bildet deshalb bewusst nur den bestätigten Enter/Quit-Mechanismus ab und erfindet keine Kalibrierparameter.

## 5. Intelligente Flugmodi

Ergänzt anhand `SendCtrlData` / `CtrlType`:

- Follow (`command 7`)
- Circle (`command 6`)
- Point Fly (`command 5`)
- Cancel Auto Fly (`command 99`)
- MultiPoint route upload über `function 6`, Lat/Lon als `int32 * 1e7`

Die WebUI akzeptiert Wegpunkte zeilenweise als `latitude,longitude`.

## 6. No-Fly / Geofence / Find My Drone

- Live-No-Fly-Status aus `0x001E` wird ausgewertet und angezeigt.
- Zusätzlich bleibt `flightInNoFlyZone` aus `0x0002` sichtbar.
- Höhen-/Distanz-Geofenceparameter sind über die Flight-Settings integriert.
- Find My Drone zeigt aktuelle Drohnen- und Home-Koordinaten.
- Find-My-Drone-Beep verwendet den PotensicPro General Command `2`, Param `2/0`.

**Zone-Geometrien:** PotensicPro lädt/verwaltet separate Karten-Zonendaten (u. a. ein regionales `CN.json` und Updatepfade). Diese Daten sind nicht Teil des Flugprotokolls und sind nicht als weltweit gültige, aktuelle Quelle belegbar. Deshalb wurden sie nicht blind in TAF kopiert. Die vom Fluggerät gemeldeten Geofence-/No-Fly-Zustände sind hingegen integriert.

## Validierung

- `npx vue-tsc --noEmit`: **erfolgreich**.
- Vollständiger Android/Gradle-Build: in der isolierten Prüfungsumgebung nicht ausführbar, weil der Wrapper Gradle 8.11.1 aus `services.gradle.org` laden müsste und dort kein Netzwerkzugriff besteht.
- Reale Hardwaretests mit Controller/Drohne sind weiterhin erforderlich, insbesondere vor Flugtests von Smart Modes, Limits und Kalibrierungen.
