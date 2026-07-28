"""Parity tests: SDF upload (RDKit-backed) — /api/chemicals/upload/sdf."""

# A minimal but spec-valid V2000 SDF with two records:
#  1. one carbon atom + rich data items (tests field mapping + metadata)
#  2. a mixture record identified only by its SMILES property
SDF_CONTENT = """test-mol
  Crucible test

  1  0  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
M  END
>  <COMPOUND_ID>
SDF-TEST-1

>  <CHEMICAL_NAME>
Testium

>  <CAS_NUMBER>
74-82-8

>  <SMILES>
C

>  <Present in PLASTIC>
yes

$$$$
mixture-mol
  Crucible test

  1  0  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
M  END
>  <COMPOUND_ID>
SDF-TEST-2

>  <SMILES>
CCO.O

$$$$
"""


def _upload(client, content: str):
    return client.post(
        "/api/chemicals/upload/sdf",
        files={"file": ("test.sdf", content.encode(), "chemical/x-mdl-sdfile")},
    )


def test_sdf_upload_response_shape(client):
    res = _upload(client, SDF_CONTENT)
    assert res.status_code == 200
    body = res.json()
    assert body["message"] == "Successfully processed 2 chemicals from SDF (2 new, 0 updated)"
    assert body["inserted"] == 2
    assert body["updated"] == 0
    assert body["total"] == 2
    assert body["totalRecords"] == 2
    assert body["summary"] == {
        "recordsInFile": 2,
        "successfullyProcessed": 2,
        "parseErrors": 0,
        "insertErrors": 0,
    }
    assert "errors" not in body  # omitted when empty, like Express


def test_sdf_field_mapping_and_metadata(client):
    _upload(client, SDF_CONTENT)
    doc = client.get("/api/chemicals/SDF-TEST-1").json()
    assert doc["name"] == "Testium"
    assert doc["cas_number"] == "74-82-8"
    assert doc["smiles"] == "C"
    # Tier 2: EVERY data item preserved verbatim in metadata
    assert doc["metadata"]["Present in PLASTIC"] == "yes"
    # The original MOL block is stored, not an RDKit re-rendering
    assert doc["mol_block"].startswith("test-mol")
    assert "M  END" in doc["mol_block"]
    # Tier 3: structural intelligence present with the documented keys
    assert set(doc["structural"].keys()) == {
        "isPolymer", "polymerLabels", "isMixture", "componentCount",
        "hasStereochemistry", "stereoAtomCount", "stereoBondCount",
        "totalCharge", "chargedAtomCount", "radicalCount",
        "sGroupCount", "sGroupTypes",
    }
    assert doc["structural"]["isMixture"] is False
    # Express persists `structural` but NOT the mapper's internal
    # `_computed`/`_warnings` diagnostics — key-set parity matters here.
    assert "_computed" not in doc
    assert "_warnings" not in doc


def test_sdf_mixture_detection(client):
    _upload(client, SDF_CONTENT)
    doc = client.get("/api/chemicals/SDF-TEST-2").json()
    assert doc["structural"]["isMixture"] is True
    assert doc["structural"]["componentCount"] == 2


def test_sdf_reupload_updates_not_duplicates(client):
    _upload(client, SDF_CONTENT)
    res = _upload(client, SDF_CONTENT)
    body = res.json()
    assert body["message"] == "Successfully processed 2 chemicals from SDF (0 new, 2 updated)"
    assert client.get("/api/chemicals").json()["pagination"]["total"] == 2


def test_invalid_sdf_rejected(client):
    res = _upload(client, "this is not an sdf file at all")
    assert res.status_code == 400
    assert res.json() == {
        "error": (
            "No valid molecules found in the SDF file. Ensure the file follows "
            "the V2000/V3000 SDF format with $$$$ record delimiters."
        )
    }


def test_sdf_no_file_400(client):
    res = client.post("/api/chemicals/upload/sdf")
    assert res.status_code == 400
    assert res.json() == {"error": "No file uploaded"}
