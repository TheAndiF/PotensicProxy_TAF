# PotensicProxy_TAF - Auslieferungshinweis - Direkte Gimbal-Sticksteuerung

**Datum:** 2026-10-05  
**Version:** v0.971  
**Status:** umgesetzt, Quelltext statisch geprüft

## Inhalt

Der manuelle Gimbal-Regler wurde von der bisherigen Zielwinkel-Regelung auf eine direkte, selbstzentrierende Geschwindigkeitssteuerung umgestellt.

- Mitte = neutral / Gimbal-Achse 0
- oben = positive Gimbal-Achse bis +1000
- unten = negative Gimbal-Achse bis -1000
- Auslenkung = direkte proportionale Stellgröße
- Loslassen = sofort neutral und Regler zurück in die Mitte
- Send4AxisData bleibt im vorhandenen 80-ms-Achsenloop
- tatsächlicher Gimbalwinkel bleibt als Telemetrie-Istwert sichtbar
- Presets 0°, -45° und -90° bleiben unverändert

## Prüfung

`vue-tsc --noEmit` wurde erfolgreich ausgeführt.

Der Vite-Bundle-Schritt konnte in der bereitgestellten Linux-Umgebung nicht ausgeführt werden, weil im mitgelieferten `node_modules` die optionale Linux-Abhängigkeit `@rollup/rollup-linux-x64-gnu` fehlt. Das Projekt enthält bereits einen Android-`preBuild`-Schritt, der das WebUI in einer vollständigen Buildumgebung erneut erzeugt.
