"""Parity tests: /api/samples (including the SLIMS 3-row-header upload)."""

import io

from openpyxl import Workbook


def _slims_xlsx() -> bytes:
    """Build a minimal SLIMS 'Content record' workbook: config row,
    machine-key row, human-label row, then data rows."""
    wb = Workbook()
    ws = wb.active
    ws.title = "data"
    ws.append(["{json-config-blob}", "SLIMS export", "", "", "", "", ""])
    ws.append(
        ["cntn_barCode", "cntn_id", "cntn_fk_category", "cntn_cf_fk_sampleSubtype",
         "cntn_fk_status", "cntn_cf_receptionDate", "cntn_cf_fk_project"]
    )
    ws.append(["Barcode", "Id *", "Category", "Sample Subtype", "Status",
               "Reception Date", "NPDI number Project (opt)"])
    ws.append(["PIPM00617", "Ulterion 529HS coated on Alu", "Packaging", "Polymer",
               "Available", "01/05/2023", "DUND-103291 Buddy"])
    ws.append(["", "row without barcode", "", "", "", "", ""])
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def test_create_and_get_sample(client):
    res = client.post(
        "/api/samples",
        json={"sample_id": "S-1", "identification": "Test sample", "extra_key": "kept"},
    )
    assert res.status_code == 201
    assert res.json() == {"message": "Sample added successfully", "sample_id": "S-1"}

    doc = client.get("/api/samples/S-1").json()
    assert doc["sample_id"] == "S-1"
    assert doc["status"] == "active"  # Express default when not provided
    assert doc["extra_key"] == "kept"  # body is spread into the record


def test_duplicate_sample_rejected(client):
    client.post("/api/samples", json={"sample_id": "S-1"})
    res = client.post("/api/samples", json={"sample_id": "S-1"})
    assert res.status_code == 400
    assert res.json() == {"error": "Sample ID already exists"}


def test_slims_upload_parses_three_row_header(client):
    res = client.post(
        "/api/samples/upload/excel",
        files={"file": ("slims.xlsx", _slims_xlsx(), "application/vnd.ms-excel")},
    )
    assert res.status_code == 200
    body = res.json()
    assert body["message"] == "Successfully processed 1 samples (1 new, 0 updated), 1 skipped"
    assert body["inserted"] == 1 and body["updated"] == 0
    assert body["summary"]["rowsInFile"] == 2
    assert body["summary"]["skipped"] == 1
    assert body["summary"]["sheet"] == "data"

    doc = client.get("/api/samples/PIPM00617").json()
    assert doc["identification"] == "Ulterion 529HS coated on Alu"
    assert doc["content_type"] == "Packaging"
    assert doc["material_type"] == "Polymer"
    assert doc["status"] == "available"  # lower-cased
    assert doc["reception_date"] == "2023-05-01"  # DD/MM/YYYY → ISO
    assert doc["chemical_ids"] == []
    assert doc["metadata"]["cntn_barCode"] == "PIPM00617"  # raw SLIMS keys preserved


def test_slims_reupload_preserves_chemical_links(client, seeded_client):
    files = {"file": ("slims.xlsx", _slims_xlsx(), "application/vnd.ms-excel")}
    client.post("/api/samples/upload/excel", files=files)

    # Link a chemical manually in the app...
    res = client.put(
        "/api/samples/PIPM00617/chemicals",
        json={"chemical_ids": ["CHEM-TEST-001", "UNKNOWN-1", "CHEM-TEST-001", " "]},
    )
    body = res.json()
    assert body["message"] == "Linked 2 chemical(s) to sample PIPM00617"
    assert body["chemical_ids"] == ["CHEM-TEST-001", "UNKNOWN-1"]  # deduped, blanks dropped
    assert body["unknownChemicalIds"] == ["UNKNOWN-1"]

    # ...then re-upload: links must survive.
    res = client.post("/api/samples/upload/excel", files={"file": ("slims.xlsx", _slims_xlsx(), "application/vnd.ms-excel")})
    assert res.json()["updated"] == 1
    doc = client.get("/api/samples/PIPM00617").json()
    assert doc["chemical_ids"] == ["CHEM-TEST-001", "UNKNOWN-1"]


def test_link_chemicals_validation(client):
    client.post("/api/samples", json={"sample_id": "S-1"})
    res = client.put("/api/samples/S-1/chemicals", json={"chemical_ids": "not-a-list"})
    assert res.status_code == 400
    assert res.json() == {"error": "chemical_ids must be an array"}
    # No unknownChemicalIds key when everything is known/empty
    res = client.put("/api/samples/S-1/chemicals", json={"chemical_ids": []})
    assert "unknownChemicalIds" not in res.json()


def test_template_download(client):
    res = client.get("/api/samples/template/download")
    # The template ships with the repo; if present it must download as xlsx.
    if res.status_code == 200:
        assert res.headers["content-disposition"].startswith("attachment")
        assert "Upload_Sample_Template.xlsx" in res.headers["content-disposition"]
    else:
        assert res.status_code == 404
        assert res.json() == {"error": "Sample template file not found on server"}


def test_bulk_delete_and_clear(client):
    client.post("/api/samples", json={"sample_id": "S-1"})
    client.post("/api/samples", json={"sample_id": "S-2"})
    res = client.post("/api/samples/bulk/delete", json={"sample_ids": ["S-1", "NOPE"]})
    assert res.json() == {
        "message": "Successfully deleted 1 samples",
        "deleted": 1,
        "requested": 2,
    }
    res = client.delete("/api/samples/all/clear")
    assert res.json() == {"message": "Successfully deleted all 1 samples", "deleted": 1}


def test_sample_404s(client):
    assert client.get("/api/samples/NOPE").status_code == 404
    assert client.put("/api/samples/NOPE", json={}).status_code == 404
    assert client.delete("/api/samples/NOPE").status_code == 404
    assert client.put("/api/samples/NOPE/chemicals", json={"chemical_ids": []}).status_code == 404
