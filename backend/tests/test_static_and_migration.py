"""Static serving, SPA fallback, and the lowdb migration script."""

import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent


def test_architecture_page(client):
    res = client.get("/architecture")
    # Served when docs/ is present (repo checkout); 404 otherwise.
    if res.status_code == 200:
        assert "text/html" in res.headers["content-type"]
    else:
        assert res.status_code == 404


def test_spa_fallback_serves_index_for_unknown_routes(client):
    res = client.get("/chemicals/upload")  # a React Router path, not an API one
    if res.status_code == 200:
        assert "text/html" in res.headers["content-type"]
        assert "Crucible" in res.text
    else:
        # No client build present in this checkout
        assert res.status_code == 404


def _run_migration(env: dict, source: Path) -> str:
    result = subprocess.run(
        [sys.executable, str(BACKEND_DIR / "scripts" / "migrate_from_lowdb.py"),
         "--source", str(source)],
        capture_output=True,
        text=True,
        env=env,
        cwd=BACKEND_DIR,
        check=True,
    )
    return result.stdout


def test_migration_is_idempotent(tmp_path):
    lowdb = {
        "chemicals": [
            {"id": "u1", "chemical_id": "MIG-1", "name": "Migrated",
             "created_at": "2026-01-01T00:00:00.000Z"},
        ],
        "samples": [
            {"id": "u2", "sample_id": "SMP-1", "name": "Sample",
             "created_at": "2026-01-01T00:00:00.000Z"},
        ],
        "screening": [],
        "toxicology": [],
    }
    source = tmp_path / "pandora.json"
    source.write_text(json.dumps(lowdb))

    env = dict(os.environ)
    env["DATABASE_URL"] = f"sqlite:///{tmp_path / 'migrated.db'}"

    out1 = _run_migration(env, source)
    assert "chemicals" in out1 and "Migration complete" in out1

    # Second run: everything already present → 0 inserted, 0 updated.
    out2 = _run_migration(env, source)
    for line in out2.splitlines():
        if line.startswith(("chemicals", "samples")):
            cols = line.split()
            assert cols[2] == "0", f"expected 0 inserted on re-run: {line}"
            assert cols[3] == "0", f"expected 0 updated on re-run: {line}"
