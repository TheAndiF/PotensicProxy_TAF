# PotensicProxy_TAF – Nur Änderungen in Originalstruktur

**Datum:** 2026-09-29  
**Version:** v1.0  
**Status:** Entwurf / Auslieferungsstand  
**Dokumentenart:** Änderungsstruktur für Codepaket  
**Projekt:** PotensicProxy_TAF

## Zweck
Diese Datei dokumentiert ausschließlich die gegenüber dem bereitgestellten Ausgangspaket geänderten oder neu angelegten Dateien. Unveränderte Projektdateien werden nicht aufgeführt. Die Pfade entsprechen der ursprünglichen Projektstruktur.

## Nur geänderte bzw. neu angelegte Dateien

```text
PotensicProxy_TAF/
├── COMMIT_MESSAGE_SYSTEM_UI.txt
├── COMMIT_MESSAGE_UI_DETAIL_2026-09-29.txt
├── NUR_AENDERUNGEN_IN_ORIGINALSTRUKTUR_2026-09-29.md
├── README.md
├── README_AUDIT_2026-09-29.md
├── SYSTEM_UI_REORGANIZATION.md
├── UI_DETAIL_IMPLEMENTATION_2026-09-29.md
├── DOCUMENTATION/
│   ├── 2026-09-29_PotensicProxy_TAF_Projektdokumentation_UI-Detailaenderungen_v1.0.docx
│   └── 2026-09-29_PotensicProxy_TAF_Projektdokumentation_UI-Detailaenderungen_v1.0.pdf
├── app/
│   └── src/main/java/com/potensic/proxy/
│       ├── ProxyService.kt
│       └── WebServer.kt
└── webui/
    └── src/
        ├── components/
        │   ├── cockpit/
        │   │   ├── CockpitView.vue
        │   │   ├── GimbalControl.vue
        │   │   ├── MapView.vue
        │   │   ├── TelemetryBar.vue
        │   │   └── VideoPlayer.vue
        │   ├── debug/
        │   │   └── DebugConsoleView.vue
        │   └── header/
        │       └── HeaderBar.vue
        ├── composables/
        │   └── useUiTheme.ts
        ├── i18n/
        │   └── index.ts
        ├── protocol/
        │   └── PacketParser.ts
        ├── services/
        │   └── UsbTransportService.ts
        ├── stores/
        │   ├── useDebugStore.ts
        │   └── useDroneStore.ts
        ├── styles/
        │   └── tokens.css
        └── types/
            └── drone.ts
```

## Prüfung
Die Liste wurde durch einen Inhaltsvergleich des Ausgangspakets `PotensicProxy_TAF (2)(1).zip` mit dem überarbeiteten Projektpaket erzeugt. `.git/` und `webui/node_modules/` wurden bei der Ermittlung bewusst nicht als fachliche Änderungen gewertet. Im Ausgangspaket vorhandene, aber unveränderte Dateien werden nicht mitgeliefert.

## Änderungshistorie
| Version | Datum | Status | Änderung |
|---|---|---|---|
| v1.0 | 2026-09-29 | Entwurf / Auslieferungsstand | Erste vollständige Datei- und Ordnerstruktur der tatsächlich geänderten bzw. neu angelegten Dateien. |
