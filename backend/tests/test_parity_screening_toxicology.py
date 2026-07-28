"""Parity tests: /api/screening and /api/toxicology."""


def test_screening_requires_existing_chemical(client):
    res = client.post("/api/screening", json={"chemical_id": "NOPE", "assay_name": "Cytotox"})
    assert res.status_code == 400
    assert res.json() == {
        "error": "Chemical not found. Screening data must be linked to an existing chemical."
    }


def test_screening_crud_and_enrichment(seeded_client):
    res = seeded_client.post(
        "/api/screening",
        json={"chemical_id": "CHEM-TEST-001", "assay_name": "Cytotoxicity", "result": "Positive"},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["message"] == "Screening data added successfully"
    record_id = body["id"]

    # GET one — enriched with chemical_name
    doc = seeded_client.get(f"/api/screening/{record_id}").json()
    assert doc["chemical_name"] == "Caffeine"
    assert doc["assay_name"] == "Cytotoxicity"

    # GET list — enriched, paginated envelope
    listing = seeded_client.get("/api/screening").json()
    assert listing["pagination"]["total"] == 1
    assert listing["data"][0]["chemical_name"] == "Caffeine"

    # Filter by chemical_id query param
    filtered = seeded_client.get("/api/screening", params={"chemical_id": "OTHER"}).json()
    assert filtered["pagination"]["total"] == 0

    # by-chemical endpoint returns RAW records (no chemical_name key)
    raw = seeded_client.get("/api/screening/chemical/CHEM-TEST-001").json()
    assert len(raw) == 1
    assert "chemical_name" not in raw[0]

    # Update merges arbitrary keys
    res = seeded_client.put(f"/api/screening/{record_id}", json={"result": "Negative"})
    assert res.json() == {"message": "Screening data updated successfully"}

    # Delete
    res = seeded_client.delete(f"/api/screening/{record_id}")
    assert res.json() == {"message": "Screening data deleted successfully"}
    assert seeded_client.get(f"/api/screening/{record_id}").status_code == 404


def test_screening_unknown_chemical_shows_unknown_name(seeded_client):
    seeded_client.post(
        "/api/screening",
        json={"chemical_id": "CHEM-TEST-001", "assay_name": "A"},
    )
    seeded_client.delete("/api/chemicals/CHEM-TEST-001")
    listing = seeded_client.get("/api/screening").json()
    assert listing["data"][0]["chemical_name"] == "Unknown"


def test_toxicology_requires_existing_chemical(client):
    res = client.post("/api/toxicology", json={"chemical_id": "NOPE", "study_type": "Acute"})
    assert res.status_code == 400
    assert res.json() == {
        "error": "Chemical not found. Toxicology data must be linked to an existing chemical."
    }


def test_toxicology_crud(seeded_client):
    res = seeded_client.post(
        "/api/toxicology",
        json={
            "chemical_id": "CHEM-TEST-001",
            "study_type": "Acute Toxicity",
            "species": "Rat",
            "ld50": 192,
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["message"] == "Toxicology data added successfully"
    record_id = body["id"]

    doc = seeded_client.get(f"/api/toxicology/{record_id}").json()
    assert doc["chemical_name"] == "Caffeine"
    assert doc["ld50"] == 192
    assert doc["strain"] is None  # absent field → null

    raw = seeded_client.get("/api/toxicology/chemical/CHEM-TEST-001").json()
    assert len(raw) == 1 and "chemical_name" not in raw[0]

    listing = seeded_client.get("/api/toxicology", params={"search": "rat"}).json()
    assert listing["pagination"]["total"] == 1

    res = seeded_client.delete(f"/api/toxicology/{record_id}")
    assert res.json() == {"message": "Toxicology data deleted successfully"}
