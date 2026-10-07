# PotensicProxy_TAF v0.973 - Landehilfe: einstellbare Feinheit

## Umsetzung

- Die Landehilfe besitzt jetzt einen eigenen, nicht selbstzentrierenden **Feinheit**-Regler.
- Standardwert: **15 %**.
- Einstellbereich: **10 % bis 25 %** des normalen virtuellen Joystickbereichs `-1000 .. +1000`.
- Der Prozentwert kann sowohl direkt im Zahlenfeld als auch über den Schieberegler geändert werden.
- Die Einstellung wird lokal unter `potensic-landing-assist-fine-percent` gespeichert und bleibt über WebUI-Neustarts erhalten.
- Der aktuell daraus berechnete Steuerbereich wird direkt angezeigt, z. B. `Steuerbereich ±150` bei 15 %.
- Throttle, Yaw, Pitch und Roll sind weiterhin selbstzentrierend und jetzt optisch als eigene Gruppe **Feinsteuerung** zusammengefasst.
- Der Feinheitsbereich ist visuell vom Block der vier Flugregler getrennt.
- Wird die Feinheit während eines aktiven Ausschlags reduziert, werden Werte außerhalb des neuen Bereichs sofort auf die neue Grenze begrenzt.
- Der bisherige Maximalbereich der Landehilfe wird nicht erhöht: 25 % entspricht weiterhin `±250`.
- Zielkreuz, Live-Foto und RTH-Verhalten bleiben unverändert.
- Version auf **0.973 / versionCode 46** angehoben.

## Prüfung

- `vue-tsc --noEmit`: erfolgreich.
- Der vollständige Vite-Bundle-Schritt konnte in der bereitgestellten Umgebung nicht abgeschlossen werden, weil die optionale native Rollup-Abhängigkeit `@rollup/rollup-linux-x64-gnu` im gelieferten `node_modules` fehlt.
- Das Projekt regeneriert die eingebettete WebUI beim regulären Android-`preBuild`; in der normalen Build-/CI-Umgebung müssen die vollständigen npm-Abhängigkeiten vorhanden sein.
