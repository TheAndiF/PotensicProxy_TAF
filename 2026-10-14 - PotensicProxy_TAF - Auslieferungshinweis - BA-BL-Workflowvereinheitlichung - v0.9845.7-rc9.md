# PotensicProxy_TAF - Auslieferungshinweis - BA-BL-Workflowvereinheitlichung - v0.9845.7-rc9

Stand: 2026-10-14 | Status: Release Candidate, GitHub-/Gerätetest ausstehend.

BL_ und BA_ triggern denselben bestehenden build-apk.yml-Workflow auf jedem Push-Branch. Beide verwenden den identischen cachefreien Android-Build. Ein BA_-Commit führt nur **einen** APK-Build aus und erhält zusätzlich die Pflichtsignierung, Verifikation, Manifest-Erzeugung sowie GitHub-Prerelease. BS_ bleibt unverändert. Separate ba-update.yml entfernt, um Trigger-/Build-Duplikate zu verhindern.

Der neue BA_-Build setzt vier Actions-Secrets voraus. Das Commit-Präfix muss in der ersten Zeile der Push-Head-Commit-Nachricht stehen. GitHub muss den Workflow aus dem gepushten Branch laden.

**Vor Veröffentlichung prüfen:** Der BA_-`versionCode` beträgt 2.000.000 plus `github.run_number` des gemeinsamen Workflows; er wird gegen die APK und das Manifest geprüft. Bereits installierte Versionscodes müssen dennoch vor einem Update verglichen werden. Signaturidentität, Release-Zugriff, Datenbestand und Updatefunktion sind auf GitHub und Gerät zu testen.
