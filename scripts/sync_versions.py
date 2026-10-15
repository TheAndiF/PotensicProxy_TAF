#!/usr/bin/env python3
"""Synchronize version declarations from config/versions.json. No network/npm required.

Usage: python3 scripts/sync_versions.py [--check]
--check never modifies files; CI fails if committed generated values drift.
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CFG = json.loads((ROOT / 'config/versions.json').read_text(encoding='utf-8'))
parser = argparse.ArgumentParser()
parser.add_argument('--check', action='store_true')
args = parser.parse_args()
failures = []


def update(relative, transform):
    file = ROOT / relative
    before = file.read_text(encoding='utf-8')
    after = transform(before)
    if after != before:
        if args.check:
            failures.append(str(relative))
        else:
            file.write_text(after, encoding='utf-8')
            print('[versions] updated', relative)


def replace_one(source, pattern, replacement, name):
    updated, n = re.subn(pattern, lambda m: replacement, source, count=1, flags=re.MULTILINE)
    if n != 1:
        raise ValueError(f'Missing expected declaration: {name}')
    return updated


app = CFG['app']
tool = CFG['toolchain']
android = CFG['android']


def package(text):
    obj = json.loads(text)
    obj['version'] = app['version']
    obj['dependencies'] = CFG['webui']['dependencies']
    obj['devDependencies'] = CFG['webui']['devDependencies']
    if obj['devDependencies']['vite'] != tool['vite']['range']:
        raise ValueError('webui.devDependencies.vite must equal toolchain.vite.range')
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'


update('webui/package.json', package)

# Version-sensitive pairing runtime is source code. Update only its version
# markers and index reference; retain all pairing behaviour unchanged.
def runtime_source(text):
    text = replace_one(text, r"const VERSION = '[^']+'", "const VERSION = '" + app['version'] + "'", 'pairing runtime version')
    text = replace_one(text, r'data-taf-pairing-runtime="[^"]+"', 'data-taf-pairing-runtime="' + app['version'] + '"', 'pairing runtime marker')
    return text


update('webui/scripts/pairing-runtime-source.js', runtime_source)
update('webui/index.html', lambda t: replace_one(t, r'taf-pairing-runtime-v[^"/]+\.js', 'taf-pairing-runtime-v' + app['version'] + '.js', 'pairing runtime script'))

runtime_asset = ROOT / 'webui/public/assets' / ('taf-pairing-runtime-v' + app['version'] + '.js')
canonical_runtime = runtime_source((ROOT / 'webui/scripts/pairing-runtime-source.js').read_text(encoding='utf-8'))
if not runtime_asset.exists() or runtime_asset.read_text(encoding='utf-8') != canonical_runtime:
    if args.check:
        failures.append(str(runtime_asset.relative_to(ROOT)))
    else:
        runtime_asset.parent.mkdir(parents=True, exist_ok=True)
        runtime_asset.write_text(canonical_runtime, encoding='utf-8')
        print('[versions] updated', runtime_asset.relative_to(ROOT))


def lockfile(text):
    obj = json.loads(text)
    obj['version'] = app['version']
    obj['packages']['']['version'] = app['version']
    entry = obj['packages']['']
    for section in ('dependencies', 'devDependencies'):
        if entry.get(section, {}) != CFG['webui'][section]:
            raise ValueError('package-lock.json dependency declarations differ from config; run npm install --package-lock-only after changing a dependency')
    if obj['packages']['node_modules/vite']['version'] != tool['vite']['resolved']:
        raise ValueError('Vite resolved version differs from config; update lockfile with npm before synchronizing')
    # Avoid unnecessary diff/reformatting of npm-managed lockfiles.
    original = json.loads(text)
    if original['version'] == obj['version'] and original['packages']['']['version'] == obj['packages']['']['version']:
        return text
    return json.dumps(obj, ensure_ascii=False, indent=2) + '\n'


update('webui/package-lock.json', lockfile)


def root_gradle(t):
    t = replace_one(t, r'(id\("com\.android\.application"\) version ")[^"]+', 'id("com.android.application") version "' + tool['androidGradlePlugin'], 'android plugin')
    t = replace_one(t, r'(id\("org\.jetbrains\.kotlin\.android"\) version ")[^"]+', 'id("org.jetbrains.kotlin.android") version "' + tool['kotlin'], 'Kotlin plugin')
    return t


update('build.gradle.kts', root_gradle)


def app_gradle(t):
    for key in ('compileSdk', 'minSdk', 'targetSdk'):
        pattern = rf'(?m)^(\s*{key}\s*=\s*)\d+'
        if not re.search(pattern, t):
            raise ValueError(f'Missing Android setting: {key}')
        t = re.sub(pattern, lambda m: m.group(1) + str(android[key]), t, count=1)
    pattern = r'(\.plus\()[-\d_]+(\)\s*\?:\s*)\d+'
    if not re.search(pattern, t):
        raise ValueError('Missing Android versionCode expression')
    t = re.sub(pattern, lambda m: m.group(1) + str(app['baVersionCodeOffset']) + m.group(2) + str(app['defaultVersionCode']), t, count=1)
    for key,val in CFG['androidLibraries'].items():
        oldpat = rf'implementation\("{re.escape(key)}:[^"\n]+"\)'
        t,n = re.subn(oldpat, lambda m: f'implementation("{key}:{val}")', t, count=1)
        if n != 1: raise ValueError('Missing Android dependency ' + key)
    jav = tool['java']
    t = re.sub(r'JavaVersion\.VERSION_\d+', f'JavaVersion.VERSION_{jav}', t)
    t = re.sub(r'(jvmTarget\s*=\s*")[^"]+', r'\g<1>'+jav, t)
    return t


update('app/build.gradle.kts', app_gradle)
update('gradle/wrapper/gradle-wrapper.properties', lambda t: re.sub(r'gradle-[\d.]+-bin\.zip', 'gradle-'+tool['gradle']+'-bin.zip',t))

# CI scripts always read node/java straight from config (not duplicated literals).
# Release versionCode also comes from the configuration rather than a stale regex.
def release(t):
    t = t.replace("code=68 # update this when app/build.gradle.kts versionCode is raised", "code=json.load(open('config/versions.json'))['app']['defaultVersionCode']")
    t = t.replace('          code=int(match.group(1))\n', '')
    return t


update('.github/workflows/release-apk.yml', release)
if failures:
    print('[versions] inconsistent files:', ', '.join(failures), file=sys.stderr)
    sys.exit(1)
print('[versions] ' + ('all version declarations match' if args.check else 'synchronized'))
