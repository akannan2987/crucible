# System Architecture - Crucible: Pandora Toolbox Enhancement (v2.0)

Technical architecture and design documentation for the Chemical and Sample
Management System. This document describes the **current architecture: a
Python/FastAPI backend with a React frontend**. The retired-in-progress
Node.js stack is summarised briefly in [Legacy Node.js Stack](#legacy-nodejs-stack).

---

## Table of Contents

- [Overview](#overview)
- [System Architecture](#system-architecture)
- [Technology Stack](#technology-stack)
- [Application Layers](#application-layers)
- [Data Flow](#data-flow)
- [Component Architecture](#component-architecture)
- [API Architecture](#api-architecture)
- [Database Design](#database-design)
- [Deployment Architecture](#deployment-architecture)
- [Performance Considerations](#performance-considerations)
- [Security Architecture](#security-architecture)
- [Monitoring & Observability](#monitoring--observability)
- [Extension Points](#extension-points)
- [Design Patterns Used](#design-patterns-used)
- [SDF Handling (RDKit)](#sdf-handling-rdkit)
- [Testing](#testing)
- [Legacy Node.js Stack](#legacy-nodejs-stack)
- [Interactive Architecture Page](#interactive-architecture-page)

---

## Overview

Crucible: Pandora Toolbox Enhancement (v2.0) is a full-stack web application
for managing chemical compounds, samples, and associated research data. The
backend is written in **Python (FastAPI)**; the frontend is a **React** single
page application served by the same process.

### Key Characteristics

- **Architecture Style**: Monolithic with clear separation of concerns
- **Communication**: RESTful API (contract in [API.md](../API.md))
- **Data Storage**: SQLite via SQLAlchemy 2 (`data/crucible.db`); PostgreSQL-ready
- **Chemistry**: RDKit for SDF/structure handling
- **Deployment**: One container (`crucible-py`), runs under podman or docker
- **Scalability**: Vertical scaling (horizontal planned for future)

> The backend was migrated from Node.js/Express using a **strangler-fig**
> approach: the FastAPI implementation reproduces the Express API contract
> exactly (verified by parity tests), so the React client did not change.
> Runbooks and the cutover plan live in [MIGRATION.md](../MIGRATION.md).

---

## System Architecture

### High-Level Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                       Client Browser                          │
│  ┌────────────────────────────────────────────────────────┐  │
│  │              React Application (SPA)                    │  │
│  │  ┌─────────┐  ┌──────────┐  ┌────────────────────┐    │  │
│  │  │Dashboard│  │Chemicals │  │Samples / Screening  │    │  │
│  │  │  Page   │  │ Manager  │  │Toxicology           │    │  │
│  │  └─────────┘  └──────────┘  └────────────────────┘    │  │
│  │            Vite Dev Server / Static Build               │  │
│  └────────────────────────────────────────────────────────┘  │
│                     ↕ REST /api/* + static files              │
│  ┌────────────────────────────────────────────────────────┐  │
│  │        FastAPI Backend (backend/app/, uvicorn)          │  │
│  │  ┌──────────┐  ┌───────────────┐  ┌───────────────┐   │  │
│  │  │ Routers  │  │ Upload parsers │  │ Static + SPA  │   │  │
│  │  │ /api/*   │  │ openpyxl·RDKit │  │ serving       │   │  │
│  │  └────┬─────┘  └───────────────┘  └───────────────┘   │  │
│  │       │   SQLAlchemy 2 ORM (store.py · models.py)      │  │
│  └───────┼────────────────────────────────────────────────┘  │
│          ↕                                                    │
│  ┌────────────────────────────────────────────────────────┐  │
│  │            SQLite Database (data/crucible.db)           │  │
│  │  tables: chemicals · samples · screening · toxicology   │  │
│  │  (each row: indexed columns + full record as JSON doc)  │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘

   data/pandora.json (legacy lowdb file) ──one-shot──►  crucible.db
                     backend/scripts/migrate_from_lowdb.py (idempotent)
```

---

## Technology Stack

### Frontend (unchanged by the migration)

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | 18.2.0 | UI framework |
| **Vite** | 5.1.0 | Build tool & dev server |
| **Tailwind CSS** | 3.4.1 | Utility-first CSS framework |
| **React Router** | 6.22.0 | Client-side routing |
| **Axios** | 1.6.7 | HTTP client |
| **React Hot Toast** | 2.4.1 | Toast notifications |
| **Heroicons** | 2.1.1 | Icon library |

### Backend (Python)

| Technology | Purpose | Where to see it |
|------------|---------|-----------------|
| **Python 3.12** | Runtime (python:3.12-slim image) | `backend/Dockerfile` |
| **FastAPI** | Web framework: routing, dependency injection, OpenAPI docs at `/docs` | `backend/app/main.py`, `backend/app/routers/` |
| **uvicorn** | ASGI server, binds `0.0.0.0:$PORT` (default 49160) | `backend/app/main.py` |
| **SQLAlchemy 2** | ORM / database access | `backend/app/models.py`, `backend/app/database.py` |
| **Pydantic v2** | Request models (deliberately lenient — see schemas.py docstring) | `backend/app/schemas.py` |
| **SQLite** | Storage; PostgreSQL later = `DATABASE_URL` change | `backend/app/config.py` |
| **RDKit** | SDF/MOL parsing, structural intelligence | `backend/app/utils/sdf.py` |
| **openpyxl** | Excel reading (SLIMS + chemical templates) | `backend/app/utils/excel.py`, `samples_excel.py` |
| **pytest** | Parity tests + optional live dual-backend diff | `backend/tests/` |

### Ops

- **`container-py.sh`**: build/start/stop/logs/status/migrate — auto-detects
  podman or docker (`CONTAINER_RUNTIME` override), checks the podman VM on macOS
- **`backend/Dockerfile`**: multi-stage — Node stage builds the React client,
  final python:3.12-slim image contains no Node
- **`monitor.sh`**: cron health check (`CONTAINER_NAME=crucible-py`)

---

## Application Layers

### 1. Presentation Layer (Client)

**Location**: `client/src/`

Unchanged by the migration: React pages, components, and the API service
(`client/src/services/api.js`) which calls relative `/api/...` URLs — which is
why the backend could be swapped without touching the client.

### 2. API Layer (Routers)

**Location**: `backend/app/routers/`

**Responsibilities:** request handling, response formatting, error handling —
one router file per resource, mirroring the legacy Express route files 1:1:

```
backend/app/routers/
├── chemicals.py       # Chemical CRUD & uploads (Excel/CSV/SDF)
├── samples.py         # Sample management + SLIMS upload + chemical linking
├── screening.py       # Screening data
├── toxicology.py      # Toxicology data
└── stats.py           # Dashboard statistics
```

### 3. Business Logic Layer

**Location**: route handlers + `backend/app/utils/`

**Responsibilities:** validation (duplicate IDs, required references), file
processing (`excel.py`, `samples_excel.py`, `sdf.py`), bulk operations, and
the JS-compatibility helpers (`compat.py`) that keep response semantics
identical to the legacy API (`||` defaulting, `toFixed(1)` strings,
`toISOString` timestamps).

### 4. Data Access Layer

**Location**: `backend/app/store.py`, `models.py`, `database.py`

**Responsibilities:** engine/session management (per-request session via the
`get_db` dependency), lowdb-like verbs (`all_docs`, `find_row`, `insert_doc`,
`replace_doc`), and keeping the indexed columns in sync with the JSON `doc`.

**Database structure** (hybrid document pattern — details in
[database-schema.md](database-schema.md)):

```sql
-- same shape for samples / screening / toxicology
CREATE TABLE chemicals (
    id          VARCHAR(64)  PRIMARY KEY,  -- UUID
    chemical_id VARCHAR(255) UNIQUE,       -- business key
    created_at  VARCHAR(40),               -- ISO string (sorting)
    seq         INTEGER,                   -- insertion order
    doc         JSON NOT NULL              -- the full record, verbatim
);
```

---

## Data Flow

### Read Operation (GET)

```
User Action → React Component → API Service (Axios)
    ↓
FastAPI Router → get_db Session → store.all_docs() (SQLAlchemy → SQLite)
    ↓
Filter / sort / paginate in Python (identical semantics to legacy API)
    ↓
JSON Response → Update Component State → Re-render UI
```

### Write Operation (POST/PUT)

```
User Input → Form Validation → API Service
    ↓
FastAPI Router → Pydantic model parse → business checks (duplicates, refs)
    ↓
store.insert_doc / replace_doc → SQLAlchemy commit → crucible.db
    ↓
Success Response → Update UI → Show Toast
```

### File Upload Flow

```
User Selects File → FormData → FastAPI UploadFile (multipart)
    ↓
Excel: openpyxl (or CSV parser)   |   SDF: text record split + RDKit analysis
    ↓
Row/record mapping (same field-alias tables as the legacy parsers)
    ↓
Batch insert/update → Return {inserted, updated, errors} → Display Summary
```

---

## Component Architecture

### Frontend Component Hierarchy (unchanged)

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

### Backend Module Map

```
backend/app/
├── main.py         # app factory: CORS, routers, /architecture, static + SPA,
│                   #   error handlers producing {"error": "..."} shapes
├── config.py       # env-var configuration (PORT, DATABASE_URL, paths)
├── compat.py       # JS-semantics helpers (parity with the legacy API)
├── database.py     # engine, SessionLocal, get_db dependency
├── models.py       # SQLAlchemy models (hybrid document pattern)
├── schemas.py      # Pydantic request models
├── store.py        # data-access verbs
├── routers/        # one file per resource
└── utils/          # sdf.py (RDKit) · samples_excel.py (SLIMS) · excel.py
```

---

## API Architecture

The REST contract is unchanged from v1 — see [API.md](../API.md) for the full
reference. FastAPI additionally serves interactive OpenAPI docs at `/docs`.

### RESTful Design

| Resource | GET | POST | PUT | DELETE |
|----------|-----|------|-----|--------|
| `/chemicals` | List all | Create one | - | - |
| `/chemicals/:id` | Get one | - | Update | Delete |
| `/chemicals/upload/excel` | - | Bulk upload | - | - |
| `/chemicals/upload/sdf` | - | Bulk upload | - | - |
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

Errors are returned as `{"error": "message"}` with the same status codes the
legacy API used. Implemented once, centrally, in `backend/app/main.py`:

```python
@application.exception_handler(StarletteHTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail)})
```

---

## Database Design

### SQLite + SQLAlchemy (hybrid document pattern)

**File**: `data/crucible.db` (bind-mounted volume in containers)

Legacy lowdb records are schemaless — different creation paths (manual POST,
Excel upload, SDF upload) produce different key sets, and PUT merges arbitrary
keys. A fully normalised schema would have changed API response shapes, so
each table stores:

- the **complete record verbatim** in a `doc` JSON column (what responses serialise), and
- **derived, indexed columns** (`id`, business key, `created_at`, `seq`) for lookups and ordering.

**Advantages:** API responses byte-identical to the lowdb era · real
transactions · single-file backup · works unchanged on PostgreSQL (JSONB).

**Trade-off:** cross-record queries filter in Python (fine at the 15K-record
scale); promoting hot fields to real columns is an incremental follow-up.

### Migration from lowdb

`backend/scripts/migrate_from_lowdb.py` — one-shot, **idempotent** upsert from
`data/pandora.json`, keyed on each collection's business key; prints a
per-collection count summary. Safe to re-run at any time.

### PostgreSQL upgrade path

`DATABASE_URL=postgresql+psycopg://user:pass@host/crucible` (+ add
`psycopg[binary]` to requirements), run the migration once against the new
URL. Recommended at the same time: introduce Alembic for schema versioning.

---

## Deployment Architecture

### Container Structure (`backend/Dockerfile`, multi-stage)

```dockerfile
Stage 1: docker.io/library/node:18-alpine
    → npm install + vite build  (client/dist)

Stage 2: docker.io/library/python:3.12-slim
    → pip install -r backend/requirements.txt   (RDKit et al. as wheels)
    → copy backend/app, backend/scripts, docs, client/dist
    → HEALTHCHECK: GET http://127.0.0.1:$PORT/api/stats
    → CMD python -m app.main   (uvicorn on 0.0.0.0:$PORT, default 49160)
```

The final image contains **no Node.js** — Node exists only in the build stage.

### Volume Mounts

- **Data volume**: `./data/` → `/app/data` (`:Z` for SELinux)
  - `crucible.db` (live database) and `pandora.json` (migration source / rollback snapshot)
  - persists across container rebuilds; backup = copy the directory

### Runtime management

`./container-py.sh {build|start|stop|restart|rebuild|migrate|logs|status|shell|clean}`
— identical behaviour under podman and docker; publishes the port on
`0.0.0.0` (Linux) or `127.0.0.1` (macOS, where Apple's `remoted` daemon
conflicts with wildcard binds of 49160). See [MIGRATION.md](../MIGRATION.md)
for the macOS/RHEL8 runbooks and systemd auto-start.

### Deployment Diagram

```
┌──────────────────────────────────────────┐
│         User's Browser                    │
│  http://<host>:49160                      │
└────────────────┬─────────────────────────┘
                 │ Port 49160
┌────────────────▼─────────────────────────┐
│   Container: crucible-py (podman/docker)  │
│  ┌────────────────────────────────────┐  │
│  │   uvicorn + FastAPI (Python 3.12)  │  │
│  │   Serves: React App + /api + /docs │  │
│  │   HEALTHCHECK → /api/stats         │  │
│  └────────────┬───────────────────────┘  │
│               │ SQLAlchemy                │
│  ┌────────────▼───────────────────────┐  │
│  │   Data Volume  /app/data           │  │
│  │   crucible.db · pandora.json       │  │
│  └────────────────────────────────────┘  │
└──────────────────────────────────────────┘
         ↑
┌────────┴─────────────────────────────────┐
│  Health Monitor (cron every 5 min)        │
│  CONTAINER_NAME=crucible-py ./monitor.sh  │
└──────────────────────────────────────────┘
```

---

## Performance Considerations

### Frontend Optimization

- **Code Splitting**: Route-based lazy loading (planned)
- **Bundle Size**: Vite optimization
- **Caching**: Service worker (planned)

### Backend Optimization

- **Pagination**: limits data transfer on all list endpoints
- **Indexes**: business keys and `created_at`/`seq` columns are indexed
- **Transactions**: SQLAlchemy commits are atomic (an improvement over the
  lowdb whole-file rewrite)

### Scalability Limits

Current architecture comfortably supports the reference scale (15,000
chemicals / 1,000 samples, 10–50 concurrent users). For higher scale:
PostgreSQL via `DATABASE_URL`, column promotion + SQL-side filtering,
uvicorn `--workers N`, and a caching layer if ever needed.

---

## Security Architecture

### Current Implementation

- **CORS**: open (same as the legacy API) — acceptable on the internal network,
  revisit with SSO
- **Input Validation**: server-side checks (duplicate IDs, required references);
  Pydantic models kept lenient on purpose to preserve the API contract
- **Error Handling**: no stack traces or sensitive data in error responses
- **Git Safety**: `.gitignore` protects `certs/`, `*.db`, keys, envs
- **Transport**: HTTP inside the network (matching current production).
  TLS for the Python stack is an **open item** — terminate at a reverse proxy
  or use uvicorn `--ssl-certfile/--ssl-keyfile` (the legacy stack's in-process
  TLS with Nestlé certificates is documented in DEPLOYMENT.md)

### Future Enhancements

- [ ] Authentication (SSO)
- [ ] Authorization (role-based access)
- [ ] TLS termination for the Python stack
- [ ] Rate limiting
- [ ] Audit logging

---

## Monitoring & Observability

- **Container HEALTHCHECK**: every 30 s against `/api/stats` (`127.0.0.1` on
  purpose — in-container `localhost` resolves to `::1` while the server binds
  IPv4)
- **Health monitor**: `CONTAINER_NAME=crucible-py ./monitor.sh` via cron —
  curls `/api/stats`, restarts the container on failure
- **Status command**: `./container-py.sh status` — container state + live API check
- **Dashboard**: real-time statistics with 5 s auto-refresh
- **Planned**: metrics (Prometheus), error tracking, certificate expiry alerts

---

## Extension Points

1. **New data module**: add a router file + SQLAlchemy model + frontend page
2. **New file format**: add a parser in `backend/app/utils/` and wire it to an
   upload route
3. **New API endpoint**: add a route function to the relevant router
4. **New UI component**: add to `client/src/components/`

---

## Design Patterns Used

- **Strangler fig**: new backend grown alongside the old one behind the same contract
- **Hybrid document storage**: verbatim `doc` JSON + derived indexed columns
- **Repository**: `store.py` isolates data access from route logic
- **Dependency injection**: FastAPI `Depends(get_db)` for per-request sessions
- **Adapter/compat layer**: `compat.py` reproduces JS semantics in Python

---

## SDF Handling (RDKit)

**Module:** `backend/app/utils/sdf.py` · used by `POST /api/chemicals/upload/sdf`

Hybrid design: each SDF record's **text is preserved verbatim** (original MOL
block and every `> <FIELD_NAME>` data item — nothing is ever dropped), while
**RDKit** provides the structural intelligence: formula and molecular weight
(computed from explicit atoms, matching the legacy behaviour), S-Groups
(`SRU`/`MUL`/`COP` → polymer detection with labels), formal charges, radicals,
stereo flags, and mixture detection. Handles V2000 and V3000 (including
continuation lines) via RDKit's molblock parser with `sanitize=False` for
maximum tolerance of polymers and exotic valences.

The extraction contract is unchanged from v1 (the field-alias tables were
ported verbatim and are enforced by parity tests):

### Tier 1 — Explicit named identifiers

| Crucible Field | SDF Source (case-insensitive, multiple aliases) | Fallback |
|--------------|-----------------------------------------------|----------|
| `chemical_id` | `chemical_id`, `compound_id`, `dtxsid`, `pubchem_compound_cid`, `registry_number`, … | Auto-generated |
| `name` | `compound_name`, `chemical_name`, `preferred_name`, `iupac_name`, `trade_name`, … | MOL header → `'Unknown'` |
| `cas_number` | `cas_number`, `cas`, `casrn`, `cas registry number`, … | `null` |
| `molecular_formula` | `molecular_formula`, `mol_formula`, `formula`, … | Computed (RDKit atoms, Hill order) |
| `molecular_weight` | `molecular_weight`, `mw`, `exact_mass`, `monoisotopic_mass`, … | Computed (RDKit atomic weights) |
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

**Every** `> <FIELD_NAME>` block — including the 40+ EPA/Nestlé regulatory
fields — is preserved verbatim in the `metadata` object. Examples from real
uploads:

- `Present in PLASTIC`, `Present in COATING`, `Present in INK`, `Present in RUBBER`, `Present in ADHESIVE`, `Present as NIAS`
- `EU FCM substance code`, `EU PM substance code`, `Listed / Updated in EU plastic regulation`
- `Restrictions and Specifications (SML in mg/kg)`, `ADI/TDI (mg/kg bw /day)`, `EFSA Opinions`
- `US FCS code`, `US FCN + TOR codes`, `US 21 CFR REGNum (list of articles)`
- `Nestle policy (St-80.008 and ink guidance note)`, `Nestle safety-based level SBL (mg/kg food)`
- `log P(o/w) (25°C)`, `RI from compilation (DB-5)`, `Color Index Code`

### Tier 3 — Structural intelligence

Each record gets a derived `structural` object (now computed by RDKit):

| Property | Type | Meaning |
|----------|------|---------|
| `isPolymer` | bool | One or more `SRU`, `MUL`, `COP`, or `CRO` S-Groups present |
| `polymerLabels` | string[] | SRU labels (`n`, `m`, `x`, ranges like `10-14`) |
| `isMixture` | bool | SMILES contains multiple disconnected components |
| `componentCount` | int | Number of disconnected components in SMILES |
| `hasStereochemistry` | bool | Stereo atoms/bonds or enhanced-stereo groups present |
| `stereoAtomCount` / `stereoBondCount` | int | Stereo centre / wedge counts |
| `totalCharge` / `chargedAtomCount` | int | Sum and count of formal charges |
| `radicalCount` | int | Atoms with radical electrons |
| `sGroupCount` / `sGroupTypes` | int / string[] | S-Group totals and distinct types |

### Validation

The extraction contract was established against a 77-record EPA DSSTox /
Nestlé regulatory fixture (34 polymers, 36 mixtures, 18 charged-atom records,
6 stereo records). The Python module is covered by the SDF parity tests in
`backend/tests/test_sdf_upload.py`; the historical JS parser test suite
(24 tests) continues to pass in the legacy stack until cutover.

### What RDKit unlocks (previously out of scope for the pure-JS parser)

Aromaticity perception, ring/rotatable-bond counts, H-bond donors/acceptors,
logP/TPSA, canonical SMILES generation, and structure rendering are now one
function call away if ever needed — see the RDKit docs.

### Extending the mapping

To promote a new SDF field to a top-level column, add its aliases to the
`find(...)` calls in `map_molecule_to_chemical()`
(`backend/app/utils/sdf.py`). Any field not promoted is **already preserved in
`metadata`** without code changes.

---

## Testing

- **Python backend**: `cd backend && .venv/bin/pytest` — 45 parity tests
  asserting the exact legacy contract (status codes, messages, key sets, JS
  quirks), plus SDF/SLIMS upload coverage and migration idempotency.
- **Live dual-backend diff** (optional): identical requests fired at both
  backends and responses compared — see `backend/tests/test_parity_live.py`.
- **Legacy stack**: `cd server && npm test` — 70 Jest tests (API, SDF parser,
  SLIMS parser), kept green until cutover.

---

## Legacy Node.js Stack

Kept in-repo until the cutover completes (see [MIGRATION.md](../MIGRATION.md)
§8–9 for cutover and rollback). Brief summary:

- **Stack**: Node.js 18 + Express 4 · LowDB 1.0 (JSON file `data/pandora.json`) ·
  Multer + SheetJS for uploads · custom 850-line SDF parser
  (`server/src/utils/sdfParser.js`)
- **Location**: `server/` · container `crucible` managed by `container.sh` ·
  Node Dockerfile at the repo root
- **TLS**: served HTTPS in-process with Nestlé certificates (`DEPLOYMENT.md`)
- **Status**: functional and passing its 70 tests; serves the identical API;
  scheduled for removal after the post-cutover soak period

---

## Interactive Architecture Page

An interactive visual architecture diagram is served at `/architecture`:
- **URL:** `http://<host>:49160/architecture`
- **Source:** `docs/architecture-interactive.html` (baked into the Python
  image at build time — run `./container-py.sh rebuild` after editing)
- **Features:** animated data flow, clickable components, tabbed sections
  (Data Flow, Layers, Tech Stack, Data Model, Security, Deployment) — all
  describing the Python/FastAPI stack

---

**Last Updated:** July 29, 2026
**Version:** 2.0
