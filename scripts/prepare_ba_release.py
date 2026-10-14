#!/usr/bin/env python3
"""BA update manifest. Called only after verified Gradle and APK signing checks."""
import argparse, hashlib, json, pathlib, shutil
from datetime import datetime, timezone

parser = argparse.ArgumentParser()
for arg in ('apk', 'output', 'repository', 'run-number', 'sha', 'version-name'):
    parser.add_argument('--' + arg, required=True)
a = parser.parse_args()
repo = a.repository
assert repo == 'TheAndiF/PotensicProxy_TAF', 'Unexpected public update repository'
assert len(a.sha) == 40 and all(c in '0123456789abcdef' for c in a.sha.lower())
run = int(a.run_number)
assert run > 0
code = 2000000 + run  # BA_: TAF_BUILD_VERSION_CODE=(1900000+run), Gradle adds 100000
out = pathlib.Path(a.output)
out.mkdir(parents=True, exist_ok=True)
name = f'PotensicProxy_TAF-BA-{code}.apk'
shutil.copy2(a.apk, out / name)
digest = hashlib.file_digest(open(out / name, 'rb'), 'sha256').hexdigest()
(out / (name + '.sha256')).write_text(f'{digest}  {name}\n')
tag = f'ba-debug-{run}-{a.sha[:7]}'
manifest = {
    'channel': 'BA_', 'packageName': 'com.potensic.proxy',
    'versionCode': code, 'versionName': a.version_name,
    'apkUrl': f'https://github.com/{repo}/releases/download/{tag}/{name}',
    'sha256': digest, 'buildId': a.sha,
    'buildDate': datetime.now(timezone.utc).isoformat(), 'tag': tag,
}
(out / 'taf-update-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('BA release payload prepared:', tag, code)
