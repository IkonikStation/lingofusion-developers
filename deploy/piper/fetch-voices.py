#!/usr/bin/env python3
"""Install the exact Piper models and model cards listed in the catalog."""
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile


def install_asset(url, destination, expected):
    if destination.is_file():
        with destination.open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() == expected:
                return
    with tempfile.NamedTemporaryFile(dir=destination.parent, delete=False) as temporary:
        staging = Path(temporary.name)
    try:
        subprocess.run([
            "curl", "--fail", "--silent", "--show-error", "--location",
            "--proto", "=https", "--proto-redir", "=https", "--retry", "3",
            "--connect-timeout", "15", "--max-time", "240", "--output", staging, url,
        ], check=True)
        with staging.open("rb") as source:
            if hashlib.file_digest(source, "sha256").hexdigest() != expected:
                raise ValueError(f"Checksum mismatch for {destination.name}")
        staging.chmod(0o644)
        os.replace(staging, destination)
    finally:
        staging.unlink(missing_ok=True)


def main():
    catalog_file, output_dir = map(Path, sys.argv[1:])
    catalog = json.loads(catalog_file.read_text())
    for voice in catalog["voices"]:
        model = f"{voice['id']}.onnx"
        directory = output_dir / voice["id"]
        directory.mkdir(parents=True, exist_ok=True)
        base = f"https://huggingface.co/rhasspy/piper-voices/resolve/{catalog['revision']}/{voice['directory']}"
        for name, checksum_key in (
            (model, "modelSha256"), (f"{model}.json", "configSha256"), ("MODEL_CARD", "cardSha256"),
        ):
            install_asset(f"{base}/{name}", directory / name, voice[checksum_key])
        print(f"Verified {voice['id']}", flush=True)


if __name__ == "__main__":
    main()
