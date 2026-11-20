#!/usr/bin/env python3
"""Check Piper readiness on the locally bound Piper container."""
import http.client
import json
import os
import re
from urllib.parse import urlsplit


def main():
    port = os.environ.get("PIPER_PORT", "8788")
    origin = urlsplit(os.environ.get("PIPER_ORIGIN", f"http://127.0.0.1:{port}"))
    token = os.environ.get("PIPER_API_TOKEN", "")
    if not re.fullmatch(r"[a-f0-9]{64}", token):
        raise SystemExit("Set PIPER_API_TOKEN before running this check.")
    if not origin.hostname or origin.username or origin.password or origin.path not in ("", "/") or origin.query or origin.fragment:
        raise SystemExit("PIPER_ORIGIN must contain only the scheme, hostname and optional port.")
    headers = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    if origin.scheme != "http" or origin.hostname != "127.0.0.1":
        raise SystemExit("Use loopback HTTP for the local readiness check.")
    connection = http.client.HTTPConnection(origin.hostname, origin.port, timeout=10)
    try:
        connection.request("GET", "/healthz", headers=headers)
        response = connection.getresponse()
        if response.status != 200:
            raise SystemExit(f"Piper health check failed (HTTP {response.status}).")
        result = json.loads(response.read(8192))
        if result.get("status") != "ok" or not result.get("voices") or set(result.get("formats", [])) != {"mp3", "wav"}:
            raise SystemExit("Piper returned an invalid readiness response.")
        print(f"Piper is ready with {len(result['voices'])} voices and MP3/WAV encoders.")
    finally:
        connection.close()


if __name__ == "__main__":
    main()
