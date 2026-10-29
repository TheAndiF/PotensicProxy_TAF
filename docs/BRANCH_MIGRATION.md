# Branch-Struktur und sichere Umstellung

## Ziel

- `main` = bisher `usb-liveview-import`, **einziger aktiver Entwicklungsbranch**.
- `legacy-original` = bisher `master`, historische Ursprungsversion.
- `archive-liert-review` = bisher `liert-reviewed`, historischer Review-Stand.

**Stand 29.10.2026:** Der Nutzer hat die drei neuen Remote-Branches und `main` als Default bestätigt; lokale Upstreams wurden entsprechend gesetzt. Die alten Remote-Branch-Namen können noch vorhanden sein. Die unterschiedlichen Entwicklungsstände werden nicht gemergt oder zurückgesetzt.

## Vorab prüfen

1. Sicherstellen, dass alle lokalen und Remote-Änderungen gesichert sind; aktuelle Branch-Spitzen/Commit-IDs notieren.
2. Branch-Protection-Regeln, Default-Branch, offene Pull Requests, externe Checkout-Links und Automatisierungen erfassen.
3. Alle GitHub-Actions-Workflows auf Branch-Filter, Environment-Regeln, Release- und Update-Trigger prüfen. Der Dispatcher routet derzeit anhand der Commit-Präfixe `BA_`, `BS_`, `BL_` und nutzt den jeweiligen Quellbranch.
4. Referenzen in externen Skripten, README-Links, CI-Integrationen und APK-Verteilung prüfen. Release-Tags, Signaturschlüssel, Paketnamen und Versionscodes nicht anfassen.
5. Geräte- und Update-Tests für bestehende Installationen einplanen. Lokale Änderungen im Arbeitsverzeichnis vor der Migration nicht überschreiben.

## Empfohlene GitHub-Reihenfolge

1. In GitHub den Branch `usb-liveview-import` zu `main` umbenennen und bestätigen, dass `main` tatsächlich Default ist.
2. Build-Dispatcher und `BA_`-/`BS_`-/`BL_`-Workflows auf `main` testen; alle branchabhängigen Update-Pfade prüfen.
3. Erst danach den historischen `master` zu `legacy-original` umbenennen.
4. `liert-reviewed` zu `archive-liert-review` umbenennen.
5. Alle dokumentierten Links und Branch-Regeln aktualisieren. Die README-Statusangabe von „geplant“ auf „umgesetzt“ setzen.
6. Sicherstellen, dass die alten Branch-Spitzen weiterhin über die neuen Namen erreichbar sind und Releases/Downloads unverändert funktionieren.

## Lokale Klone nach GitHub-Umbenennung

Beispiel für den aktiven Entwicklungsbranch (erst **nach** bestätigter Remote-Umstellung, mit sauberem Arbeitsverzeichnis):

```bash
git fetch origin
git branch -m usb-liveview-import main
git branch -u origin/main main
git remote set-head origin -a
```

Weitere vorhandene lokale Branches entsprechend umbenennen und Upstreams neu setzen. Es ist kein `push --force` erforderlich. Ob die GitHub-Umbenennung Referenzen automatisch weiterleitet, muss für externe Tools separat verifiziert werden.

## Abnahme

- `main` zeigt auf den bisherigen aktiven Entwicklungsstand.
- Alte Branches sind als `legacy-original` und `archive-liert-review` verfügbar.
- `BA_`, `BS_`, `BL_` lösen weiterhin die vorgesehenen Builds aus.
- Keine APK-Signatur, App-ID, Versionsnummer oder Update-Quelle wurde unbeabsichtigt geändert.
- README und Kabel-Repository verlinken sich gegenseitig (Rückverweis im separaten Kabel-Repository nachziehen).
