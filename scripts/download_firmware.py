#!/usr/bin/env python3
"""
Download Potensic Atom 2 firmware from OTA servers.

Requires: pip install cryptography

Usage:
    python download_firmware.py \
        --email user@example.com \
        --password yourpassword \
        --flight-sn 1910FXXXXXXXXXXXXXX \
        --rc-sn R31EXXXXXXXXXX
"""

import argparse
import base64
import hashlib
import json
import os
import struct
import sys
import time
import urllib.request
import ssl

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

PRIMARY_KEY = bytes.fromhex("be0343d13327a710cbed4a2a1e987837")
BASE_URL = "https://atom-server.potensic.com"


def encrypt_aes_gcm(plaintext: str, key: bytes) -> str:
    aesgcm = AESGCM(key)
    iv = os.urandom(12)
    ct = aesgcm.encrypt(iv, plaintext.encode(), None)
    raw = struct.pack(">I", len(iv)) + iv + ct
    return base64.b64encode(raw).decode()


def decrypt_aes_gcm(b64data: str, key: bytes) -> str:
    raw = base64.b64decode(b64data)
    iv_len = struct.unpack(">I", raw[:4])[0]
    iv = raw[4 : 4 + iv_len]
    ct = raw[4 + iv_len :]
    return AESGCM(key).decrypt(iv, ct, None).decode()


def api_request(endpoint: str, body: dict, auth_header: str) -> dict:
    ctx = ssl.create_default_context()
    data = json.dumps(body).encode()
    req = urllib.request.Request(
        f"{BASE_URL}/{endpoint}",
        data=data,
        headers={"Content-Type": "application/json", "Authorization": auth_header},
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx, timeout=15)
        return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return json.loads(e.read())


def login(email: str, password: str) -> str:
    ts = int(time.time())
    auth = encrypt_aes_gcm(
        json.dumps({"userToken": "", "timestamp": ts}), PRIMARY_KEY
    )

    login_json = json.dumps({
        "password": base64.b64encode(password.encode()).decode(),
        "clientType": 2,
        "timestamp": ts,
        "appVersion": "2.9.6",
        "confirm": False,
        "mail": email,
        "phoneNumber": None,
        "phoneType": "Pixel 7",
        "phoneSystems": "14",
    })

    encrypted_body = encrypt_aes_gcm(login_json, PRIMARY_KEY)
    body = json.dumps({"data": encrypted_body}).encode()

    ctx = ssl.create_default_context()
    req = urllib.request.Request(
        f"{BASE_URL}/atom/client/user/login",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": auth},
    )
    resp = urllib.request.urlopen(req, context=ctx, timeout=15)
    data = json.loads(resp.read())

    if data.get("code") != 0:
        print(f"Login failed: {data.get('message')}", file=sys.stderr)
        sys.exit(1)

    token = decrypt_aes_gcm(data["data"]["userToken"], PRIMARY_KEY)
    print(f"Logged in as {email}")
    return token


def make_auth(token: str) -> str:
    ts = int(time.time())
    return encrypt_aes_gcm(
        json.dumps({"userToken": token, "timestamp": ts}), PRIMARY_KEY
    )


def check_upgrade(token: str, flight_sn: str, rc_sn: str, flight_ver: str, rc_ver: str) -> dict:
    auth = make_auth(token)
    body = {
        "appName": "Potensic Eve",
        "appVersion": "2.9.6",
        "clientType": 2,
        "flightVersion": flight_ver,
        "rcVersion": rc_ver,
        "flightSN": flight_sn,
        "rcSN": rc_sn,
        "languageType": 1,
        "product": 179,
    }
    return api_request("atom/client/ota/checkUpgrade", body, auth)


def get_upgrade(token: str, flight_sn: str, rc_sn: str, flight_ver: str, rc_ver: str) -> dict:
    auth = make_auth(token)
    body = {
        "appName": "Potensic Eve",
        "appVersion": "2.9.6",
        "clientType": 2,
        "flightVersion": flight_ver,
        "rcVersion": rc_ver,
        "flightSN": flight_sn,
        "rcSN": rc_sn,
        "languageType": 1,
    }
    return api_request("atom/client/ota/upgrade", body, auth)


def download_file(url: str, output: str, expected_md5: str | None = None):
    print(f"Downloading {output}...")
    ctx = ssl.create_default_context()
    req = urllib.request.Request(url)
    resp = urllib.request.urlopen(req, context=ctx, timeout=300)

    total = int(resp.headers.get("Content-Length", 0))
    downloaded = 0
    md5 = hashlib.md5()

    with open(output, "wb") as f:
        while True:
            chunk = resp.read(1024 * 1024)
            if not chunk:
                break
            f.write(chunk)
            md5.update(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded * 100 // total
                print(f"\r  {downloaded // (1024*1024)}MB / {total // (1024*1024)}MB ({pct}%)", end="", flush=True)

    print()
    actual_md5 = md5.hexdigest()
    if expected_md5:
        if actual_md5 == expected_md5:
            print(f"  MD5 OK: {actual_md5}")
        else:
            print(f"  MD5 MISMATCH! Expected {expected_md5}, got {actual_md5}", file=sys.stderr)
    else:
        print(f"  MD5: {actual_md5}")


def main():
    parser = argparse.ArgumentParser(description="Download Potensic Atom 2 firmware")
    parser.add_argument("--email", required=True, help="Potensic account email")
    parser.add_argument("--password", required=True, help="Potensic account password")
    parser.add_argument("--flight-sn", required=True, help="Drone serial number")
    parser.add_argument("--rc-sn", required=True, help="Remote controller serial number")
    parser.add_argument("--flight-version", default="V001", help="Current flight firmware version (default: V001)")
    parser.add_argument("--rc-version", default="V001", help="Current RC firmware version (default: V001)")
    parser.add_argument("--output-dir", default=".", help="Output directory")
    parser.add_argument("--check-only", action="store_true", help="Only check for updates, don't download")
    args = parser.parse_args()

    token = login(args.email, args.password)

    # Check for updates
    check = check_upgrade(token, args.flight_sn, args.rc_sn, args.flight_version, args.rc_version)
    if check.get("code") != 0:
        print(f"Check failed: {check.get('message')}", file=sys.stderr)
        sys.exit(1)

    data = check["data"]
    print(f"Firmware update available: {data.get('hasNewFirmVersion', False)}")
    print(f"App update available: {data.get('hasNewAppVersion', False)}")

    if args.check_only:
        return

    # Get download URLs
    upgrade = get_upgrade(token, args.flight_sn, args.rc_sn, args.flight_version, args.rc_version)
    if upgrade.get("code") != 0:
        print(f"Upgrade request failed: {upgrade.get('message')}", file=sys.stderr)
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)
    upgrade_data = upgrade["data"]

    for pkg_name in ["flightPkg", "rcPkg"]:
        pkg = upgrade_data.get(pkg_name)
        if pkg and pkg.get("downloadUrl"):
            url = pkg["downloadUrl"]
            filename = pkg.get("fileName", f"{pkg_name}.bin")
            output = os.path.join(args.output_dir, filename)
            print(f"\n{pkg['name']} v{pkg['version']} ({pkg['fileSize']} bytes)")
            download_file(url, output, pkg.get("md5"))


if __name__ == "__main__":
    main()
