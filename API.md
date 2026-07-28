# API Documentation - Pandora Toolbox 2.0

Complete REST API reference for the Chemical and Sample Management System.

**Production URL (HTTPS):** `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api`  
**Development URL:** `http://localhost:5942/api`

> 🔒 **Note:** Production endpoints use HTTPS. Add `-k` flag to `curl` commands if using self-signed certificates. All examples below show production HTTPS URLs.

---

## Table of Contents

- [HTTP Methods Explained](#http-methods-explained)
- [Quick Start Guide](#quick-start-guide)
- [Overview](#overview)
- [Response Format](#response-format)
- [Statistics & Dashboard](#statistics--dashboard)
- [Chemicals](#chemicals)
- [Samples](#samples)
- [Screening](#screening)
- [Toxicology](#toxicology)
- [Error Codes](#error-codes)
- [Integration Examples](#integration-examples)

---

## HTTP Methods Explained

REST APIs use HTTP methods (also called "verbs") to perform different operations:

### GET - Retrieve Data
- **Purpose**: Read/retrieve data without modifying it
- **Use When**: Fetching lists, getting details of a single item
- **Has Body**: No
- **Examples**: 
  - Get all chemicals: `GET /chemicals`
  - Get one chemical: `GET /chemicals/CHEM-001`

### POST - Create New Data
- **Purpose**: Create new resources or trigger actions
- **Use When**: Adding new chemicals, uploading files, bulk operations
- **Has Body**: Yes (JSON or form data)
- **Examples**:
  - Add chemical: `POST /chemicals` with JSON body
  - Upload file: `POST /chemicals/upload/excel` with file

### PUT - Update Existing Data
- **Purpose**: Update/replace existing resources
- **Use When**: Editing chemical information
- **Has Body**: Yes (JSON with fields to update)
- **Examples**:
  - Update chemical: `PUT /chemicals/CHEM-001` with JSON body

### DELETE - Remove Data
- **Purpose**: Delete resources
- **Use When**: Removing chemicals or records
- **Has Body**: No (usually)
- **Examples**:
  - Delete chemical: `DELETE /chemicals/CHEM-001`
  - Delete all: `DELETE /chemicals/all/clear`

---

## Quick Start Guide

### Testing the API

**Option 1: Using cURL (Command Line)**
```bash
# GET request - List chemicals
curl "https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals"

# POST request - Add chemical
curl -X POST "https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals" \
  -H "Content-Type: application/json" \
  -d '{"chemical_id":"TEST-001","name":"Test Chemical"}'

# PUT request - Update chemical
curl -X PUT "https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals/TEST-001" \
  -H "Content-Type: application/json" \
  -d '{"supplier":"New Supplier"}'

# DELETE request - Remove chemical
curl -X DELETE "https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals/TEST-001"
```

**Option 2: Using Browser**
- GET requests can be tested directly in browser:
  - Navigate to: `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/stats`
  - Navigate to: `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals`

**Option 3: Using Postman**
1. Download Postman (free tool for API testing)
2. Create new request
3. Select method (GET, POST, PUT, DELETE)
4. Enter URL: `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals`
5. For POST/PUT: Add JSON body in "Body" tab
6. Click "Send"

**Option 4: Using JavaScript in Browser Console**
```javascript
// GET request
fetch('https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals')
  .then(res => res.json())
  .then(data => console.log(data));

// POST request
fetch('https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/api/chemicals', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({chemical_id: 'TEST-001', name: 'Test'})
})
  .then(res => res.json())
  .then(data => console.log(data));
```

---

## Overview

All API endpoints return JSON responses. The API supports:
- Pagination for list endpoints
- Search/filtering capabilities
- Bulk operations (delete, update)
- File uploads (Excel, SDF)

### Authentication

Currently, no authentication is required. Future versions will implement SSO.

### Rate Limiting

No rate limiting is currently enforced.

### Upload & Body Size Limits

| Limit | Value | Purpose |
|-------|-------|---------|
| JSON body | 50 MB | Maximum size for JSON payloads (POST/PUT requests) |
| File upload | 100 MB | Maximum size for Excel/SDF file uploads (via Multer) |
| Max chemicals | No hard limit* | Not capped by the API; optimized for 15,000+ records |
| Max samples | No hard limit* | Not capped by the API; optimized for 1,000+ records |
| Max screening | No hard limit* | Linked to chemicals; not capped |
| Max toxicology | No hard limit* | Linked to chemicals; not capped |

> \* No collection is capped by the API — all are bounded only by the single JSON file's read/write performance and available memory/disk. The 15,000 / 1,000 figures are recommended-scale references used for the dashboard gauge, **not** enforced limits.

### Non-API Routes

| Path | Description |
|------|-------------|
| `/` | React SPA (main application) |
| `/architecture` | Interactive architecture documentation page |

---

## Response Format

### Success Response

```json
{
  "data": {...},
  "message": "Operation successful"
}
```

### Paginated Response

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```

### Error Response

```json
{
  "error": "Error message description"
}
```

---

## Statistics & Dashboard

### Get Dashboard Statistics

Get real-time statistics for all modules.

**Endpoint:** `GET /stats`

**Response:**

```json
{
  "chemicals": {
    "total": 25,
    "max": 15000
  },
  "samples": {
    "total": 10,
    "max": 1000
  },
  "screening": {
    "total": 50
  },
  "toxicology": {
    "total": 30
  },
  "counts": {
    "chemicals": 25,
    "samples": 10,
    "screening": 50,
    "toxicology": 30
  },
  "capacities": {
    "chemicals": {
      "current": 25,
      "max": 15000,
      "percentage": "0.2"
    },
    "samples": {
      "current": 10,
      "max": 1000,
      "percentage": "1.0"
    }
  },
  "lastUpdated": "2026-02-08T10:30:00.000Z"
}
```

**cURL Example:**

```bash
curl http://localhost:5942/api/stats
```

---

## Chemicals

### List Chemicals

Get paginated list of all chemicals with optional search.

**Endpoint:** `GET /chemicals`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page (max: 100) |
| `search` | string | - | Search in name, ID, or CAS number |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "chemical_id": "CHEM-001",
      "nestle_id": "NST-12345",
      "name": "Caffeine",
      "cas_number": "58-08-2",
      "molecular_formula": "C8H10N4O2",
      "molecular_weight": 194.19,
      "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
      "inchi": "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
      "supplier": "Sigma-Aldrich",
      "created_at": "2026-02-08T10:00:00.000Z",
      "updated_at": "2026-02-08T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 25,
    "totalPages": 1
  }
}
```

**cURL Example:**

```bash
# Get all chemicals
curl "http://localhost:5942/api/chemicals?page=1&limit=20"

# Search chemicals
curl "http://localhost:5942/api/chemicals?search=caffeine"
```

---

### Get Single Chemical

Get details of a specific chemical by ID.

**Endpoint:** `GET /chemicals/:id`

**Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Chemical ID (e.g., CHEM-001) |

**Response:**

```json
{
  "id": "uuid",
  "chemical_id": "CHEM-001",
  "nestle_id": "NST-12345",
  "name": "Caffeine",
  "cas_number": "58-08-2",
  "molecular_formula": "C8H10N4O2",
  "molecular_weight": 194.19,
  "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
  "inchi": "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
  "supplier": "Sigma-Aldrich",
  "created_at": "2026-02-08T10:00:00.000Z",
  "updated_at": "2026-02-08T10:00:00.000Z"
}
```

**cURL Example:**

```bash
curl http://localhost:5942/api/chemicals/CHEM-001
```

---

### Get Chemicals Dropdown List

Get simplified list of chemicals for dropdown menus.

**Endpoint:** `GET /chemicals/list/dropdown`

**Response:**

```json
[
  {
    "chemical_id": "CHEM-001",
    "name": "Caffeine"
  },
  {
    "chemical_id": "CHEM-002",
    "name": "Aspirin"
  }
]
```

**cURL Example:**

```bash
curl http://localhost:5942/api/chemicals/list/dropdown
```

---

### Add Single Chemical

Add a new chemical to the database.

**Endpoint:** `POST /chemicals`

**Request Body:**

```json
{
  "chemical_id": "CHEM-001",
  "nestle_id": "NST-12345",
  "name": "Caffeine",
  "cas_number": "58-08-2",
  "molecular_formula": "C8H10N4O2",
  "molecular_weight": 194.19,
  "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
  "inchi": "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
  "supplier": "Sigma-Aldrich"
}
```

**Required Fields:**
- `chemical_id` (string)
- `name` (string)

**Response:**

```json
{
  "message": "Chemical added successfully",
  "chemical_id": "CHEM-001"
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:5942/api/chemicals \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "CHEM-001",
    "name": "Caffeine",
    "cas_number": "58-08-2",
    "molecular_formula": "C8H10N4O2",
    "molecular_weight": 194.19
  }'
```

---

### Update Chemical

Update an existing chemical.

**Endpoint:** `PUT /chemicals/:id`

**Request Body:**

```json
{
  "supplier": "New Supplier",
  "cas_number": "58-08-2",
  "molecular_weight": 194.19
}
```

**Response:**

```json
{
  "message": "Chemical updated successfully"
}
```

**cURL Example:**

```bash
curl -X PUT http://localhost:5942/api/chemicals/CHEM-001 \
  -H "Content-Type: application/json" \
  -d '{"supplier": "New Supplier"}'
```

---

### Delete Chemical

Delete a chemical by ID.

**Endpoint:** `DELETE /chemicals/:id`

**Response:**

```json
{
  "message": "Chemical deleted successfully"
}
```

**cURL Example:**

```bash
curl -X DELETE http://localhost:5942/api/chemicals/CHEM-001
```

---

### Upload Chemicals (Excel)

Bulk upload chemicals via Excel file.

**Endpoint:** `POST /chemicals/upload/excel`

**Content-Type:** `multipart/form-data`

**Form Data:**

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | Excel file (.xlsx, .xls, .csv) |

**Excel Format:**

| DTX_ID | NESTLE_ID | CHEMICAL_NAME | CAS_NO | MOL_WEIGHT_ORIG | MOL_FORMULA | Supplier_ref |
|--------|-----------|---------------|--------|-----------------|-------------|--------------|
| CHEM-001 | NST-001 | Caffeine | 58-08-2 | 194.19 | C8H10N4O2 | Sigma |

**Response:**

```json
{
  "message": "Successfully processed 25 chemicals (20 new, 5 updated)",
  "inserted": 20,
  "updated": 5,
  "total": 25,
  "errors": []
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:5942/api/chemicals/upload/excel \
  -F "file=@chemicals.xlsx"
```

---

### Upload Chemicals (SDF)

Bulk upload chemicals via SDF (Structure Data File). Supports both **V2000** and **V3000** molfile formats, including V3000 line continuations (`-` suffix) and S-Group records (`SRU`, `MUL`, `COP`, `MIX`, `SUP`).

The parser extracts structural data (atoms, bonds, coordinates, charges, stereo flags, S-Groups), computes molecular formula (Hill order) and molecular weight from the atom block, and maps over 50 common SDF property field-name variations to the Pandora schema. **Every** `> <FIELD_NAME>` data item is preserved in `metadata` — no field is ever dropped.

Validated against EPA DSSTox / Nestlé regulatory format (77-record fixture: 34 polymers, 36 mixtures, 18 charged-atom records, 6 stereo records). See [`docs/architecture.md`](docs/architecture.md#sdf-parser-serversrcutilssdfparserjs) for the full extraction matrix.

**Endpoint:** `POST /chemicals/upload/sdf`

**Content-Type:** `multipart/form-data`

**Form Data:**

| Field | Type | Description |
|-------|------|-------------|
| `file` | file | SDF file (.sdf) containing one or more molecule records separated by `$$$$` |

**Response:**

```json
{
  "message": "Successfully processed 3 chemicals from SDF (3 new, 0 updated)",
  "inserted": 3,
  "updated": 0,
  "total": 3,
  "totalRecords": 3,
  "summary": {
    "recordsInFile": 3,
    "successfullyProcessed": 3,
    "parseErrors": 0,
    "insertErrors": 0
  }
}
```

**Error Response (invalid SDF):**

```json
{
  "error": "No valid molecules found in the SDF file. Ensure the file follows the V2000/V3000 SDF format with $$$$ record delimiters."
}
```

**Tier 1 — Explicit named fields (promoted to top-level):**

| Pandora Field | Example SDF Property Names (case-insensitive) |
|---------------|-----------------------------------------------|
| `chemical_id` | `COMPOUND_ID`, `DTX_ID`, `DTXSID`, `PUBCHEM_COMPOUND_CID`, `CHEMBL_ID`, `REGISTRY_NUMBER` |
| `name` | `COMPOUND_NAME`, `CHEMICAL_NAME`, `Name`, `IUPAC_NAME`, `PREFERRED_NAME`, `TRADE_NAME` |
| `cas_number` | `CAS_NUMBER`, `CAS_NO`, `CAS`, `CASRN`, `CAS Registry Number` |
| `molecular_formula` | `MOLECULAR_FORMULA`, `MOL_FORMULA`, `Formula` *(or auto-computed from atom block)* |
| `molecular_weight` | `MOLECULAR_WEIGHT`, `MOL_WEIGHT`, `MW`, `EXACT_MASS` *(or auto-computed)* |
| `smiles` | `SMILES`, `CANONICAL_SMILES`, `ISOMERIC_SMILES`, `OPENEYE_ISO_SMILES` |
| `inchi` / `inchi_string` | `InChI`, `STANDARD_INCHI`, `INCHI_STRING`, `PUBCHEM_IUPAC_INCHI` |
| `inchi_key` | `InChIKey`, `STANDARD_INCHIKEY`, `PUBCHEM_IUPAC_INCHIKEY` |
| `dtxsid` | `DTXSID`, `DTX_ID`, `DTXID` |
| `preferred_name` | `PREFERRED_NAME`, `Preferred Name` |
| `monoisotopic_mass` | `MONOISOTOPIC_MASS`, `EXACT_MASS` |
| `ms_ready_smiles` | `MS_READY_SMILES`, `MS-Ready SMILES` |
| `synonyms` | `SYNONYMS / COMPOSITION`, `SYNONYMS`, `COMMON_NAMES` *(auto-split on `;`, `,`, newline)* |
| `supplier` | `Supplier`, `Vendor`, `SOURCE`, `Manufacturer` |
| `purity` | `PURITY`, `PERCENT_PURITY`, `ASSAY_PURITY` |
| `nestle_id` | `NESTLE_ID`, `Nestle ID` |

**Tier 2 — Catch-all metadata:**

Every other `> <FIELD_NAME>` block is preserved verbatim in `metadata`, including the 40+ EPA / Nestlé regulatory fields:
`Present in PLASTIC`, `Present in COATING`, `Present in INK`, `Present as NIAS`, `EU FCM substance code`, `EU PM substance code`, `Listed / Updated in EU plastic regulation`, `Restrictions and Specifications (SML in mg/kg)`, `ADI/TDI (mg/kg bw /day)`, `US FCS code`, `US FCN + TOR codes`, `US 21 CFR REGNum (list of articles)`, `Nestle policy (St-80.008 …)`, `Nestle safety-based level SBL (mg/kg food)`, `log P(o/w) (25°C)`, `RI from compilation (DB-5)`, `Color Index Code`, etc.

**Tier 3 — Structural intelligence (`structural` object on each record):**

| Property | Type | Meaning |
|----------|------|---------|
| `isPolymer` | bool | At least one `SRU` / `MUL` / `COP` / `CRO` S-Group |
| `polymerLabels` | string[] | SRU labels (`n`, `m`, `x`, ranges like `10-14`) |
| `isMixture` | bool | SMILES contains multiple disconnected components |
| `componentCount` | int | Number of `.`-separated components in SMILES |
| `hasStereochemistry` | bool | Atom CFG, bond wedge, or `STEABS/STEREL/STERAC` collection present |
| `stereoAtomCount` / `stereoBondCount` | int | Count of stereo atoms / bonds |
| `totalCharge` / `chargedAtomCount` | int | Sum and count of non-zero atom charges |
| `radicalCount` | int | Atoms flagged as radicals |
| `sGroupCount` / `sGroupTypes` | int / string[] | S-Group totals |

> **Note:** When a `chemical_id` is found in the SDF properties and matches an existing record, the chemical is **updated** rather than duplicated. All raw SDF properties are preserved in the `metadata` field — nothing is dropped.

**cURL Example:**

```bash
curl -X POST https://localhost:5942/api/chemicals/upload/sdf \
  -F "file=@chemicals.sdf"
```

---

### Bulk Delete Chemicals

Delete multiple chemicals at once.

**Endpoint:** `POST /chemicals/bulk/delete`

**Request Body:**

```json
{
  "chemical_ids": ["CHEM-001", "CHEM-002", "CHEM-003"]
}
```

**Response:**

```json
{
  "message": "Successfully deleted 3 chemicals",
  "deleted": 3,
  "requested": 3
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:5942/api/chemicals/bulk/delete \
  -H "Content-Type: application/json" \
  -d '{"chemical_ids": ["CHEM-001", "CHEM-002"]}'
```

---

### Bulk Update Chemicals

Update multiple chemicals with the same data.

**Endpoint:** `POST /chemicals/bulk/update`

**Request Body:**

```json
{
  "chemical_ids": ["CHEM-001", "CHEM-002"],
  "updates": {
    "supplier": "Sigma-Aldrich",
    "cas_number": "12345-67-8"
  }
}
```

**Response:**

```json
{
  "message": "Successfully updated 2 chemicals",
  "updated": 2,
  "requested": 2
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:5942/api/chemicals/bulk/update \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_ids": ["CHEM-001", "CHEM-002"],
    "updates": {"supplier": "Sigma-Aldrich"}
  }'
```

---

### Clear All Chemicals

**⚠️ DANGER:** Delete all chemicals from the database.

**Endpoint:** `DELETE /chemicals/all/clear`

**Response:**

```json
{
  "message": "Successfully deleted all 25 chemicals",
  "deleted": 25
}
```

**cURL Example:**

```bash
curl -X DELETE http://localhost:5942/api/chemicals/all/clear
```

---

## Samples

Samples are imported from the **SLIMS "Content record"** Excel export. A sample can be
linked to **several** chemicals via `chemical_ids` (linked manually in the app).

### List Samples

Get paginated list of all samples.

**Endpoint:** `GET /samples`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `limit` | integer | 50 | Items per page |
| `search` | string | - | Search in barcode, identification, project, content/material type |

**Response:**

```json
{
  "data": [
    {
      "id": "uuid",
      "sample_id": "PIPM00617",
      "name": "Ulterion 529HS coated on Alu",
      "identification": "Ulterion 529HS coated on Alu",
      "content_type": "Packaging",
      "material_type": "Polymer",
      "responsible_person": "RDKosterSa",
      "group_name": "NIPS - Advanced Packaging Sciences and Sustainability",
      "project_number": "DUND-103291 Buddy (buddy)",
      "reception_date": "2023-05-01",
      "expiry_date": null,
      "status": "available",
      "chemical_ids": [],
      "metadata": { "cntn_fk_provider": "Irrelevant", "cntn_fk_location": "K29" },
      "created_at": "2026-02-08T10:00:00.000Z"
    }
  ],
  "pagination": { "page": 1, "limit": 50, "total": 10, "totalPages": 1 }
}
```

---

### Add Sample

**Endpoint:** `POST /samples`

**Request Body:**

```json
{
  "sample_id": "PIPM00617",
  "identification": "Ulterion 529HS coated on Alu",
  "content_type": "Packaging",
  "material_type": "Polymer",
  "project_number": "DUND-103291 Buddy",
  "status": "available"
}
```

---

### Download Sample Template

Download the SLIMS sample upload template (`.xlsx`).

**Endpoint:** `GET /samples/template/download`

**Response:** binary `.xlsx` attachment (`Upload_Sample_Template.xlsx`).

---

### Upload Samples (SLIMS Excel)

Bulk-import samples from a SLIMS "Content record" export. The parser auto-detects the
**3-row header** (config row, machine-key row `cntn_barCode`/`cntn_id`/…, human-label row),
maps key columns to Pandora fields, normalises European dates (`DD/MM/YYYY` → ISO), and
preserves **every** raw SLIMS column in `metadata`. Rows without a Barcode are skipped.
Re-uploading a sample **preserves** its existing `chemical_ids`.

**Endpoint:** `POST /samples/upload/excel`

**Content-Type:** `multipart/form-data` (field: `file`)

**Field mapping (renames):**

| SLIMS column (label) | Machine key | → Pandora field |
|----------------------|-------------|-----------------|
| Barcode | `cntn_barCode` | `sample_id` |
| Id | `cntn_id` | `identification` |
| Category | `cntn_fk_category` | `content_type` |
| Sample Subtype | `cntn_cf_fk_sampleSubtype` | `material_type` |
| Responsible | `cntn_cf_fk_responsible` | `responsible_person` |
| Owner Group | `cntn_cf_fk_ownerGroup` | `group_name` |
| NPDI number Project | `cntn_cf_fk_project` | `project_number` |
| Description | `cntn_cf_description` | `description` |
| Reception Date | `cntn_cf_receptionDate` | `reception_date` |
| Status | `cntn_fk_status` | `status` |
| Expiry date | `cntn_cf_exp_date` | `expiry_date` |
| *(all other columns)* | — | preserved in `metadata` |

**Response:**

```json
{
  "message": "Successfully processed 1 samples (1 new, 0 updated)",
  "inserted": 1,
  "updated": 0,
  "total": 1,
  "summary": {
    "rowsInFile": 1,
    "successfullyProcessed": 1,
    "skipped": 0,
    "parseWarnings": [],
    "sheet": "data"
  }
}
```

**cURL Example:**

```bash
curl -X POST http://localhost:5942/api/samples/upload/excel \
  -F "file=@Upload_Sample template_PIPM00617.xlsx"
```

---

### Link Chemicals to a Sample

Set the full list of chemicals linked to a sample (one sample → many chemicals).
Unknown chemical IDs are reported in `unknownChemicalIds` but not rejected.

**Endpoint:** `PUT /samples/:id/chemicals`  *(`:id` is the `sample_id` / barcode)*

**Request Body:**

```json
{ "chemical_ids": ["CHEM-001", "CHEM-002"] }
```

**Response:**

```json
{
  "message": "Linked 2 chemical(s) to sample PIPM00617",
  "sample_id": "PIPM00617",
  "chemical_ids": ["CHEM-001", "CHEM-002"],
  "unknownChemicalIds": ["CHEM-002"]
}
```

---

## Screening

### List Screening Records

Get paginated list of screening data.

**Endpoint:** `GET /screening`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `limit` | integer | Items per page |
| `chemical_id` | string | Filter by chemical ID |

---

### Get Screening by Chemical

**Endpoint:** `GET /screening/chemical/:chemical_id`

**Response:**

```json
[
  {
    "id": "uuid",
    "chemical_id": "CHEM-001",
    "assay_name": "Cytotoxicity",
    "result": "Positive",
    "ic50": 10.5,
    "unit": "μM",
    "created_at": "2026-02-08T10:00:00.000Z"
  }
]
```

---

### Add Screening Record

**Endpoint:** `POST /screening`

**Request Body:**

```json
{
  "chemical_id": "CHEM-001",
  "assay_name": "Cytotoxicity",
  "result": "Positive",
  "ic50": 10.5,
  "unit": "μM"
}
```

---

## Toxicology

### List Toxicology Records

Get paginated list of toxicology data.

**Endpoint:** `GET /toxicology`

---

### Get Toxicology by Chemical

**Endpoint:** `GET /toxicology/chemical/:chemical_id`

**Response:**

```json
[
  {
    "id": "uuid",
    "chemical_id": "CHEM-001",
    "study_type": "Acute Toxicity",
    "species": "Rat",
    "route": "Oral",
    "ld50": 192,
    "unit": "mg/kg",
    "created_at": "2026-02-08T10:00:00.000Z"
  }
]
```

---

### Add Toxicology Record

**Endpoint:** `POST /toxicology`

**Request Body:**

```json
{
  "chemical_id": "CHEM-001",
  "study_type": "Acute Toxicity",
  "species": "Rat",
  "route": "Oral",
  "ld50": 192,
  "unit": "mg/kg"
}
```

---

## Error Codes

| HTTP Code | Description |
|-----------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request (validation error) |
| 404 | Not Found |
| 500 | Internal Server Error |

**Example Error Response:**

```json
{
  "error": "Chemical ID already exists"
}
```

---

## Integration Examples

### JavaScript (Axios)

```javascript
import axios from 'axios';

const API_BASE = 'http://localhost:5942/api';

// Get all chemicals
const getChemicals = async () => {
  const response = await axios.get(`${API_BASE}/chemicals`);
  console.log(response.data);
};

// Add a chemical
const addChemical = async () => {
  const chemical = {
    chemical_id: 'CHEM-001',
    name: 'Caffeine',
    cas_number: '58-08-2'
  };
  
  const response = await axios.post(`${API_BASE}/chemicals`, chemical);
  console.log(response.data);
};

// Upload Excel file
const uploadExcel = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await axios.post(
    `${API_BASE}/chemicals/upload/excel`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  console.log(response.data);
};

// Bulk delete
const bulkDelete = async (ids) => {
  const response = await axios.post(`${API_BASE}/chemicals/bulk/delete`, {
    chemical_ids: ids
  });
  console.log(response.data);
};
```

---

### Python (Requests)

```python
import requests

API_BASE = 'http://localhost:5942/api'

# Get all chemicals
response = requests.get(f'{API_BASE}/chemicals')
chemicals = response.json()
print(chemicals)

# Add a chemical
chemical = {
    'chemical_id': 'CHEM-001',
    'name': 'Caffeine',
    'cas_number': '58-08-2'
}
response = requests.post(f'{API_BASE}/chemicals', json=chemical)
print(response.json())

# Upload Excel file
with open('chemicals.xlsx', 'rb') as f:
    files = {'file': f}
    response = requests.post(f'{API_BASE}/chemicals/upload/excel', files=files)
    print(response.json())

# Bulk delete
response = requests.post(f'{API_BASE}/chemicals/bulk/delete', json={
    'chemical_ids': ['CHEM-001', 'CHEM-002']
})
print(response.json())
```

---

### cURL Scripts

```bash
#!/bin/bash

API_BASE="http://localhost:5942/api"

# Get statistics
curl "$API_BASE/stats"

# Get chemicals with pagination
curl "$API_BASE/chemicals?page=1&limit=10"

# Search chemicals
curl "$API_BASE/chemicals?search=caffeine"

# Add chemical
curl -X POST "$API_BASE/chemicals" \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "CHEM-001",
    "name": "Caffeine",
    "cas_number": "58-08-2"
  }'

# Upload Excel
curl -X POST "$API_BASE/chemicals/upload/excel" \
  -F "file=@chemicals.xlsx"

# Bulk operations
curl -X POST "$API_BASE/chemicals/bulk/delete" \
  -H "Content-Type: application/json" \
  -d '{"chemical_ids": ["CHEM-001", "CHEM-002"]}'
```

---

## Postman Collection

Import the Postman collection for easy API testing:

1. Download: [Pandora-Toolbox-API.postman_collection.json](docs/Pandora-Toolbox-API.postman_collection.json)
2. Import into Postman
3. Set base URL variable: `http://localhost:5942/api`

---

## Support

For API support or feature requests:
- Email: support@example.com
- GitHub Issues: [Create an issue](https://github.com/example/pandora-toolbox/issues)

---

**Last Updated:** February 12, 2026  
**API Version:** 2.0
