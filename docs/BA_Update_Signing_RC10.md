# BA_ Update signing identity - RC10

Version: v0.9845.7-rc10 | 2026-10-14

## Definitive policy

BA_ executes the complete uncached BL_ build and publishes a verified debug APK as GitHub prerelease. BS_ remains independently cached.

Public certificate SHA-256: `600fd095f477bcf582a2a828efc4d0f4cfd7f8d641858292c477635a10773262`
Android applicationId: `com.potensic.proxy`
BA_ signing alias: `potensicproxy_ba_v1`

The private keystore and passwords are **not included** in the public repository, whole-project ZIP, change ZIP, or Git patch. Use the separately delivered private files only. Never upload those private files to GitHub releases.

## Setup in GitHub

1. Securely retain `PotensicProxy_TAF_BA_v1.jks` and the separately provided plaintext credentials sheet.
2. Convert the JKS into one-line Base64, without editing bytes. PowerShell: `[Convert]::ToBase64String([IO.File]::ReadAllBytes('C:\path\PotensicProxy_TAF_BA_v1.jks'))`.
3. Under Repository Settings > Secrets and variables > Actions create the four secrets: `TAF_DEBUG_KEYSTORE_B64`, `TAF_DEBUG_STORE_PASSWORD`, `TAF_DEBUG_KEY_ALIAS`, `TAF_DEBUG_KEY_PASSWORD`. Do not put values in git or issue logs.
4. Make a `BA_` commit on the target branch. The workflow verifies the keystore certificate before installing dependencies and the produced APK certificate before publishing.
5. Complete APK build, manifest checks, Android install and subsequent update regression tests before approving.

## Migration and data

The previous installed APK has a different debug signature. Direct in-place upgrade to BA_v1 is not possible. User explicitly chose to omit migration. Uninstalling the former APK removes private app data and permission grants; preserve external files separately where required. No migration or data retention is promised for that one-time switch. Following BA_v1 installs can update in place only while package name, signing key and versionCode remain compatible.

## Security

The plaintext sheet includes credentials. Keep it offline in a restricted location, not in a public repo. Never disclose or upload the JKS and password combination. In case of exposure, rotate and plan migration (a new certificate cannot simply replace an installed app).
