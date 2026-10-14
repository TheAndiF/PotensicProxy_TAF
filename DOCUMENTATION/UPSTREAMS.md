# Upstreams and Project Provenance

## Primary upstream

- Repository: https://github.com/sk7n4k3d/potensic-proxy
- Role: Primary fork/upstream base.

## Secondary implementation / reviewed source

- Repository: https://github.com/liert/potensic-proxy
- Role: Secondary source for reviewed improvements.

## PotensicProxy_TAF maintained components

- BX3 control/override interface
- F1-F5 control mapping and transport
- BX3 timeout and failsafe integration
- PrecisionLanding
- OpenCV-based visual landing-position refinement
- Potensic ATOM specific integration

## PrecisionLanding goal

PrecisionLanding augments GPS-based return and landing. A reference image of the takeoff area is captured at takeoff. During landing, current camera images are compared with the reference image on the Android device. The resulting visual position error is converted into small control corrections and delivered through the BX3 control interface. GPS provides coarse positioning while visual matching provides local landing refinement.

## Integration principle

Existing upstream application, video, USB/AOA, telemetry and UI functionality should be reused where practical. Project-specific changes should remain modular to reduce conflicts with upstream updates.

## Git remotes

- origin: TheAndiF/PotensicProxy_TAF
- upstream: sk7n4k3d/potensic-proxy
- liert: liert/potensic-proxy
