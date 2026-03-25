#!/usr/bin/env python3
"""
Extract modules from a Potensic DEPS firmware package.

Usage:
    python extract_modules.py firmware.bin [--output-dir modules/]
"""

import argparse
import hashlib
import json
import os
import struct
import sys


def extract(firmware_path: str, output_dir: str):
    with open(firmware_path, "rb") as f:
        magic = f.read(4)
        if magic != b"DEPS":
            print(f"Not a DEPS firmware file (magic: {magic})", file=sys.stderr)
            sys.exit(1)

        json_len = struct.unpack("<I", f.read(4))[0]
        manifest_raw = f.read(json_len)
        manifest = json.loads(manifest_raw)

        product = manifest.get("product_type", "unknown")
        version = manifest.get("version", "unknown")
        modules = manifest.get("modules", [])

        print(f"Product: {product}")
        print(f"Version: {version}")
        print(f"Modules: {len(modules)}")
        print()

        os.makedirs(output_dir, exist_ok=True)

        # Save manifest
        manifest_path = os.path.join(output_dir, "manifest.json")
        with open(manifest_path, "w") as mf:
            json.dump(manifest, mf, indent=2)
        print(f"Manifest saved to {manifest_path}")
        print()

        offset = 8 + json_len

        for m in modules:
            name = m["name"]
            size = m["size"]
            padded = m["padded_size"]
            expected_md5 = m["md5"]
            mod_type = m.get("type", "?")
            version = m.get("version", "?")
            dev_ids = m.get("dev_id", [])

            f.seek(offset)
            data = f.read(size)
            actual_md5 = hashlib.md5(data).hexdigest()

            # MD5 in manifest is for decrypted data, so mismatch is expected
            encrypted = actual_md5 != expected_md5

            out_path = os.path.join(output_dir, name)
            with open(out_path, "wb") as fw:
                fw.write(data)

            status = "encrypted" if encrypted else "OK"
            print(f"  [{mod_type:6s}] {name}")
            print(f"          v{version} | {size:,} bytes | dev_id={dev_ids} | {status}")

            offset += padded

        print(f"\nExtracted {len(modules)} modules to {output_dir}/")


def main():
    parser = argparse.ArgumentParser(description="Extract modules from DEPS firmware")
    parser.add_argument("firmware", help="Path to DEPS firmware .bin file")
    parser.add_argument("--output-dir", "-o", default="modules", help="Output directory")
    args = parser.parse_args()
    extract(args.firmware, args.output_dir)


if __name__ == "__main__":
    main()
