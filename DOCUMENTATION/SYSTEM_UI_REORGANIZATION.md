# System UI reorganization

## Scope

The top-level **Engineering** navigation entry is presented as **System** in the WebUI.
The previously cockpit-local **Flight / Calibration / Smart Modes** panel is moved into System as its own first sub-tab.

## Functional changes

- Header label: Engineering -> System.
- New System sub-tab: Flight / Calibration / Smart Modes.
- Flight limits & RTH, intelligent flight modes and calibration controls are no longer rendered in the Flight Cockpit right-hand panel.
- Existing engineering/diagnostic sub-tabs remain unchanged and continue to be available under System.
- Existing protocol calls and backend behavior are unchanged; this is a UI/navigation reorganization only.

## Modified files

- `webui/src/components/header/HeaderBar.vue`
- `webui/src/components/cockpit/CockpitView.vue`
- `webui/src/components/debug/DebugConsoleView.vue`
- `webui/src/stores/useDebugStore.ts`
- `webui/src/i18n/index.ts`

## Compatibility

No protocol constants, packet formats, USB transport behavior, camera commands or flight-setting payload formats were changed.
