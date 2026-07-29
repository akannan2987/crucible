"""Container healthcheck — probes /api/stats over HTTP, then HTTPS.

Used by the Dockerfile HEALTHCHECK. Targets 127.0.0.1 on purpose:
in-container `localhost` resolves to ::1 while uvicorn binds IPv4.
The HTTPS attempt skips certificate verification (self-signed certs are
fine for a loopback liveness probe).
"""

import os
import ssl
import sys
import urllib.request

port = os.environ.get("PORT", "49160")


def alive(url: str, ctx: ssl.SSLContext | None = None) -> bool:
    try:
        return urllib.request.urlopen(url, timeout=8, context=ctx).status == 200
    except Exception:
        return False


if alive(f"http://127.0.0.1:{port}/api/stats") or alive(
    f"https://127.0.0.1:{port}/api/stats", ssl._create_unverified_context()
):
    sys.exit(0)
sys.exit(1)
