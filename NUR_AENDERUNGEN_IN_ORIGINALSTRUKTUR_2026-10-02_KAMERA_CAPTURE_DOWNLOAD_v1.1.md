# PotensicProxy_TAF - Nur Änderungen in Originalstruktur - Kamera Capture/Download - v1.1

Datum: 2026-10-02  
Status: Software umgesetzt; reale Geräteabnahme erforderlich.

Enthalten sind ausschließlich die gegenüber der vorherigen Kamera-/Galerie-Auslieferung geänderten oder neu erzeugten Dateien in ihrer ursprünglichen Projektstruktur.

## Kernkorrekturen

- Foto/Video-Capture: `0x1200/0x51` bzw. `0x1200/0x50`.
- Vor Capture wird ein aktiver Galerie-/Playback-Modus mit `0x0020/0x22` verlassen.
- Cockpit: direkter Button `Video Start/Stopp`.
- Galerie: Zeitstempelanzeige, soweit aus dem Dateinamen eindeutig ableitbar.
- Download `0x1B`: 32-KiB-Blöcke, 64-/16-Bit-Längenparser, Timeout/Retry, Duplicate-Handling, dezimaler Fortschritt und Folgeblockanforderung bis Dateiende.
- Settings/Galerie/Medientransfer verbleiben auf `0x0020`.

## Prüfung

`node node_modules/vue-tsc/bin/vue-tsc.js --noEmit` wurde ohne Fehler ausgeführt.
Der Vite-Build kann in der Linux-Prüfumgebung nicht gestartet werden, weil das gelieferte `node_modules/@rollup` nur Windows-Native-Pakete enthält. Auf der vorgesehenen Windows-Entwicklungsumgebung installiert `npm ci` die passende Plattformabhängigkeit vor dem Build.
