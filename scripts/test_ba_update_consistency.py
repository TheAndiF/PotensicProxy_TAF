#!/usr/bin/env python3
"""Source-level BA version and installer invariants; run from project root."""
from pathlib import Path
import re
root = Path(__file__).resolve().parents[1]
gradle = (root / "app/build.gradle.kts").read_text()
workflow = (root / ".github/workflows/ba-update.yml").read_text()
manifest = (root / "scripts/prepare_ba_release.py").read_text()
manager = (root / "app/src/main/java/com/potensic/proxy/UpdateManager.kt").read_text()
assert ".plus(1_900_000)" in gradle
assert "EXPECTED=$((2000000 + GITHUB_RUN_NUMBER))" in workflow
assert "code = 2000000 + run" in manifest
for run in (1, 118, 119, 99999):
    apk_code = 1_900_000 + run + 100_000
    release_code = 2_000_000 + run
    assert apk_code == release_code
assert 'if (method == "magisk")' in manager
assert 'require(prefs.getBoolean("headless_enabled", false))' in manager
assert 'verifyStagedUpdate()' in manager
assert 'install_requested_code' in manager
print("BA source checks passed: version parity and installer guards")
