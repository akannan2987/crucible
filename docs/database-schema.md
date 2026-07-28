# Database Schema - Pandora Toolbox 2.0

Complete database schema documentation for the LowDB JSON-based storage system.

---

## Table of Contents

- [Overview](#overview)
- [Schema Structure](#schema-structure)
- [Collections](#collections)
- [Relationships](#relationships)
- [Indexes and Constraints](#indexes-and-constraints)
- [Sample Data](#sample-data)

---

## Overview

Pandora Toolbox uses **LowDB**, a lightweight JSON database built on Lodash. The entire database is stored in a single JSON file.

### File Location

- **Development**: `data/pandora.json`
- **Container**: `/app/server/data/pandora.json` (mounted from `./data/`)
- **Backup**: `backups/pandora-YYYYMMDD-HHMMSS.json`

> ⚠️ **Note**: The `data/` directory is excluded from git via `.gitignore` to protect real data.

### Database Characteristics

- **Type**: Document-based (JSON)
- **Persistence**: File system
- **Concurrency**: Single-threaded (file lock)
- **Max Size**: Recommended < 100MB (~15K chemicals)
- **Backup**: Simple file copy

---

## Schema Structure

The database contains four main collections:

```json
{
  "chemicals": [],
  "samples": [],
  "screening": [],
  "toxicology": []
}
```

---

## Collections

### 1. Chemicals Collection

Stores chemical compound information.

**Collection Name**: `chemicals`

**Schema:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string (UUID) | Yes | Internal unique identifier | `"550e8400-e29b-41d4-a716-446655440000"` |
| `chemical_id` | string | Yes | Chemical identifier (user-facing) | `"CHEM-001"` or `"DTX12345"` |
| `nestle_id` | string | No | Nestle internal ID | `"NST-98765"` |
| `name` | string | Yes | Chemical name | `"Caffeine"` |
| `cas_number` | string | No | CAS Registry Number | `"58-08-2"` |
| `molecular_formula` | string | No | Molecular formula | `"C8H10N4O2"` |
| `molecular_weight` | number | No | Molecular weight (g/mol) | `194.19` |
| `smiles` | string | No | SMILES notation | `"CN1C=NC2=C1C(=O)N(C(=O)N2C)C"` |
| `inchi` | string | No | InChI string | `"InChI=1S/C8H10N4O2/..."` |
| `inchi_key` | string | No | InChI Key | `"RYYVLZVUVIJVGH-UHFFFAOYSA-N"` |
| `supplier` | string | No | Supplier name | `"Sigma-Aldrich"` |
| `purity` | string | No | Purity percentage | `"≥98%"` |
| `mol_block` | string | No | MOL file content (from SDF) | `"..."` |
| `inchi_string` | string | No | Full InChI string (Tier 1 SDF field) | `"InChI=1S/..."` |
| `dtxsid` | string | No | EPA DSSTox identifier (Tier 1 SDF field) | `"DTXSID7020637"` |
| `preferred_name` | string | No | EPA preferred name (Tier 1 SDF field) | `"Caffeine"` |
| `monoisotopic_mass` | number | No | Monoisotopic mass (Tier 1 SDF field) | `194.0804` |
| `ms_ready_smiles` | string | No | EPA MS-Ready normalized SMILES | `"CN1C=NC2=C1C(=O)N(C(=O)N2C)C"` |
| `synonyms` | string[] | No | Alternate names (auto-split on `;,\n`) | `["1,3,7-Trimethylxanthine", "Theine"]` |
| `structural` | object | No | Derived structural intelligence — see below | `{ "isPolymer": false, ... }` |
| `hazard_info` | string | No | Hazard information | `"Toxic if swallowed"` |
| `storage_conditions` | string | No | Storage requirements | `"Store at 2-8°C"` |
| `description` | string | No | Additional notes | `"Stimulant compound"` |
| `metadata` | object | No | Catch-all for every `> <FIELD_NAME>` SDF property not promoted above (incl. EPA / Nestlé regulatory fields like `EU FCM substance code`, `Present in PLASTIC`, `ADI/TDI (mg/kg bw /day)`, `US 21 CFR REGNum`, `Nestle policy (St-80.008 ...)`) | `{ "EU FCM substance code": "...", ... }` |

**`structural` sub-schema** (auto-derived by SDF parser):

| Field | Type | Description |
|-------|------|-------------|
| `isPolymer` | boolean | True when SRU / MUL / COP / CRO S-Group present |
| `polymerLabels` | string[] | SRU labels (`n`, `m`, ranges like `10-14`) |
| `isMixture` | boolean | SMILES contains disconnected components |
| `componentCount` | number | Number of `.`-separated SMILES components |
| `hasStereochemistry` | boolean | Atom CFG, bond wedge, or stereo collection present |
| `stereoAtomCount` | number | Atoms with stereo configuration |
| `stereoBondCount` | number | Bonds with stereo wedge |
| `totalCharge` | number | Sum of all atom formal charges |
| `chargedAtomCount` | number | Atoms with non-zero formal charge |
| `radicalCount` | number | Atoms flagged as radicals |
| `sGroupCount` | number | Total S-Groups |
| `sGroupTypes` | string[] | Distinct S-Group type codes (e.g. `["SRU"]`) |
| `created_at` | string (ISO 8601) | Yes | Creation timestamp | `"2026-02-08T10:30:00.000Z"` |
| `updated_at` | string (ISO 8601) | Yes | Last update timestamp | `"2026-02-08T15:45:00.000Z"` |

**Constraints:**
- `chemical_id` must be unique
- `name` is required
- No hard limit on record count (optimized for 15,000+ chemicals)

**Example Document:**

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "chemical_id": "CHEM-001",
  "nestle_id": "NST-12345",
  "name": "Caffeine",
  "cas_number": "58-08-2",
  "molecular_formula": "C8H10N4O2",
  "molecular_weight": 194.19,
  "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
  "inchi": "InChI=1S/C8H10N4O2/c1-10-4-9-6-5(10)7(13)12(3)8(14)11(6)2/h4H,1-3H3",
  "inchi_key": "RYYVLZVUVIJVGH-UHFFFAOYSA-N",
  "supplier": "Sigma-Aldrich",
  "purity": "≥98%",
  "hazard_info": null,
  "storage_conditions": null,
  "description": null,
  "metadata": {},
  "created_at": "2026-02-08T10:00:00.000Z",
  "updated_at": "2026-02-08T10:00:00.000Z"
}
```

---

### 2. Samples Collection

Stores sample information imported from the **SLIMS "Content record"** export. A sample
may be linked to **several** chemicals via the `chemical_ids` array (linked manually in the
app — the SLIMS export has no chemical-reference column).

**Collection Name**: `samples`

**Schema:**

| Field | Type | Required | Description | SLIMS source (machine key) | Example |
|-------|------|----------|-------------|----------------------------|---------|
| `id` | string (UUID) | Yes | Internal unique identifier | — | `"uuid"` |
| `sample_id` | string | Yes | Sample identifier (unique) | `cntn_barCode` (Barcode) | `"PIPM00617"` |
| `name` | string | Yes | Display name (mirrors `identification`) | `cntn_id` | `"Ulterion 529HS coated on Alu"` |
| `identification` | string | No | SLIMS Id | `cntn_id` (Id) | `"Ulterion 529HS coated on Alu"` |
| `content_type` | string | No | Category | `cntn_fk_category` (Category) | `"Packaging"` |
| `material_type` | string | No | Sample subtype | `cntn_cf_fk_sampleSubtype` | `"Polymer"` |
| `responsible_person` | string | No | Contact person | `cntn_cf_fk_responsible` | `"RDKosterSa"` |
| `group_name` | string | No | Owner group | `cntn_cf_fk_ownerGroup` | `"NIPS - Advanced Packaging Sciences…"` |
| `project_number` | string | No | NPDI Project (Study) | `cntn_cf_fk_project` | `"DUND-103291 Buddy"` |
| `description` | string | No | Description (newlines preserved) | `cntn_cf_description` | `"Supplier JainChem\n…"` |
| `reception_date` | string (ISO 8601) | No | Reception date (DD/MM/YYYY → ISO) | `cntn_cf_receptionDate` | `"2023-05-01"` |
| `expiry_date` | string (ISO 8601) | No | Expiry date (DD/MM/YYYY → ISO) | `cntn_cf_exp_date` | `null` |
| `status` | string | No | Lifecycle status (lower-cased) | `cntn_fk_status` | `"available"` |
| `chemical_ids` | string[] | No | Manually linked chemicals (0..n) | — (app) | `["CHEM-001","CHEM-002"]` |
| `labels` | object | No | SLIMS human labels (key → label) | row 3 | `{ "cntn_barCode": "Barcode" }` |
| `metadata` | object | No | **Catch-all** — every raw SLIMS column verbatim (29 keys) | all | `{ "cntn_fk_provider": "…", … }` |
| `created_at` | string (ISO 8601) | Yes | Creation timestamp | — | `"2026-02-08T10:00:00.000Z"` |
| `updated_at` | string (ISO 8601) | Yes | Update timestamp | — | `"2026-02-08T10:00:00.000Z"` |

**Constraints:**
- `sample_id` (Barcode) must be unique; rows without a Barcode are skipped during import.
- `chemical_ids` is optional and populated via the app (one sample → many chemicals).
- On re-upload, existing `chemical_ids` are **preserved** (manual links are not wiped).
- No hard limit on record count (optimized for 1,000+ samples).

**SLIMS template parsing notes:**
- The export has a **3-row header**: row 1 = config/banner (skipped), row 2 = machine keys
  (the parse keys), row 3 = human labels (kept in `labels`). Data starts at row 4.
- Dates are European `DD/MM/YYYY` (Europe/Zurich) and are normalised to ISO `YYYY-MM-DD`.
- Empty cells become `null`. Nothing is dropped — unmapped columns live in `metadata`.

**Example Document:**

```json
{
  "id": "abc123-def456-ghi789",
  "sample_id": "PIPM00617",
  "name": "Ulterion 529HS coated on Alu",
  "identification": "Ulterion 529HS coated on Alu",
  "content_type": "Packaging",
  "material_type": "Polymer",
  "responsible_person": "RDKosterSa",
  "group_name": "NIPS - Advanced Packaging Sciences and Sustainability",
  "project_number": "DUND-103291 Buddy (buddy)",
  "description": "Supplier JainChem\nUlterion 529 HS coated on Alufoil (6 gsm)",
  "reception_date": "2023-05-01",
  "expiry_date": null,
  "status": "available",
  "chemical_ids": [],
  "labels": { "cntn_barCode": "Barcode", "cntn_id": "Id *" },
  "metadata": {
    "cntn_fk_contentType": "Pack - Material",
    "cntn_fk_provider": "Irrelevant",
    "cntn_fk_location": "K29",
    "cntn_cf_doc": "FALSE"
  },
  "created_at": "2026-02-08T10:00:00.000Z",
  "updated_at": "2026-02-08T10:00:00.000Z"
}
```

---

### 3. Screening Collection

Stores screening assay results linked to chemicals.

**Collection Name**: `screening`

**Schema:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string (UUID) | Yes | Internal unique identifier | `"uuid"` |
| `chemical_id` | string | Yes | Reference to chemical | `"CHEM-001"` |
| `assay_name` | string | Yes | Name of assay | `"Cytotoxicity (MTT)"` |
| `assay_type` | string | No | Type/category | `"Cell Viability"` |
| `result` | string | No | Qualitative result | `"Positive"`, `"Negative"` |
| `ic50` | number | No | IC50 value | `10.5` |
| `ec50` | number | No | EC50 value | `8.3` |
| `unit` | string | No | Concentration unit | `"μM"`, `"nM"` |
| `cell_line` | string | No | Cell line used | `"HeLa"`, `"MCF-7"` |
| `assay_date` | string (ISO 8601) | No | Date performed | `"2026-02-01"` |
| `operator` | string | No | Person who ran assay | `"John Doe"` |
| `notes` | string | No | Additional notes | `"Repeat needed"` |
| `metadata` | object | No | Additional data | `{ "plate_id": "P123" }` |
| `created_at` | string (ISO 8601) | Yes | Creation timestamp | `"2026-02-08T10:00:00.000Z"` |
| `updated_at` | string (ISO 8601) | Yes | Update timestamp | `"2026-02-08T10:00:00.000Z"` |

**Constraints:**
- `chemical_id` must reference existing chemical
- No limit on screening records

**Example Document:**

```json
{
  "id": "screen-uuid-001",
  "chemical_id": "CHEM-001",
  "assay_name": "Cytotoxicity (MTT)",
  "assay_type": "Cell Viability",
  "result": "Positive",
  "ic50": 10.5,
  "ec50": null,
  "unit": "μM",
  "cell_line": "HeLa",
  "assay_date": "2026-02-01",
  "operator": "Jane Smith",
  "notes": "Reproducible results",
  "metadata": {
    "plate_id": "P123",
    "experiment_id": "EXP-2024-045"
  },
  "created_at": "2026-02-08T10:00:00.000Z",
  "updated_at": "2026-02-08T10:00:00.000Z"
}
```

---

### 4. Toxicology Collection

Stores toxicology study data linked to chemicals.

**Collection Name**: `toxicology`

**Schema:**

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `id` | string (UUID) | Yes | Internal unique identifier | `"uuid"` |
| `chemical_id` | string | Yes | Reference to chemical | `"CHEM-001"` |
| `study_type` | string | Yes | Type of study | `"Acute Toxicity"` |
| `species` | string | No | Test species | `"Rat"`, `"Mouse"` |
| `strain` | string | No | Animal strain | `"Sprague-Dawley"` |
| `route` | string | No | Administration route | `"Oral"`, `"Dermal"`, `"Inhalation"` |
| `ld50` | number | No | LD50 value | `192` |
| `ld50_unit` | string | No | LD50 unit | `"mg/kg"` |
| `noael` | number | No | NOAEL value | `10` |
| `noael_unit` | string | No | NOAEL unit | `"mg/kg/day"` |
| `duration` | string | No | Study duration | `"14 days"`, `"90 days"` |
| `study_date` | string (ISO 8601) | No | Study completion date | `"2025-12-15"` |
| `lab` | string | No | Testing laboratory | `"ToxLab Inc."` |
| `glp_compliant` | boolean | No | GLP compliance | `true` |
| `findings` | string | No | Key findings | `"No adverse effects"` |
| `metadata` | object | No | Additional data | `{}` |
| `created_at` | string (ISO 8601) | Yes | Creation timestamp | `"2026-02-08T10:00:00.000Z"` |
| `updated_at` | string (ISO 8601) | Yes | Update timestamp | `"2026-02-08T10:00:00.000Z"` |

**Constraints:**
- `chemical_id` must reference existing chemical
- No limit on toxicology records

**Example Document:**

```json
{
  "id": "tox-uuid-001",
  "chemical_id": "CHEM-001",
  "study_type": "Acute Oral Toxicity",
  "species": "Rat",
  "strain": "Sprague-Dawley",
  "route": "Oral",
  "ld50": 192,
  "ld50_unit": "mg/kg",
  "noael": null,
  "noael_unit": null,
  "duration": "14 days",
  "study_date": "2025-12-15",
  "lab": "ToxLab International",
  "glp_compliant": true,
  "findings": "No mortality observed at 100 mg/kg",
  "metadata": {
    "study_id": "TOX-2025-192",
    "sponsor": "NIHS"
  },
  "created_at": "2026-02-08T10:00:00.000Z",
  "updated_at": "2026-02-08T10:00:00.000Z"
}
```

---

## Relationships

### Entity Relationship Diagram

```
┌─────────────────┐
│   Chemicals     │
│  (no hard cap)  │
│  chemical_id*   │
└────┬────────────┘
     │
     │ 1:N
     │
     ├──────────────────┬──────────────────┐
     │                  │                  │
     ▼                  ▼                  ▼
┌─────────────┐  ┌─────────────┐  ┌──────────────┐
│   Samples   │  │  Screening  │  │ Toxicology   │
│  (no cap)   │  │  (Unlimited)│  │ (Unlimited)  │
│ chemical_id │  │ chemical_id │  │ chemical_id  │
└─────────────┘  └─────────────┘  └──────────────┘
```

### Relationship Rules

1. **Chemicals → Samples**: One-to-Many
   - A chemical can have multiple samples
   - A sample belongs to one chemical
   - Deleting a chemical does NOT cascade delete samples (currently)

2. **Chemicals → Screening**: One-to-Many
   - A chemical can have multiple screening records
   - A screening record belongs to one chemical

3. **Chemicals → Toxicology**: One-to-Many
   - A chemical can have multiple toxicology studies
   - A toxicology record belongs to one chemical

---

## Indexes and Constraints

### Primary Keys

- **chemicals**: `chemical_id` (unique)
- **samples**: `sample_id` (unique)
- **screening**: `id` (UUID)
- **toxicology**: `id` (UUID)

### Foreign Keys

- `samples.chemical_id` → `chemicals.chemical_id`
- `screening.chemical_id` → `chemicals.chemical_id`
- `toxicology.chemical_id` → `chemicals.chemical_id`

**Note**: LowDB doesn't enforce foreign key constraints. Application logic must ensure referential integrity.

### Unique Constraints

- `chemicals.chemical_id` must be unique
- `samples.sample_id` must be unique

### Capacity Constraints

- Chemicals: No hard limit (optimized for 15,000+ records)
- Samples: No hard limit (optimized for 1,000+ records)
- Screening: No hard limit
- Toxicology: No hard limit

---

## Sample Data

### Complete Database Example

```json
{
  "chemicals": [
    {
      "id": "uuid-001",
      "chemical_id": "CHEM-001",
      "nestle_id": "NST-12345",
      "name": "Caffeine",
      "cas_number": "58-08-2",
      "molecular_formula": "C8H10N4O2",
      "molecular_weight": 194.19,
      "smiles": "CN1C=NC2=C1C(=O)N(C(=O)N2C)C",
      "supplier": "Sigma-Aldrich",
      "created_at": "2026-02-08T10:00:00.000Z",
      "updated_at": "2026-02-08T10:00:00.000Z"
    }
  ],
  "samples": [
    {
      "id": "uuid-101",
      "sample_id": "SAMPLE-001",
      "name": "Caffeine Stock Solution",
      "chemical_id": "CHEM-001",
      "quantity": 100,
      "unit": "mg",
      "storage_location": "Freezer A1",
      "created_at": "2026-02-08T11:00:00.000Z",
      "updated_at": "2026-02-08T11:00:00.000Z"
    }
  ],
  "screening": [
    {
      "id": "uuid-201",
      "chemical_id": "CHEM-001",
      "assay_name": "Cytotoxicity",
      "result": "Positive",
      "ic50": 10.5,
      "unit": "μM",
      "created_at": "2026-02-08T12:00:00.000Z",
      "updated_at": "2026-02-08T12:00:00.000Z"
    }
  ],
  "toxicology": [
    {
      "id": "uuid-301",
      "chemical_id": "CHEM-001",
      "study_type": "Acute Toxicity",
      "species": "Rat",
      "route": "Oral",
      "ld50": 192,
      "ld50_unit": "mg/kg",
      "created_at": "2026-02-08T13:00:00.000Z",
      "updated_at": "2026-02-08T13:00:00.000Z"
    }
  ]
}
```

---

## Query Patterns

### Common Queries

**Get all chemicals:**
```javascript
db.get('chemicals').value()
```

**Find chemical by ID:**
```javascript
db.get('chemicals').find({ chemical_id: 'CHEM-001' }).value()
```

**Search chemicals:**
```javascript
db.get('chemicals')
  .filter(c => c.name.toLowerCase().includes(search))
  .value()
```

**Get screening by chemical:**
```javascript
db.get('screening')
  .filter({ chemical_id: 'CHEM-001' })
  .value()
```

---

## Migration Considerations

### Moving to SQL Database

When scaling beyond 15K chemicals, consider:

**PostgreSQL Schema:**
```sql
CREATE TABLE chemicals (
  id UUID PRIMARY KEY,
  chemical_id VARCHAR(255) UNIQUE NOT NULL,
  nestle_id VARCHAR(255),
  name VARCHAR(500) NOT NULL,
  cas_number VARCHAR(50),
  molecular_formula VARCHAR(255),
  molecular_weight DECIMAL(10,2),
  -- ... other fields
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chemicals_name ON chemicals(name);
CREATE INDEX idx_chemicals_cas ON chemicals(cas_number);

-- Similar tables for samples, screening, toxicology
```

---

**Last Updated:** February 12, 2026  
**Schema Version:** 2.0
