# Zentrale Versionsverwaltung – PotensicProxy_TAF

**Zentrale Vorgabe:** `config/versions.json`.

Die in dieser Datei hinterlegten Versionen entsprechen dem gelieferten, zuvor erfolgreichen BA-Build. Insbesondere bleibt **Vite 6.4.3** als im Lockfile aufgelöste Version bestehen; ein Wechsel auf Vite 8 ist **nicht** Teil dieser Änderung.

## Anwenden und prüfen

```bash
python3 scripts/sync_versions.py
python3 scripts/sync_versions.py --check
cd webui
npm ci --include=optional --no-audit --no-fund
npm run verify:source
```

Die Synchronisierung aktualisiert `webui/package.json`, dessen Anwendungs-Version im `package-lock.json`, die versionierte Pairing-Runtime und Referenz in `index.html`, die Android-Gradle-Plugin- und Kotlin-Versionen, Android-SDK- und Bibliotheksversionen, Java-Target, Gradle-Wrapper-Version sowie den Release-`versionCode` im GitHub-Workflow.

GitHub Actions prüft nach dem Checkout **vor** der Einrichtung von Node/Java die synchronisierten Versionen mit `--check`. Danach werden Node- und Java-Version direkt aus der zentralen JSON-Datei eingelesen. Versionsänderungen, die noch nicht synchronisiert wurden, führen zu einem frühen Abbruch.

### npm-Abhängigkeiten ändern

`config/versions.json` ist die zentrale Vorgabe für npm-Deklarationen. Nach deren Änderung zuerst `python3 scripts/sync_versions.py` ausführen. Bei Änderungen der Paket-Abhängigkeiten zusätzlich im Ordner `webui` mit einer passenden Node/npm-Version die Lockdatei aktualisieren, z. B. mit `npm install --package-lock-only --include=optional`, dann `toolchain.vite.resolved` falls nötig an die tatsächlich installierte Vite-Version anpassen und erneut synchronisieren/prüfen. Die verschachtelten, von npm verwalteten Lockfile-Einträge werden nicht manuell generiert.

### App-Version ändern

`app.version` in `config/versions.json` ändern und Synchronisierung ausführen. Die aktuelle `package.json`-App-Version ist eine synchronisierte Kopie, die Android weiterhin über die bestehende `webuiVersion`-Logik verwendet. Das Pairing-Runtime-Skript und der `index.html`-Verweis werden angepasst. Anschließend `npm run verify:source` und einen vollständigen APK-Build ausführen.

**Wichtig:** Die Android-BA-VersionCode-Logik und Signaturidentität bleiben erhalten. Für bereits ausgelieferte APKs muss der resultierende `versionCode` aufsteigend sein; Änderung am Basiscode oder Offset nur bewusst durchführen. Die BA-/BS-Commit-Trennung bleibt unverändert: BS läuft ausschließlich bei `BS_`-Commits.

### Nicht vollständig lokal nachgewiesen

Das ursprünglich hochgeladene Archiv enthält ein plattformabhängiges `webui/node_modules`, dem die Linux-Rollup-Binärdatei fehlt. Deshalb wurde der vollständige lokale WebUI-/APK-Build hier **nicht erfolgreich ausgeführt**. Die Checks `sync_versions.py --check` und `npm run verify:source` liefen erfolgreich. Für die Validierung eines Builds unbedingt erst `npm ci --include=optional --no-audit --no-fund` ausführen (wie in CI vorgesehen).
