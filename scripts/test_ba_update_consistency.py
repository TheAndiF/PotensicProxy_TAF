#!/usr/bin/env python3
<<<<<<< HEAD
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
=======
"""Check BA/BL version arithmetic and guard against double-offset regressions."""
from pathlib import Path
import re

root = Path(__file__).resolve().parents[1]
gradle = (root / 'app/build.gradle.kts').read_text()
commit_build = (root / '.github/workflows/build-apk.yml').read_text()
auto_ba = (root / '.github/workflows/ba-update.yml').read_text()
manifest = (root / 'scripts/prepare_ba_release.py').read_text()
manager = (root / 'app/src/main/java/com/potensic/proxy/UpdateManager.kt').read_text()

assert re.search(r'\.plus\(100_000\)', gradle), 'Gradle common offset must be 100000'
assert '1900000 + GITHUB_RUN_NUMBER' in commit_build, 'BA commit build offset missing'
assert '1900000 + GITHUB_RUN_NUMBER' in auto_ba, 'BA standalone build offset missing'
for workflow in (commit_build, auto_ba):
    assert 'EXPECTED=$((2000000 + GITHUB_RUN_NUMBER))' in workflow, 'BA manifest expectation inconsistent'
assert 'code = 2000000 + run' in manifest
for run in (1, 118, 119, 99999):
    expected = 2_000_000 + run
    ba_commit = (1_900_000 + run) + 100_000
    ba_standalone = (1_900_000 + run) + 100_000
    bl = run + 100_000
    release = 2_000_000 + run
    assert expected == ba_commit == ba_standalone == release
    assert bl < expected
>>>>>>> 5a48670 (BA_ fix versionCode parity across APK build, validation and release)
assert 'if (method == "magisk")' in manager
assert 'require(prefs.getBoolean("headless_enabled", false))' in manager
assert 'verifyStagedUpdate()' in manager
assert 'install_requested_code' in manager
<<<<<<< HEAD
print("BA source checks passed: version parity and installer guards")
=======
print('OK: BA commit/standalone APK + release codes match; BL separated; installer guards remain')
>>>>>>> 5a48670 (BA_ fix versionCode parity across APK build, validation and release)
