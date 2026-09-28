# Potensic_Atom_2 - UI Style Guide - Zentrales WebUI-Stylesystem - v0.02

Stand: 2026-09-28

## Geltungsbereich

Dieser Style Guide gilt fuer die PotensicProxy-TAF WebUI. Ziel ist ein einheitlicher Aufbau der Weboberflaeche und eine zentrale Stelle fuer spaetere optische Aenderungen. Die Aenderung betrifft ausschliesslich Darstellung und UI-Struktur. Bestaetigte Protokollbereiche werden nicht veraendert oder neu interpretiert.

## 1. Stylesheet-Struktur

Der zentrale Einstiegspunkt ist `webui/src/styles/index.css`. Neue globale Styles werden nicht mehr gesammelt in einzelnen Vue-Komponenten angelegt, wenn sie projektweit wiederverwendbar sind.

- `styles/tokens.css`: Farben, Schriften, Abstaende, Radien, Hoehen und semantische Designwerte.
- `styles/base.css`: Grundlayout, Body, Typografie und Scrollbars.
- `styles/components.css`: wiederverwendbare Komponentenstile fuer Titel, Panels, Buttons, Statusfelder und Wertefelder sowie Element-Plus-Anpassungen.
- `styles/layout.css`: wiederverwendbare Layout-Hilfen fuer Seiten, Reihen, Stacks und Grids.
- `styles/index.css`: bindet die vier Stylesheet-Bereiche in definierter Reihenfolge ein.
- `style.css`: bleibt als Kompatibilitaets-Einstieg bestehen und importiert das neue Stylesystem.

`main.ts` bindet das zentrale Stylesystem direkt ueber `./styles/index.css` ein.

## 2. Design Tokens

Farben, Abstaende und Geometrie sollen fuer neue oder angepasste Komponenten nicht mehr unnoetig als Einzelwerte wiederholt werden. Stattdessen werden CSS-Variablen aus `tokens.css` verwendet.

Beispiele:

- `--ui-bg-app`, `--ui-bg-panel`, `--ui-bg-card`, `--ui-bg-control`
- `--ui-text`, `--ui-text-muted`, `--ui-text-subtle`
- `--ui-primary`, `--ui-success`, `--ui-warning`, `--ui-danger`
- `--ui-border`, `--ui-border-control`, `--ui-border-strong`
- `--ui-space-1` bis `--ui-space-9`
- `--ui-radius-xs` bis `--ui-radius-xl`
- `--ui-control-h`, `--ui-control-h-compact`, `--ui-status-h`

Die bisherigen Variablen wie `--cyan`, `--accent`, `--panel-bg`, `--border` und `--mono` bleiben vorerst als Kompatibilitaets-Aliase erhalten. Dadurch koennen bestehende Komponenten schrittweise migriert werden, ohne das aktuelle Layout auf einmal umzubauen.

## 3. Gemeinsame Grundelemente

### 3.1 Ueberschriften

Projektweit wiederkehrende Panel-Ueberschriften verwenden `.panel-title` oder `.ui-panel-title`. Die Darstellung wird zentral in `components.css` definiert.

### 3.2 Panels und Karten

Fuer neue UI-Bereiche stehen folgende Grundklassen bereit:

- `.ui-panel`: Hauptpanel mit einheitlichem Hintergrund, Rahmen und Radius.
- `.ui-card`: untergeordnetes Kartenfeld.
- `.ui-control-surface`: Eingabe-/Steuerflaeche.

### 3.3 Buttons

#### Standardbutton
- Hoehe: 36 px
- Radius: 6 px
- Horizontaler Innenabstand: 12 px
- Schrift: 11 px, 600
- Icon/Text-Abstand: 6 px
- Text und Icon zentriert

#### Kompakt-/Toolbar-Button
- Hoehe: 32 px
- Radius: 6 px
- Horizontaler Innenabstand: 10 px
- Schrift: 10 px

#### Semantik
- Primary: Cyan; primaere/technische Aktion
- Success: Gruen; positive/startende Aktion
- Secondary: dunkler neutraler Standardbutton
- Danger: Rot; kritische Aktion
- Toggle/Segment: gleiche Hoehe und gleiche Einzelbreite innerhalb einer Gruppe

### 3.4 Statusfelder

- Hoehe: 28 px
- Radius: 6 px
- horizontaler Innenabstand: 9 px
- Mono-Schrift: 9 px
- feste Form; Zustandswechsel soll keine Layoutspruenge verursachen
- Status wird nicht ausschliesslich ueber Farbe vermittelt; Text oder Symbol bleibt zusaetzlich sichtbar.

### 3.5 Zahlenwerte

Steuer- und Telemetriewerte verwenden vorzugsweise tabellarische Ziffern und reservierte Breiten. Damit bleiben Beschriftungen bei wechselnden Zahlenwerten stabil.

## 4. Layout-Hilfen

Neue Ansichten sollen bevorzugt die gemeinsamen Layoutklassen verwenden:

- `.ui-page`
- `.ui-stack`
- `.ui-row`
- `.ui-grid-2`
- `.ui-toolbar`

Diese Klassen dienen als gemeinsame Basis. Komponenten duerfen weiterhin lokale Layoutregeln besitzen, wenn diese fachlich spezifisch sind.

## 5. Element Plus

Element Plus wird im Dark Mode ueber zentrale CSS-Variablen an die WebUI-Farben und Radien angeglichen. Dadurch verwenden Standardfelder, Dialoge und Bedienelemente die gleiche Grundsprache wie die eigenen TAF-Komponenten.

## 6. Cockpit-spezifische Regeln

Gimbal und Zoom verwenden dieselbe vertikale Einachsen-Regler-Geometrie und dieselbe Bedienlogik. LIVE / MAP / PIP werden als zusammenhaengender Auswahlblock dargestellt. Joystick-, Gimbal-, Video- und Telemetriekomponenten sollen gemeinsame Farben, Radien und Rahmen aus den Design Tokens beziehen.

Die Regler bleiben bis zu einer spaeteren, separat bestaetigten Protokollanbindung reine UI-Vorschau, soweit sie nicht bereits an bestaetigte Funktionen gekoppelt sind. Durch diese Style-Aenderung werden keine neuen Gimbal- oder Zoom-Kommandos an Drohne, Controller oder BX3 eingefuehrt.

## 7. Vorgehen bei spaeteren Aenderungen

1. Zuerst pruefen, ob die gewuenschte Aenderung ueber einen Token in `tokens.css` geloest werden kann.
2. Wiederkehrende UI-Elemente in `components.css` aendern oder dort als gemeinsame Klasse ergaenzen.
3. Allgemeine Seiten-/Grid-Strukturen in `layout.css` pflegen.
4. Nur fachlich spezifische Darstellung im `<style scoped>` der Vue-Komponente belassen.
5. Keine bestaetigten Protokoll- oder Steuerfunktionen im Rahmen einer reinen Style-Aenderung veraendern.

Damit koennen z. B. Hintergrundfarben, Panelrahmen, Abstaende, Radien, Buttonhoehen oder Statusfarben kuenftig an einer zentralen Stelle geaendert werden.

## 8. Nicht Bestandteil dieser Aenderung

- keine neue oder geaenderte Potensic-Protokollinterpretation
- keine Aenderung der FE-Videoextraktion
- keine Aenderung der bestaetigten F1-F5-Steuerlogik
- keine neue Gimbal-/Zoom-Kommandouebertragung
- keine funktionale Aenderung von USB/AOA, BX3, Capture oder Telemetrie
