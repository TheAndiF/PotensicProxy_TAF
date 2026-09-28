#!/usr/bin/env python3
"""Fast source-level regression checks for the A-F architecture split."""
from pathlib import Path
import sys
root=Path(__file__).resolve().parents[1]
checks={
 "central state": root/"app/src/main/java/com/potensic/proxy/core/DroneState.kt",
 "control coordinator": root/"app/src/main/java/com/potensic/proxy/control/ControlCoordinator.kt",
 "protocol boundary": root/"app/src/main/java/com/potensic/proxy/protocol/PotensicProtocol.kt",
 "video fanout": root/"app/src/main/java/com/potensic/proxy/video/VideoFrameHub.kt",
 "state routes": root/"app/src/main/java/com/potensic/proxy/api/ApplicationStateRoutes.kt",
 "diagnostics routes": root/"app/src/main/java/com/potensic/proxy/api/DiagnosticsRoutes.kt",
}
failed=False
for name,path in checks.items():
    ok=path.is_file() and path.stat().st_size>0
    print(f"{'OK' if ok else 'FAIL'}: {name}: {path.relative_to(root)}")
    failed |= not ok
ws=(root/"app/src/main/java/com/potensic/proxy/WebServer.kt").read_text(encoding="utf-8")
svc=(root/"app/src/main/java/com/potensic/proxy/ProxyService.kt").read_text(encoding="utf-8")
for label,condition in [
 ("WebServer no longer owns joystick fields", "@Volatile var throttle" not in ws),
 ("Service uses ControlCoordinator", "controlCoordinator.current()" in svc),
 ("Web video does not consume extractor queue", "videoExtractor.nalQueue.poll()" not in ws),
]:
    print(f"{'OK' if condition else 'FAIL'}: {label}")
    failed |= not condition
sys.exit(1 if failed else 0)
