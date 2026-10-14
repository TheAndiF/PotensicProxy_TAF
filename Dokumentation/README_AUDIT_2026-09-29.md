# README audit - 2026-09-29

## Purpose

Review the repository README against the current PotensicProxy_TAF package and update it so it describes the actual project instead of older upstream assumptions.

## 1. Content that still fits

- Android USB proxy architecture with an embedded WebUI.
- USB Accessory / controller / RF / drone data path.
- Telemetry, flight commands and video handling as central functions.
- Ktor HTTP/WebSocket backend and browser-based frontend.
- Reference to upstream project provenance.
- Android build through Gradle with JDK 17.

## 2. Content that was no longer correct or sufficiently precise

- The README described the UI only as a cyberpunk dashboard and did not reflect the current modular navigation.
- The top-level **Engineering** naming was outdated after the UI reorganization to **System**.
- The previous video statement generalized `1920x1080 H265` as the project LiveView. The current package contains separate ATOM and ATOM 2 profiles and must not describe one codec/resolution as universally valid.
- The old endpoint table did not reflect the current map, mission, profile, capture and diagnostic APIs.
- The old limitations section contained upstream-specific assumptions that no longer represented the current package accurately.
- The README did not describe frontend/backend separation, central drone profiles, map/mission modules or the current confirmed/unconfirmed protocol rule.

## 3. Content that had to be added

- Current main navigation: Flight Cockpit, Mission Planning, Map, Gallery, USB Tools and System.
- Engineering -> System reorganization and moved Flight / Calibration / Smart Modes area.
- Selectable Dark/Light/Gray backgrounds.
- Transparent telemetry overlay and fullscreen behavior.
- Phone/controller/drone power indicators and their data sources.
- Always-visible Camera Control below Joystick Control, separate collapsible Camera settings section, and LiveView side controls.
- Continuous camera-zoom UI setpoint via the same vertical control concept used for Gimbal plus direct numeric entry; the redundant horizontal slider is intentionally absent. No unconfirmed zoom protocol command is sent.
- Map + / - controls plus direct zoom input.
- Current map and mission capabilities.
- Current build requirements from Gradle.
- Current API overview and protocol-change rule.

## Result

`README.md` was rewritten to match the current source tree and the implemented UI changes. Claims that could not be supported by the current package were removed or qualified.
