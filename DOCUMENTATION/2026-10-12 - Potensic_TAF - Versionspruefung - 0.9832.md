# PotensicProxy_TAF – Versionsprüfung 0.9832

Datum: 2026-10-12 | Status: Quellcode korrigiert, Web-Build offen

- Android: versionName **0.9832**, versionCode **57**.
- WebUI: package.json und package-lock.json **0.9832**.
- Pairing-Runtime-Quelle: **taf-pairing-runtime-v0.9832.js**.
- Historische Patches, Protokolle und deren Versionsangaben bleiben unverändert.
- **Wichtig:** `app/src/main/assets/web` enthält einen älteren generierten Web-Build. Dessen `BUILD_INFO.txt` nennt 0.980. Dies ist keine verifizierte WebUI 0.9832 und darf nicht als fertige APK ausgeliefert werden. Vor dem Release `webui` neu bauen, die eingebetteten Dateien ersetzen und `npm run verify:embedded` ausführen.
- Kein vollständiger Android-/Frontend-Build wurde in dieser Überarbeitung bestätigt.

Zum Release in der Projektwurzel: `cd webui && npm ci && npm run build && npm run verify:embedded` und anschließend Android Release-Build und Gerätetest ausführen. Bei vorhandener fehlerhafter nativer Rollup-Abhängigkeit Entwicklungsumgebung reparieren, nicht alte Assets umbenennen.
