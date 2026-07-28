"""Parity tests: /api/stats and the dashboard sub-endpoints."""


def test_stats_shape_and_percentage_string(seeded_client):
    res = seeded_client.get("/api/stats")
    assert res.status_code == 200
    body = res.json()

    assert set(body.keys()) == {
        "chemicals", "samples", "screening", "toxicology",
        "counts", "capacities", "lastUpdated",
    }
    assert body["chemicals"] == {"total": 1, "max": 15000}
    assert body["samples"] == {"total": 0, "max": 1000}
    assert body["counts"] == {"chemicals": 1, "samples": 0, "screening": 0, "toxicology": 0}

    cap = body["capacities"]["chemicals"]
    # percentage is a STRING with one decimal — JS toFixed(1) parity.
    assert cap == {"current": 1, "max": 15000, "percentage": "0.0"}
    assert isinstance(cap["percentage"], str)

    assert body["lastUpdated"].endswith("Z")


def test_recent_activity(seeded_client):
    seeded_client.post(
        "/api/screening",
        json={"chemical_id": "CHEM-TEST-001", "assay_name": "Assay-A"},
    )
    res = seeded_client.get("/api/stats/recent", params={"limit": 5})
    items = res.json()
    assert len(items) == 2
    types = {i["type"] for i in items}
    assert types == {"chemical", "screening"}
    screening_item = next(i for i in items if i["type"] == "screening")
    assert screening_item["name"] == "Assay-A"
    assert screening_item["chemical_id"] == "CHEM-TEST-001"


def test_chemicals_summary(seeded_client):
    seeded_client.post(
        "/api/screening", json={"chemical_id": "CHEM-TEST-001", "assay_name": "A"}
    )
    res = seeded_client.get("/api/stats/chemicals-summary")
    rows = res.json()
    assert len(rows) == 1
    row = rows[0]
    assert set(row.keys()) == {
        "chemical_id", "name", "cas_number", "molecular_formula",
        "screening_count", "toxicology_count", "created_at",
    }
    assert row["screening_count"] == 1
    assert row["toxicology_count"] == 0


def test_distributions(seeded_client):
    seeded_client.post("/api/samples", json={"sample_id": "S-1", "sample_type": "Plasma"})
    seeded_client.post("/api/samples", json={"sample_id": "S-2"})
    res = seeded_client.get("/api/stats/sample-types")
    assert sorted(res.json(), key=lambda d: d["type"]) == [
        {"type": "Plasma", "count": 1},
        {"type": "Unknown", "count": 1},
    ]

    seeded_client.post("/api/screening", json={"chemical_id": "CHEM-TEST-001", "assay_name": "A1"})
    res = seeded_client.get("/api/stats/assay-types")
    assert res.json() == [{"assay": "A1", "count": 1}]

    seeded_client.post("/api/toxicology", json={"chemical_id": "CHEM-TEST-001", "study_type": "Acute"})
    res = seeded_client.get("/api/stats/study-types")
    assert res.json() == [{"study": "Acute", "count": 1}]
