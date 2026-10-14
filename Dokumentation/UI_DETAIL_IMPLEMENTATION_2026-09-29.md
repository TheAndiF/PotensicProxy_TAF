# UI detail implementation - 2026-09-29

## Scope

Audit the current package against the requested UI/detail changes, implement missing items where they can be implemented without inventing protocol behavior, and document remaining technical limits.

## Result matrix

| Request | Before this change | Result | Notes |
|---|---|---|---|
| Selectable lighter/white/gray background | Not implemented | Implemented | Header selector with Dark, Light and Gray; persisted in local storage. |
| Phone battery | Not implemented | Implemented | Android `BatteryManager` -> `/api/status` -> WebUI. |
| Controller battery | Voltage existed; percentage was parsed only for diagnostics | Implemented/conditional | Percentage from existing `0x1131` response is now stored/displayed when valid; voltage remains fallback. |
| Drone battery | Already available | Kept and integrated | Shown beside phone/controller in the status overlay. |
| Continuous camera zoom control | Presets/setpoint only | UI implemented | Vertical drag control and direct numeric entry in 0.01 steps. The redundant horizontal range slider was removed. No speculative protocol transmission added. |
| Transparent status block over image | Status bar outside main stage | Implemented | Telemetry bar moved into flight stage as transparent overlay. |
| Status visible in fullscreen | Not guaranteed | Implemented | Fullscreen now targets the complete flight stage so the status overlay remains visible. |
| Camera layout | Camera Control and Camera settings were grouped in one collapsible section | Implemented | Camera Control is now always visible directly below Joystick Control. Only the Camera settings section is collapsible. The controls-side preview remains below Camera. |
| LiveView buttons in collapsible side menu | Actions permanently in top OSD | Implemented | Stream/IDR/render/fullscreen moved to side drawer; view switcher also moved to a collapsible side drawer. Small PIP hides action controls. |
| Map +/- plus direct zoom input | +/- existed | Implemented | Numeric zoom input added between + and -. |
| Calibration under technical area | Previously moved | Confirmed | Remains under System. |
| Flight/Calibration/Smart Modes under technical area | Previously moved | Confirmed | Remains as System sub-area. |
| Rename Engineering to System | Previously implemented | Confirmed | Header/System structure retained. |
| Frontend/backend separation | Existing | Preserved | UI stays in `webui`; Android phone battery is exposed through the backend API. |
| Do not change unconfirmed protocol areas | Project rule | Preserved | No camera-zoom command was invented or transmitted. |
| README review and update | Outdated README | Implemented | README audited and rewritten; separate README audit added. |

## Technical limitation: camera zoom

The UI can now select a continuous zoom setpoint. The current project data model does not contain a confirmed measured zoom feedback field and the current protocol layer contains no confirmed ATOM/ATOM 2 camera-zoom command. The implementation therefore stops at the UI setpoint. This is intentional and follows the project rule that unconfirmed protocol areas remain unchanged.

## Power display behavior

- Phone: percentage from Android `BatteryManager`.
- Controller: `remoterBatteryPercent` from the already parsed `0x1131` status response when > 0; otherwise controller voltage.
- Drone: existing flight telemetry battery percentage.

## Structural changes

The right-side cockpit order is now **Joystick Control -> Camera Control -> Camera -> small preview window**. Camera Control remains permanently visible. The Camera settings block is independently collapsible. Gimbal and Zoom use the same vertical control concept; the redundant horizontal Zoom range slider was removed.

The previously implemented System navigation reorganization remains intact. No mission, map-provider, USB transport, packet framing or flight-command format was changed by this UI-detail work.

## Project documentation deliverables

- `COMMIT_MESSAGE_CAMERA_LAYOUT_2026-09-29.txt`
- `NUR_AENDERUNGEN_IN_ORIGINALSTRUKTUR_2026-09-29_v1.1.md`
- `PATCH_UI_CAMERA_LAYOUT_v1.1.patch`
- `DOCUMENTATION/2026-09-29_PotensicProxy_TAF_Projektdokumentation_UI-Detailaenderungen_v1.1.docx`
- `DOCUMENTATION/2026-09-29_PotensicProxy_TAF_Projektdokumentation_UI-Detailaenderungen_v1.1.pdf`
