"""Parity tests: /api/chemicals must match the Express contract exactly.

Every expectation in this file was derived from server/src/routes/chemicals.js
and API.md — response keys, messages, and status codes are asserted verbatim.
"""

import io

from openpyxl import Workbook

from .conftest import CHEM

# The exact key set Express produces for a manually POSTed chemical.
EXPRESS_POST_KEYS = {
    "id", "chemical_id", "nestle_id", "name", "cas_number", "molecular_formula",
    "molecular_weight", "smiles", "inchi", "inchi_key", "supplier", "description",
    "metadata", "created_at", "updated_at",
}


def test_create_chemical(client):
    res = client.post("/api/chemicals", json=CHEM)
    assert res.status_code == 201
    assert res.json() == {
        "message": "Chemical added successfully",
        "chemical_id": "CHEM-TEST-001",
    }


def test_duplicate_chemical_id_rejected(seeded_client):
    res = seeded_client.post("/api/chemicals", json=CHEM)
    assert res.status_code == 400
    assert res.json() == {"error": "Chemical ID already exists"}


def test_get_by_id_shape(seeded_client):
    res = seeded_client.get("/api/chemicals/CHEM-TEST-001")
    assert res.status_code == 200
    doc = res.json()
    # Key-set parity: exactly the keys Express writes, no more, no less.
    assert set(doc.keys()) == EXPRESS_POST_KEYS
    assert doc["name"] == "Caffeine"
    assert doc["nestle_id"] is None  # absent in request → null, like Express
    # Timestamps in JS toISOString format (ms + Z)
    assert doc["created_at"].endswith("Z")
    assert len(doc["created_at"]) == 24


def test_get_unknown_returns_404(client):
    res = client.get("/api/chemicals/NOPE-999")
    assert res.status_code == 404
    assert res.json() == {"error": "Chemical not found"}


def test_list_pagination_shape(seeded_client):
    res = seeded_client.get("/api/chemicals", params={"page": 1, "limit": 20})
    assert res.status_code == 200
    body = res.json()
    assert set(body.keys()) == {"data", "pagination"}
    assert body["pagination"] == {"page": 1, "limit": 20, "total": 1, "totalPages": 1}
    assert body["data"][0]["chemical_id"] == "CHEM-TEST-001"


def test_list_defaults_and_zero_page_quirk(seeded_client):
    # Express: parseInt(page) || 1 — page=0 falls back to 1 (JS falsy quirk).
    res = seeded_client.get("/api/chemicals", params={"page": 0, "limit": 0})
    assert res.json()["pagination"]["page"] == 1
    assert res.json()["pagination"]["limit"] == 50


def test_search_by_name_and_cas(seeded_client):
    seeded_client.post("/api/chemicals", json={"chemical_id": "CHEM-X", "name": "Aspirin"})
    res = seeded_client.get("/api/chemicals", params={"search": "caffe"})
    assert [c["chemical_id"] for c in res.json()["data"]] == ["CHEM-TEST-001"]
    res = seeded_client.get("/api/chemicals", params={"search": "58-08"})
    assert res.json()["pagination"]["total"] == 1


def test_dropdown_sorted_by_name(seeded_client):
    seeded_client.post("/api/chemicals", json={"chemical_id": "CHEM-X", "name": "Aspirin"})
    res = seeded_client.get("/api/chemicals/list/dropdown")
    assert res.status_code == 200
    assert res.json() == [
        {"chemical_id": "CHEM-X", "name": "Aspirin"},
        {"chemical_id": "CHEM-TEST-001", "name": "Caffeine"},
    ]


def test_update_merges_arbitrary_fields(seeded_client):
    res = seeded_client.put(
        "/api/chemicals/CHEM-TEST-001",
        json={"supplier": "Sigma", "custom_field": "kept"},
    )
    assert res.status_code == 200
    assert res.json() == {"message": "Chemical updated successfully"}
    doc = seeded_client.get("/api/chemicals/CHEM-TEST-001").json()
    assert doc["supplier"] == "Sigma"
    assert doc["custom_field"] == "kept"  # Express .assign keeps unknown keys


def test_update_unknown_404(client):
    res = client.put("/api/chemicals/NOPE", json={"supplier": "X"})
    assert res.status_code == 404
    assert res.json() == {"error": "Chemical not found"}


def test_delete_chemical(seeded_client):
    res = seeded_client.delete("/api/chemicals/CHEM-TEST-001")
    assert res.json() == {"message": "Chemical deleted successfully"}
    assert seeded_client.get("/api/chemicals/CHEM-TEST-001").status_code == 404


def test_bulk_delete(seeded_client):
    seeded_client.post("/api/chemicals", json={"chemical_id": "CHEM-X", "name": "X"})
    res = seeded_client.post(
        "/api/chemicals/bulk/delete",
        json={"chemical_ids": ["CHEM-TEST-001", "CHEM-X", "MISSING"]},
    )
    assert res.json() == {
        "message": "Successfully deleted 2 chemicals",
        "deleted": 2,
        "requested": 3,
    }


def test_bulk_delete_validation(client):
    res = client.post("/api/chemicals/bulk/delete", json={"chemical_ids": []})
    assert res.status_code == 400
    assert res.json() == {"error": "No chemical IDs provided"}


def test_bulk_update_protects_identity_fields(seeded_client):
    res = seeded_client.post(
        "/api/chemicals/bulk/update",
        json={
            "chemical_ids": ["CHEM-TEST-001"],
            "updates": {"supplier": "Merck", "chemical_id": "HACK", "id": "HACK"},
        },
    )
    assert res.json() == {
        "message": "Successfully updated 1 chemicals",
        "updated": 1,
        "requested": 1,
    }
    doc = seeded_client.get("/api/chemicals/CHEM-TEST-001").json()
    assert doc["supplier"] == "Merck"
    assert doc["chemical_id"] == "CHEM-TEST-001"  # identity preserved


def test_bulk_update_validation(seeded_client):
    res = seeded_client.post(
        "/api/chemicals/bulk/update", json={"chemical_ids": ["X"], "updates": {}}
    )
    assert res.status_code == 400
    assert res.json() == {"error": "No updates provided"}


def test_clear_all(seeded_client):
    res = seeded_client.delete("/api/chemicals/all/clear")
    assert res.json() == {"message": "Successfully deleted all 1 chemicals", "deleted": 1}
    assert seeded_client.get("/api/chemicals").json()["pagination"]["total"] == 0


def _xlsx_bytes(rows: list[list], headers: list[str]) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.append(headers)
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_excel_upload_insert_and_update(client):
    headers = ["DTX_ID", "NESTLE_ID", "CHEMICAL_NAME", "CAS_NO", "MOL_WEIGHT_ORIG", "MOL_FORMULA", "Supplier_ref"]
    content = _xlsx_bytes(
        [["CHEM-E1", "NST-1", "Excelium", "12-34-5", 100.5, "C2H6", "Sigma"]], headers
    )
    res = client.post(
        "/api/chemicals/upload/excel",
        files={"file": ("chems.xlsx", content, "application/vnd.ms-excel")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["message"] == "Successfully processed 1 chemicals (1 new, 0 updated)"
    assert body["inserted"] == 1 and body["updated"] == 0 and body["total"] == 1
    assert "errors" not in body  # Express omits the key when empty

    doc = client.get("/api/chemicals/CHEM-E1").json()
    assert doc["name"] == "Excelium"
    assert doc["cas_number"] == "12-34-5"
    assert doc["molecular_weight"] == 100.5
    assert doc["metadata"]["DTX_ID"] == "CHEM-E1"  # full row preserved

    # Re-upload → update, not duplicate
    res = client.post(
        "/api/chemicals/upload/excel",
        files={"file": ("chems.xlsx", content, "application/vnd.ms-excel")},
    )
    assert res.json()["message"] == "Successfully processed 1 chemicals (0 new, 1 updated)"


def test_csv_upload_preserves_cas_strings(client):
    csv_data = "chemical_id,Name,cas_number\nCHEM-C1,CSVium,58-08-2\n"
    res = client.post(
        "/api/chemicals/upload/excel",
        files={"file": ("chems.csv", csv_data.encode(), "text/csv")},
    )
    assert res.status_code == 200
    doc = client.get("/api/chemicals/CHEM-C1").json()
    assert doc["cas_number"] == "58-08-2"  # not mangled into a date serial


def test_upload_without_file_400(client):
    res = client.post("/api/chemicals/upload/excel")
    assert res.status_code == 400
    assert res.json() == {"error": "No file uploaded"}
