# PotensicProxy_TAF – 0.9846.2

Fix: Android package must contain the built System > App / Drohne / Web navigation.
The GitHub build verifies the compiled WebUI and blocks publication of obsolete System navigation.
All functional System panels from 0.9846.1 remain unchanged.

## Release acceptance
- Compile WebUI with npm ci and Gradle :app:assembleDebug.
- Confirm the navigation controls and all previous tabs in Android.
- Confirm PStart/PLand, camera, sensors, logs, remote, update handling.
- Validate incremented versionCode and stable BA signature.
No complete Android build was performed in the packaging environment.
