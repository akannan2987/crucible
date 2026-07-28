# System Architecture - Crucible: Pandora Toolbox Enhancement (v2.0)

Technical architecture and design documentation for the Chemical and Sample Management System.

---

## Table of Contents

- [Overview](#overview)
- [Python Backend (v2.0 Migration)](#python-backend-v20-migration)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Application Layers](#application-layers)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [API Architecture](#api-architecture)
- [Database Design](#database-design)
- [Deployment Architecture](#deployment-architecture)

---

## Overview

Crucible: Pandora Toolbox Enhancement (v2.0) is a full-stack web application built with modern JavaScript technologies, designed for managing chemical compounds, samples, and associated research data.

### Key Characteristics

- **Architecture Style**: Monolithic with clear separation of concerns
- **Communication**: RESTful API
- **Data Storage**: JSON-based file storage (LowDB) → **SQLite via SQLAlchemy** in the Python backend
- **Deployment**: Containerized application (Podman/Docker)
- **Scalability**: Vertical scaling (horizontal planned for future)

> ⚠️ **Migration status:** the Node/Express backend documented in the sections
> below is being replaced by a **Python/FastAPI backend** (`backend/`) with an
> identical API contract (strangler-fig migration). The React client, the API
> contract (API.md) and all diagrams of the *frontend* remain accurate for both.
> The next section documents the Python backend; the Express sections are kept
> until the legacy stack is retired. Deployment runbooks and the cutover plan
> live in [MIGRATION.md](../MIGRATION.md).

---

## Python Backend (v2.0 Migration)

**Location**: `backend/` · **Runs as**: `crucible-py` container, port 49160 (managed by `container-py.sh`)

### High-Level Architecture (Python stack)

```
┌──────────────────────────────────────────────────────────────┐
│                       Client Browser                          │
│         React SPA (client/dist — unchanged, same /api calls)  │
└───────────────────────────┬──────────────────────────────────┘
                            ↕ REST /api/* + static files
┌───────────────────────────┴──────────────────────────────────┐
│              FastAPI application (backend/app/)               │
│                                                               │
│  main.py        app factory · CORS · static/SPA serving ·     │
│                 /architecture · {"error": ...} error shape    │
│  routers/       chemicals · samples · screening ·             │
│                 toxicology · stats   (1 file per Express      │
│                 route file, endpoint-for-endpoint)            │
│  schemas.py     Pydantic v2 request models (lenient — no 422s │
│                 that Express would not have produced)         │
│  compat.py      JS-semantics helpers: || defaulting,          │
│                 parseInt, toFixed(1), toISOString format      │
│  utils/         sdf.py (RDKit structure analysis) ·           │
│                 samples_excel.py (SLIMS 3-row header) ·       │
│                 excel.py (xlsx/csv → formatted strings)       │
│  store.py       lowdb-like verbs (all_docs/find/insert/…)     │
│  models.py      SQLAlchemy 2 ORM — hybrid document pattern    │
│  database.py    engine from DATABASE_URL · per-request        │
│                 Session via FastAPI dependency injection      │
└───────────────────────────┬──────────────────────────────────┘
                            ↕ SQLAlchemy
┌───────────────────────────┴──────────────────────────────────┐
│  SQLite  data/crucible.db          (PostgreSQL-ready:         │
│  tables: chemicals · samples ·      switching is a            │
│  screening · toxicology             DATABASE_URL change)      │
│                                                               │
│  data/pandora.json  ──migrate_from_lowdb.py──►  (one-shot,   │
│  (legacy lowdb file)                             idempotent)  │
└──────────────────────────────────────────────────────────────┘
```

### Technology Stack (Python backend)

| Technology | Purpose | Where |
|------------|---------|-------|
| **Python 3.12** | Runtime (python:3.12-slim image) | `backend/Dockerfile` |
| **FastAPI** | Web framework, routing, DI, OpenAPI docs at `/docs` | `backend/app/main.py`, `routers/` |
| **uvicorn** | ASGI server (0.0.0.0:$PORT, default 49160) | `backend/app/main.py` |
| **SQLAlchemy 2** | ORM / database access | `backend/app/models.py`, `database.py` |
| **Pydantic v2** | Request models | `backend/app/schemas.py` |
| **SQLite** | Storage (file: `data/crucible.db`) | `DATABASE_URL` in `config.py` |
| **RDKit** | SDF/MOL parsing, formula/MW, S-Groups, stereo | `backend/app/utils/sdf.py` |
| **openpyxl** | Excel reading (SLIMS + generic templates) | `backend/app/utils/excel.py` |
| **pytest** | 45 contract-parity tests + live dual-backend diff | `backend/tests/` |

### Request Flow (Python stack)

```
Browser fetch('/api/chemicals?search=x')
   → uvicorn → FastAPI router  (routers/chemicals.py :: list_chemicals)
   → Depends(get_db) opens a SQLAlchemy Session          (database.py)
   → store.all_docs(db, Chemical) reads record documents (store.py)
   → filtering/sorting/pagination in Python — identical
     semantics to the Express implementation             (compat.py)
   → dict returned → FastAPI serialises JSON → browser
```

### Key design decisions

1. **Identical contract, quirks included** — same paths, status codes,
   messages, and JS-isms (`|| null` coercion, `errors` key omitted when
   empty, `percentage` as a string). Enforced by `backend/tests/`.
2. **Hybrid document storage** — lowdb records are schemaless, so each table
   stores the full record in a `doc` JSON column plus indexed columns
   (`id`, business key, `created_at`, insertion-order `seq`). See
   [database-schema.md](database-schema.md) for the SQL schema.
3. **SDF via RDKit** — records are split textually (original `mol_block` and
   all `> <FIELD>` items preserved verbatim); RDKit supplies the structural
   intelligence (formula/MW from explicit atoms, polymer S-Groups, charges,
   radicals, stereo, mixtures).
4. **Same serving model as Express** — one process serves `/api/*`, the
   built React client, `/architecture`, and the SPA fallback.

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client Browser                        │
│  ┌───────────────────────────────────────────────────┐  │
│  │         React Application (SPA)                    │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────┐   │  │
│  │  │Dashboard│  │Chemicals │  │Samples/Screen  │   │  │
│  │  │  Page   │  │  Manager │  │Toxicology      │   │  │
│  │  └─────────┘  └──────────┘  └────────────────┘   │  │
│  │              Vite Dev Server / Static Build        │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↕ HTTPS/REST API                 │
│  ┌───────────────────────────────────────────────────┐  │
│  │            Express.js Backend                      │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────┐    │  │
│  │  │ API      │  │ Business │  │  File Upload │    │  │
│  │  │ Routes   │  │ Logic    │  │  Handler     │    │  │
│  │  └──────────┘  └──────────┘  └──────────────┘    │  │
│  │                    LowDB Data Layer                │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↕                                │
│  ┌───────────────────────────────────────────────────┐  │
│  │         JSON Database (pandora.json)              │  │
│  │  { chemicals: [], samples: [],                    │  │
│  │    screening: [], toxicology: [] }                │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Technology Stack

### Frontend

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI framework |
| **Vite** | 5.1.0 | Build tool & dev server |
| **Tailwind CSS** | 3.4.1 | Utility-first CSS framework |
| **React Router** | 6.22.0 | Client-side routing |
| **Axios** | 1.6.7 | HTTP client |
| **React Hot Toast** | 2.4.1 | Toast notifications |
| **Heroicons** | 2.1.1 | Icon library |

### Backend

| Technology | Version | Purpose |
|------------|---------|---------|
| **Node.js** | 18+ | Runtime environment |
| **Express** | 4.18.2 | Web framework |
| **LowDB** | 1.0.0 | JSON database |
| **Multer** | 1.4.5 | File upload middleware |
| **XLSX** | 0.18.5 | Excel file processing |
| **UUID** | 9.0.0 | Unique ID generation |
| **CORS** | 2.8.5 | Cross-origin support |

### Development Tools

- **Nodemon**: Auto-restart server on changes
- **Concurrently**: Run multiple npm scripts
- **Podman/Docker**: Containerization

---

## Application Layers

### 1. Presentation Layer (Client)

**Location**: `client/src/`

**Responsibilities:**
- User interface rendering
- User input handling
- State management
- API communication
- Client-side routing

**Key Components:**
```
client/src/
├── pages/              # Route-level components
│   ├── Dashboard.jsx
│   ├── ChemicalsView.jsx
│   ├── ChemicalsUpload.jsx
│   └── ...
├── services/           # API client
│   └── api.js
├── App.jsx            # Root component & routing
└── main.jsx           # Application entry point
```

### 2. API Layer (Server)

**Location**: `server/src/routes/`

**Responsibilities:**
- Request validation
- Response formatting
- Route handling
- Error handling

**Routes:**
```
server/src/routes/
├── chemicals.js       # Chemical CRUD & uploads
├── samples.js         # Sample management
├── screening.js       # Screening data
├── toxicology.js      # Toxicology data
└── stats.js          # Dashboard statistics
```

### 3. Business Logic Layer

**Location**: Integrated in route handlers

**Responsibilities:**
- Data validation
- Business rules enforcement
- File processing (Excel, SDF)
- Bulk operations

### 4. Data Access Layer

**Location**: `server/src/database.js`

**Responsibilities:**
- Database initialization
- CRUD operations
- Data persistence

**Database Structure:**
```javascript
{
  chemicals: [
    { id, chemical_id, name, cas_number, ... }
  ],
  samples: [
    { id, sample_id, identification, chemical_ids, ... }
  ],
  screening: [
    { id, chemical_id, assay_name, result, ... }
  ],
  toxicology: [
    { id, chemical_id, study_type, ld50, ... }
  ]
}
```

---

## Data Flow

### Read Operation (GET)

```
User Action → React Component → API Service (Axios)
    ↓
Express Route Handler → Database Query (LowDB)
    ↓
JSON Response ← Format Data ← Read from File
    ↓
Update Component State → Re-render UI
```

### Write Operation (POST/PUT)

```
User Input → Form Validation → API Service
    ↓
Express Route Handler → Validate Data
    ↓
Write to Database (LowDB) → Persist to File
    ↓
Success Response → Update UI → Show Toast
```

### File Upload Flow

```
User Selects File → FormData Creation → Multer Middleware
    ↓
Parse File (XLSX Library) → Validate Rows
    ↓
Batch Insert/Update → Database Write
    ↓
Return Results (inserted, updated, errors) → Display Summary
```

---

## Component Architecture

### Frontend Component Hierarchy

```
App
├── Dashboard
│   ├── StatsCard (x4)
│   ├── CapacityOverview
│   └── RecentActivity
│
├── ChemicalsView
│   ├── SearchBar
│   ├── BulkActionToolbar
│   ├── ChemicalTable
│   │   └── ChemicalRow (multiple)
│   ├── Pagination
│   ├── DetailModal
│   └── BulkEditModal
│
├── ChemicalsUpload
│   ├── UploadModeSelector
│   ├── FileDropZone
│   ├── ManualEntryForm
│   └── HelpSection
│
└── Similar structure for Samples, Screening, Toxicology
```

### Component Communication

1. **Props**: Parent → Child data flow
2. **Callbacks**: Child → Parent events
3. **State**: Local component state (useState)
4. **API**: Global data fetching (axios)

---

## API Architecture

### RESTful Design

| Resource | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| `/chemicals` | List all | Create one | - | - |
| `/chemicals/:id` | Get one | - | Update | Delete |
| `/chemicals/upload/excel` | - | Bulk upload | - | - |
| `/chemicals/bulk/delete` | - | Bulk delete | - | - |
| `/chemicals/bulk/update` | - | Bulk update | - | - |

### Request/Response Pattern

**Request:**
```javascript
axios.get('/api/chemicals', {
  params: { page: 1, limit: 20, search: 'caffeine' }
})
```

**Response:**
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

### Error Handling

```javascript
try {
  // Business logic
  res.json({ data: result });
} catch (error) {
  res.status(500).json({ error: error.message });
}
```

---

## Database Design

### LowDB Implementation

**File**: `server/data/pandora.json`

**Advantages:**
- Simple setup, no external database
- Easy to backup (single JSON file)
- Good for up to 15K chemicals
- Human-readable

**Limitations:**
- Not suitable for concurrent writes
- Limited query capabilities
- Memory-based (loads entire file)
- No transactions

### Future Migration Path

For larger scale:
- **SQLite**: Better performance, transactions
- **PostgreSQL**: Full relational database
- **MongoDB**: Document-based, flexible schema

---

## Deployment Architecture

### Container Structure

```dockerfile
FROM node:18-alpine
    ↓
Copy application files
    ↓
Install backend dependencies
    ↓
Build frontend (React → static files)
    ↓
Serve both from Express
    ↓
Expose port 49160
```

### Container Layers

1. **Base Layer**: Node.js 18 Alpine (with OpenSSL)
2. **Dependencies Layer**: npm packages
3. **Application Layer**: Source code
4. **Build Layer**: Compiled frontend
5. **Runtime Layer**: Express HTTPS server

### Volume Mounts

- **Data Volume**: `/app/server/data` → `./data/`
  - Persists database across container restarts
  - Can be backed up separately
- **Certs Volume**: `/app/certs` → `./certs/` (read-only)
  - SSL certificate, private key, CA certificate
  - Mounted read-only for security

---

## Performance Considerations

### Frontend Optimization

- **Code Splitting**: Route-based lazy loading (planned)
- **Bundle Size**: Vite optimization
- **Caching**: Service worker (planned)

### Backend Optimization

- **Pagination**: Limit data transfer
- **Indexing**: In-memory arrays (LowDB)
- **File Uploads**: Stream processing

### Scalability Limits

Current architecture supports:
- ✅ 15,000 chemicals
- ✅ 1,000 samples
- ✅ Unlimited screening/toxicology records
- ✅ 10-50 concurrent users

For higher scale, consider:
- Load balancer
- Database migration
- Caching layer (Redis)
- CDN for static assets

---

## Security Architecture

### Current Implementation

- **HTTPS/TLS**: All production traffic encrypted with official Nestlé SSL certificates
- **Certificate Management**: Certificates excluded from git, verified on deployment via MD5 hash matching
- **CORS**: Configured for specific origins
- **Input Validation**: Server-side validation
- **File Upload Limits**: 100MB max
- **Error Handling**: No sensitive data in errors
- **Git Safety**: `.gitignore` protects certs/, data/, *.key, *.crt, *.pem, .env
- **File Permissions**: Private key restricted to `chmod 600`

### SSL Certificate Details

| File | Source | Purpose |
|------|--------|--------|
| `certs/server.crt` | `nr-ubp-dev-02.nihs.ch.nestle.com.cer` | Server certificate |
| `certs/server.key` | `nr-ubp-dev-02.nihs.ch.nestle.com.key` | Private key |
| `certs/ca.crt` | `Nestle_Root_CA.cer` | CA root certificate |

### Future Enhancements

- [ ] Authentication (SSO)
- [ ] Authorization (Role-based access)
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Certificate expiry monitoring

---

## Monitoring & Observability

### Current Capabilities

- **HTTPS Health Monitoring**: `monitor.sh` checks `https://localhost:49160/api/stats` every 5 minutes via cron
- **Auto-Restart**: Container automatically restarted if health check fails
- **Monitor Logs**: All activity logged to `/tmp/pandora-monitor.log`
- **Server Keepalive**: 65s keepAliveTimeout, 66s headersTimeout, 120s requestTimeout
- **Crash Recovery**: Global handlers for `uncaughtException` and `unhandledRejection`
- **Memory Monitoring**: Automatic memory usage logging every 5 minutes (RSS, heap used/total)
- **Container HEALTHCHECK**: Built-in Docker/Podman health check every 30 seconds
- **Dashboard**: Real-time statistics with 5s auto-refresh

### Planned Enhancements

- [ ] Application metrics (Prometheus)
- [ ] Performance monitoring
- [ ] Error tracking (Sentry)
- [ ] Usage analytics
- [ ] Certificate expiry alerts

---

## Extension Points

The architecture allows easy extension:

1. **New Data Module**: Add route + frontend page
2. **New File Format**: Add parser in upload handler
3. **New API Endpoint**: Add route handler
4. **New UI Component**: Add to components/

---

## Design Patterns Used

- **MVC**: Model (LowDB), View (React), Controller (Express routes)
- **Repository**: Database abstraction layer
- **Factory**: Component composition
- **Observer**: React state updates
- **Singleton**: Database instance

---

## Diagrams

### Deployment Diagram

```
┌──────────────────────────────────────────┐
│         User's Browser                    │
│  https://nr-ubp-dev-02:49160  🔒          │
└────────────────┬─────────────────────────┘
                 │ HTTPS/TLS (Port 49160)
┌────────────────▼─────────────────────────┐
│      Podman Container                     │
│  ┌────────────────────────────────────┐  │
│  │   Node.js HTTPS Server             │  │
│  │   Port 49160 (TLS)                  │  │
│  │   SSL Certs: /app/certs/           │  │
│  │   Serves: React App + API          │  │
│  └────────────┬───────────────────────┘  │
│               │                           │
│  ┌────────────▼───────────────────────┐  │
│  │   Data Volume                      │  │
│  │   /app/server/data/pandora.json    │  │
│  └────────────────────────────────────┘  │
│                                           │
│  ┌────────────────────────────────────┐  │
│  │   Certs Volume (read-only)         │  │
│  │   /app/certs/ → server.crt,        │  │
│  │   server.key, ca.crt               │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
         ↑
┌────────┴─────────────────────────────────┐
│   Health Monitor (cron every 5 min)       │
│   monitor.sh → curl HTTPS API → restart   │
│   Logs: /tmp/pandora-monitor.log          │
└──────────────────────────────────────────┘
```

---

## SDF Parser (`server/src/utils/sdfParser.js`)

The SDF (Structure Data File) parser handles V2000 and V3000 molfile formats embedded in SDF containers. It is used when users upload `.sdf` files via `POST /api/chemicals/upload/sdf`.

The parser is **EPA DSSTox / Nestlé regulatory database compatible** — validated against a 77-record fixture covering polymers, salts, mixtures, charged atoms, and stereo descriptors. See [`server/tests/sdfParser.test.js`](../server/tests/sdfParser.test.js) (24 unit tests, all passing).

### What it extracts

| Output Field | Source |
|-------------|--------|
| `name` | Header line 1 of each MOL record |
| `version` | Auto-detected `V2000` or `V3000` (falls back to scanning body for `M  V30` markers) |
| `molecularFormula` | Computed from atom block (Hill order) |
| `molecularWeight` | Computed from atom block using IUPAC 2021 atomic masses |
| `atoms` | Array of parsed atom objects (`x`, `y`, `z`, `symbol`, `charge`, `cfg`, `radical`) |
| `bonds` | Array of parsed bond objects (`atom1`, `atom2`, `type`, `stereo`) |
| `sGroups` | V3000 S-Group records (`SRU`, `MUL`, `COP`, `MIX`, `SUP`) with `type`, `label`, `connect`, `atomIndices` |
| `collections` | V3000 stereo collections (`STEABS`, `STEREL`, `STERAC`) |
| `properties` | Key→value pairs from every `> <FIELD_NAME>` data item (catch-all — nothing is lost) |
| `warnings` | Non-fatal parse warnings (counts mismatch, missing M  END, continuation issues) |

### Tier 1 — Explicit named identifiers

`mapMoleculeToChemical()` promotes the most commonly queried fields to top-level keys:

| Pandora Field | SDF Source (case-insensitive, multiple aliases) | Fallback |
|--------------|-----------------------------------------------|----------|
| `chemical_id` | `chemical_id`, `compound_id`, `dtxsid`, `pubchem_compound_cid`, `registry_number`, … | Auto UUID |
| `name` | `compound_name`, `chemical_name`, `preferred_name`, `iupac_name`, `trade_name`, … | `mol.name` → `'Unknown'` |
| `cas_number` | `cas_number`, `cas`, `casrn`, `cas registry number`, … | `null` |
| `molecular_formula` | `molecular_formula`, `mol_formula`, `formula`, … | Computed from atoms |
| `molecular_weight` | `molecular_weight`, `mw`, `exact_mass`, `monoisotopic_mass`, … | Computed from atoms |
| `smiles` | `smiles`, `canonical_smiles`, `isomeric_smiles`, `openeye_iso_smiles`, … | `null` |
| `inchi` / `inchi_key` | `inchi`, `standard_inchi`, `inchikey`, `inchi_key`, `standard_inchikey`, … | `null` |
| `dtxsid` | `dtxsid`, `dtx_id`, `dtxid` | `null` |
| `preferred_name` | `preferred_name`, `preferred name` | `null` |
| `monoisotopic_mass` | `monoisotopic_mass`, `exact_mass` | `null` |
| `ms_ready_smiles` | `ms_ready_smiles`, `ms-ready smiles` | `null` |
| `inchi_string` | `inchi_string` | falls back to `inchi` |
| `synonyms` | `synonyms / composition`, `synonyms`, `common_names` — auto-split on `;`, `,`, newline | `[]` |
| `supplier`, `purity`, `storage_conditions`, `hazard_info`, `description` | Multiple aliases each | `null` |
| `nestle_id` | `nestle_id`, `nestle id` | `null` |

### Tier 2 — Regulatory metadata (catch-all)

**Every** `> <FIELD_NAME>` block in the SDF — including the 40+ EPA/Nestlé regulatory fields — is preserved verbatim in the `metadata` object on the chemical record. Examples from real uploads:

- `Present in PLASTIC`, `Present in COATING`, `Present in INK`, `Present in RUBBER`, `Present in ADHESIVE`, `Present as NIAS`
- `Role / Usage / Source / NIAS`
- `EU FCM substance code`, `EU PM substance code`, `Listed / Updated in EU plastic regulation`
- `Restrictions and Specifications (SML in mg/kg)`, `ADI/TDI (mg/kg bw /day)`, `EFSA Opinions`
- `US FCS code`, `US FCN + TOR codes`, `US 21 CFR REGNum (list of articles)`
- `Nestle policy (St-80.008 and ink guidance note)`, `Nestle safety-based level SBL (mg/kg food)`
- `log P(o/w) (25°C)`, `RI from compilation (DB-5)`, `Color Index Code`

No new field appears unexpectedly — the Viewer UI reads these from `metadata.*` without code changes.

### Tier 3 — Structural intelligence

For every parsed molecule, `mapMoleculeToChemical()` derives a `structural` object:

| Property | Type | Meaning |
|----------|------|---------|
| `isPolymer` | bool | True when one or more `SRU`, `MUL`, `COP`, or `CRO` S-Groups are present |
| `polymerLabels` | string[] | SRU labels (`n`, `m`, `x`, `y`, ranges like `10-14`) — useful for display |
| `isMixture` | bool | True when SMILES contains multiple disconnected components (counted via `.` outside `[]`) |
| `componentCount` | int | Number of disconnected components in SMILES |
| `hasStereochemistry` | bool | True when any atom has `CFG`, any bond has stereo wedge, or `STEABS/STEREL/STERAC` collection is present |
| `stereoAtomCount` | int | Count of atoms with stereo configuration |
| `stereoBondCount` | int | Count of bonds with stereo wedge |
| `totalCharge` | int | Sum of all atom charges (zero for neutral molecules) |
| `chargedAtomCount` | int | Number of atoms with non-zero formal charge |
| `radicalCount` | int | Number of atoms flagged as radicals |
| `sGroupCount` | int | Total S-Groups parsed |
| `sGroupTypes` | string[] | Distinct S-Group type codes (e.g., `["SRU"]`, `["SUP", "MUL"]`) |

### Validated coverage (against `docs/excel-templates/Upload_Chemicals_SDF.sdf`)

| Metric | Result |
|--------|--------|
| Records parsed | 77 / 77 |
| Atoms parsed | 76 / 77 (1 record legitimately has `COUNTS 0 0 0`) |
| Unique SDF property keys preserved | 52 / 52 |
| Polymers detected (SRU) | 34, all with labels extracted |
| Mixtures detected | 36 (salts, ester mixtures, polymer blends) |
| Charged atoms detected | 18 records (Na⁺, Al³⁺, carboxylate anions) |
| Stereo descriptors detected | 6 records |
| Parse time | ~13 ms for 77 records |

### What is *not* extracted (future work)

These would require a chemistry library (RDKit / OpenBabel) and are out of scope for a pure-JS parser:

- Implicit hydrogen counts (so computed MW matches molecular formula exactly)
- R/S and E/Z descriptors (we detect *presence* of stereo, not the descriptor)
- Aromaticity perception
- Ring count, rotatable bond count, H-bond donors/acceptors, logP, TPSA
- Superatom expansion (V3000 `SUP` S-Group abbreviations like `Et`, `Ph`, `OAc`)

### Extending the parser

To add new explicit field mappings, edit the `mapMoleculeToChemical()` function in [`server/src/utils/sdfParser.js`](../server/src/utils/sdfParser.js). The `properties` object contains every `> <FIELD_NAME>` key→value pair from the SDF data block, so any new field is **already preserved in `metadata`** without code changes — promotion to top-level is only needed for fields you want to query or filter on directly.

---

## Interactive Architecture Page

An interactive visual architecture diagram is served at `/architecture`:
- **URL:** `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160/architecture`
- **Source:** `docs/architecture-interactive.html`
- **Features:** Animated data flow, clickable components, tabbed sections (Data Flow, Layers, Tech Stack, Data Model, Security, Deployment)

---

**Last Updated:** May 19, 2026  
**Version:** 2.0
