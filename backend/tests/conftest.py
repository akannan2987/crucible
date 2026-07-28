"""Shared pytest fixtures.

The important trick: DATABASE_URL must point at a throwaway SQLite file
BEFORE any app module is imported (config.py reads the env var at import
time). pytest imports conftest.py first, so we set it here at the top.
"""

import os
import tempfile
from pathlib import Path

_TMP_DIR = tempfile.mkdtemp(prefix="crucible-test-")
os.environ["DATABASE_URL"] = f"sqlite:///{Path(_TMP_DIR) / 'test.db'}"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.database import Base, engine  # noqa: E402
from app.main import app  # noqa: E402


@pytest.fixture()
def client():
    """A TestClient backed by a FRESH database for every test.

    Dropping and re-creating all tables between tests keeps them independent
    (the equivalent of Express tests resetting the lowdb JSON file).
    """
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    # raise_server_exceptions=False lets our 500 {"error": ...} handler run
    # instead of the exception bubbling into the test.
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


CHEM = {
    "chemical_id": "CHEM-TEST-001",
    "name": "Caffeine",
    "cas_number": "58-08-2",
    "molecular_formula": "C8H10N4O2",
    "molecular_weight": 194.19,
}


@pytest.fixture()
def seeded_client(client):
    """Client with one chemical already inserted."""
    res = client.post("/api/chemicals", json=CHEM)
    assert res.status_code == 201
    return client
