# Potensic_Atom_2 - UI Style Guide - Buttons, Regler und Statusfelder - v0.01

Stand: 2026-09-28

## Geltungsbereich

Dieser Style Guide gilt fuer die PotensicProxy-TAF WebUI. Die bestehende Kopf-/Statuszeile mit USB- und Passthrough-Status wird durch diese Aenderung nicht umgestaltet.

## 1. Buttons

### Standardbutton
- Hoehe: 36 px
- Radius: 6 px
- Horizontaler Innenabstand: 12 px
- Schrift: 11 px, 600
- Icon/Text-Abstand: 6 px
- Text und Icon immer zentriert

### Kompakt-/Toolbar-Button
- Hoehe: 32 px
- Radius: 6 px
- Horizontaler Innenabstand: 10 px
- Schrift: 10 px

### Semantik
- Primary: Cyan; primaere/technische Aktion
- Success: Gruen; positive/startende Aktion
- Secondary: dunkler neutraler Standardbutton
- Danger: Rot; kritische Aktion
- Toggle/Segment: gleiche Hoehe und gleiche Einzelbreite innerhalb einer Gruppe

### Segmented Controls
LIVE / MAP / PIP werden als ein zusammenhaengender Auswahlblock dargestellt. Alle Felder sind gleich hoch; aktive Auswahl wird mit Cyan hervorgehoben.

## 2. Regler

### Grundregel
Gimbal und Zoom verwenden dieselbe vertikale Einachsen-Regler-Geometrie und dieselbe Bedienlogik.

### Gimbal
- vertikaler Regler
- Bereich: -90 bis +30 Grad
- Presets: 0 Grad, -45 Grad, -90 Grad
- zusaetzliches Freifeld fuer benutzerdefinierten Winkel
- aktueller Wert als separates, festes Wertefeld

### Zoom
- vertikaler Regler
- Bereich: 1.00x bis 2.00x
- Presets: 1.0x, 1.5x, 2.0x
- zusaetzliches Freifeld fuer benutzerdefinierten Zoomfaktor
- aktueller Wert als separates, festes Wertefeld

### Gemeinsame Regler-Merkmale
- gleiche Reglerbreite und -hoehe
- gleiche Knopfgroesse
- gleiche Track-Breite
- gleiche Preset-Button-Hoehen
- gleiche Freifeld-Hoehen
- gleiche Farben und Abstaende

Die Regler bleiben bis zu einer spaeteren, separat bestaetigten Protokollanbindung reine UI-Vorschau. Durch diese Style-Aenderung werden keine Gimbal- oder Zoom-Kommandos an Drohne, Controller oder BX3 gesendet.

## 3. Statusfelder

### Allgemein
- Hoehe: 28 px
- Radius: 6 px
- horizontaler Innenabstand: 9 px
- Mono-Schrift: 9 px
- Inhalt zentriert
- feste Form; Zustandswechsel soll keine Layoutspruenge verursachen

### Farben
- Gruen: positiver/bereiter Zustand
- Gelb: Hinweis/Warnung/UI-only
- Rot: kritischer/Fehler-Zustand
- Dunkel/Grau: neutral/inaktiv

## 4. Zahlenwerte

Throttle/Yaw und Pitch/Roll verwenden tabellarische Ziffern und reservierte feste Zeichenbreiten. Dadurch bleibt die Beschriftung an derselben Position, unabhaengig davon, ob z. B. 0, 100 oder -1000 dargestellt wird.

## 5. Nicht Bestandteil dieser Aenderung

- keine Aenderung der bestehenden Header-Statuszeile
- keine Aenderung unbestaetigter oder experimenteller ATOM-/ATOM-2-Protokollzuordnungen
- keine neue Gimbal-/Zoom-Kommandouebertragung
- keine Aenderung bestehender Drohnenprotokollfunktionen
