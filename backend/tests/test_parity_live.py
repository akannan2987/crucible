"""OPTIONAL live parity diff: run the SAME requests against the Express and
FastAPI servers and compare the responses.

Skipped unless both servers are running and their URLs are exported:

    # terminal 1: Node backend        (uses server/data/pandora.json)
    cd server && PORT=49160 npm start
    # terminal 2: Python backend      (uses its own SQLite db)
    cd backend && PORT=8000 .venv/bin/python -m app.main
    # terminal 3:
    EXPRESS_URL=http://localhost:49160 FASTAPI_URL=http://localhost:8000 \
        .venv/bin/pytest tests/test_parity_live.py -v

The scenario only touches records it creates itself (LIVE-PARITY-* ids), so
it is safe to run against servers holding real data; volatile fields
(id/timestamps) are normalised before diffing.
"""

import os

import httpx
import pytest

EXPRESS_URL = os.environ.get("EXPRESS_URL")
FASTAPI_URL = os.environ.get("FASTAPI_URL")

pytestmark = pytest.mark.skipif(
    not (EXPRESS_URL and FASTAPI_URL),
    reason="set EXPRESS_URL and FASTAPI_URL to run the live parity diff",
)

VOLATILE_KEYS = {"id", "created_at", "updated_at", "lastUpdated"}
CHEM_ID = "LIVE-PARITY-001"


def _normalise(value):
    """Strip volatile keys recursively so stable structure is compared."""
    if isinstance(value, dict):
        return {k: _normalise(v) for k, v in value.items() if k not in VOLATILE_KEYS}
    if isinstance(value, list):
        return [_normalise(v) for v in value]
    return value


def _both(method: str, path: str, **kwargs):
    """Fire the same request at both backends; return (express, fastapi)."""
    a = httpx.request(method, EXPRESS_URL + path, **kwargs)
    b = httpx.request(method, FASTAPI_URL + path, **kwargs)
    return a, b


def _assert_same(a: httpx.Response, b: httpx.Response):
    assert a.status_code == b.status_code, f"{a.status_code} != {b.status_code}: {a.text} / {b.text}"
    assert _normalise(a.json()) == _normalise(b.json())


def test_live_full_chemical_lifecycle():
    # Clean slate on both (delete may 404 on one side — ignore)
    _both("DELETE", f"/api/chemicals/{CHEM_ID}")

    _assert_same(*_both(
        "POST", "/api/chemicals",
        json={"chemical_id": CHEM_ID, "name": "Live Parity", "cas_number": "0-00-0"},
    ))
    _assert_same(*_both("POST", "/api/chemicals", json={"chemical_id": CHEM_ID, "name": "dup"}))
    _assert_same(*_both("GET", f"/api/chemicals/{CHEM_ID}"))
    _assert_same(*_both("PUT", f"/api/chemicals/{CHEM_ID}", json={"supplier": "ACME", "custom": 1}))
    _assert_same(*_both("GET", f"/api/chemicals/{CHEM_ID}"))
    _assert_same(*_both(
        "POST", "/api/chemicals/bulk/update",
        json={"chemical_ids": [CHEM_ID], "updates": {"supplier": "Sigma"}},
    ))
    _assert_same(*_both("GET", "/api/chemicals/NON-EXISTENT-RECORD"))
    _assert_same(*_both("POST", "/api/chemicals/bulk/delete", json={"chemical_ids": []}))
    _assert_same(*_both("DELETE", f"/api/chemicals/{CHEM_ID}"))
    _assert_same(*_both("DELETE", f"/api/chemicals/{CHEM_ID}"))  # now 404 on both


def test_live_screening_validation_parity():
    _assert_same(*_both(
        "POST", "/api/screening",
        json={"chemical_id": "NON-EXISTENT-RECORD", "assay_name": "X"},
    ))


def test_live_stats_shape():
    a, b = _both("GET", "/api/stats")
    assert a.status_code == b.status_code == 200
    # Values differ (different databases) — compare structure only.
    assert set(a.json().keys()) == set(b.json().keys())
    assert isinstance(a.json()["capacities"]["chemicals"]["percentage"], str)
    assert isinstance(b.json()["capacities"]["chemicals"]["percentage"], str)
