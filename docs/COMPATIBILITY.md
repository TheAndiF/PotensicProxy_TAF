# Hardware and feature compatibility

This matrix distinguishes **source configuration**, **independent reports** and **tests of this exact TAF build**. A configured feature must not be presented as validated on every device.

| Combination | USB/AOA | Video | Telemetry | Control | Evidence |
| --- | --- | --- | --- | --- | --- |
| ATOM / DSRC02A / Android with DIY USB-C replacement | AOA prompt reported | Short prototype flight with live view reported | Not independently measured | Physical controller inputs reported | [Cable project](https://github.com/TheAndiF/Potensic-ATOM-USB-C-Replacement-Cable); **not** an end-to-end TAF test |
| ATOM / Android / TAF `ATOM` profile | Implemented path | H.264 1280×720 configured | Implemented path | Commands implemented | TAF device test pending |
| ATOM 2 / basic Deepsea controller / Pixel 9 Pro Fold, Android 15 | Upstream reports test | Upstream reports H.265 1920×1080 | Upstream reports telemetry | Virtual stick limitation on that controller reported by upstream | [Original upstream](https://github.com/sk7n4k3d/potensic-proxy); **not** automatically a TAF test |
| ATOM 2 / Android / TAF `ATOM_2` profile | Implemented path | `w42`, 1920×1080, H.265 preferred | Implemented path | Commands implemented; controller-dependent | TAF device test pending |
| ATOM SE / LT, other controllers, iOS | Unknown | Unknown | Unknown | Unknown | No verified evidence for this build |

## Important distinctions

- Reading **physical stick positions** is not proof that the controller accepts **virtual stick commands**.
- The DIY USB-C cable uses directional non-standard wiring and is not a universal USB-C or charging cable. ATOM 2 compatibility has not been demonstrated by its prototype report.
- The presence of BLE/Wi-Fi Direct code does not prove that the attached controller has compatible Wi-Fi hardware.
- RF diagnostics and reset/unlock UI actions do **not** establish increased radio range or regulatory compliance.
- Creating, saving and exporting missions does **not** establish autonomous mission execution.
- PrecisionStart/PrecisionLanding software paths require controlled flight tests and failsafe validation.

## How to contribute a test report

Include: test date, TAF commit and version, aircraft model/firmware, controller model/revision, phone and Android version, cable type/revision, transport path, exact function tested, expected and observed results, evidence and limitations.

Avoid exposing GPS home locations, serial numbers, authentication material or personally identifiable logs. Mark a combination **tested** only when the result is reproducible and documented.
