# Group 2 – Camera & Media integration

Implemented against the decompiled PotensicPro USB camera path.

## Protocol path

TAF now supports the PotensicPro 2022/new-FC camera framing:

- outer USB/FE type: `0x15` (`USB_TYPE_APP_TO_CAMERA`)
- inner frame: `FF FD`
- inner message short: `0x0020`
- XOR checksum identical to `UsbPayloadWrapper.wrap((short) 32, ...)`

Representative payloads:

- format SD: `04`
- get SD status: `17` (hex; decimal 23)
- set record resolution: `0B <index>`
- set photo resolution: `0D <index>`
- set EV: `0F <mode> <encodedEV>`
- enter/quit gallery: `21` / `22`
- file count/list/info/download/delete: `18` / `19` / `1A` / `1B` / `1D`

## Integrated functions

- Recording resolution selection
- Photo resolution selection
- Video EV and photo EV
- Read camera settings/status
- SD-card status/free/total capacity parsing
- SD-card formatting with UI confirmation
- Enter/leave camera gallery
- Read paged photo/video file lists
- Read file metadata
- Download photos and the same LRV video proxy used by PotensicPro's USB gallery
- Delete camera files with UI confirmation

## Verification state

- TypeScript/Vue type check: passed (`vue-tsc --noEmit`)
- Full Vite bundle could not be executed in the analysis environment because the ZIP's bundled `node_modules` lacks the Linux optional Rollup package `@rollup/rollup-linux-x64-gnu`.
- No device-side functional test was possible in this environment; protocol commands were derived directly from PotensicPro's `UsbCameraHandler`, `UsbPayloadWrapper`, `UsbDataWrapper`, and USB gallery classes.
