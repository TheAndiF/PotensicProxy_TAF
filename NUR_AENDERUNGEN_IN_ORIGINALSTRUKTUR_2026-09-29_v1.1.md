# PotensicProxy_TAF - Nur Änderungen in Originalstruktur

Version: v1.1  
Datum: 2026-09-29  
Status: Entwurf

Dieses Verzeichnisbild enthält ausschließlich die in diesem Änderungsschritt geänderten oder neu benötigten Dateien. Die Pfade entsprechen der Originalstruktur des Projekts; der Root-Ordner bleibt `PotensicProxy_TAF`.

```text
PotensicProxy_TAF/
├── README.md
├── README_AUDIT_2026-09-29.md
├── UI_DETAIL_IMPLEMENTATION_2026-09-29.md
├── COMMIT_MESSAGE_CAMERA_LAYOUT_2026-09-29.txt
├── NUR_AENDERUNGEN_IN_ORIGINALSTRUKTUR_2026-09-29_v1.1.md
├── PATCH_UI_CAMERA_LAYOUT_v1.1.patch
├── DOCUMENTATION/
│   ├── 2026-09-29_PotensicProxy_TAF_Projektdokumentation_UI-Detailaenderungen_v1.1.docx
│   └── 2026-09-29_PotensicProxy_TAF_Projektdokumentation_UI-Detailaenderungen_v1.1.pdf
└── webui/
    └── src/
        └── components/
            └── cockpit/
                ├── CameraMediaPanel.vue
                ├── CockpitView.vue
                └── GimbalControl.vue
```

## Inhaltliche Änderung

- `Camera Control` ist dauerhaft sichtbar und steht als nächster benannter Bedienbereich direkt unter `Joystick Control`.
- Gimbal und Zoom verwenden dasselbe vertikale Bedienkonzept.
- Der zusätzliche horizontale Zoom-Slider wurde entfernt.
- Der Bereich `Camera` enthält nur noch die erweiterten Kameraeinstellungen und ist separat ein-/ausklappbar.
- Das kleine Vorschaufenster bleibt unterhalb des Camera-Bereichs.
- README und technische UI-Dokumentation wurden an die korrigierte Anordnung angepasst.
- Nicht bestätigte Protokollbereiche wurden nicht verändert.

## Abgrenzung

Nicht aufgeführte Dateien sind gegenüber dem Ausgangspaket `PotensicProxy_TAF_UI-Detailaenderungen_v1.0.zip` in diesem Änderungsschritt unverändert.
