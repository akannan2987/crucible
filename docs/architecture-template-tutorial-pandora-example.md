# Tutorial Example: Building the Crucible Architecture Page

A concrete, copy-paste-ready walkthrough showing how the interactive
architecture page for **Crucible: Pandora Toolbox Enhancement (v2.0)** is
built — prompt by prompt — using an AI coding agent (originally Claude Opus
4.6 in VS Code, GitHub Copilot Agent mode).

> **Prerequisite**: Read the generic tutorial in `architecture-template-tutorial.md` first for the methodology. This document provides the Crucible-specific implementation.

> ℹ️ **Updated for v2.0 (Python backend).** This tutorial was originally
> authored when the app ran on Node.js/Express/LowDB; the brief and prompts
> below have been updated so that following them regenerates a page matching
> the **current architecture** (FastAPI + SQLAlchemy/SQLite + RDKit). The
> live page is served at `/architecture`; after editing it, run
> `./container-py.sh rebuild` (docs are baked into the Python image).

---

## Table of Contents

- [Prerequisites](#prerequisites)
- [Step 1: The Architecture Brief](#step-1-the-architecture-brief)
- [Step 2: Prompt 1 — Skeleton + Hero + Tabs + CSS](#step-2-prompt-1--skeleton--hero--tabs--css)
- [Step 3: Prompt 2 — Animated Data Flow SVG](#step-3-prompt-2--animated-data-flow-svg)
- [Step 4: Prompt 3 — Layers Tab](#step-4-prompt-3--layers-tab)
- [Step 5: Prompt 4 — Tech Stack Tab](#step-5-prompt-4--tech-stack-tab)
- [Step 6: Prompt 5 — Data Model + Security + Deployment](#step-6-prompt-5--data-model--security--deployment)
- [Step 7: Prompt 6 — Polish](#step-7-prompt-6--polish)
- [Result](#result)

---

## Prerequisites

- **LLM**: an AI coding agent (Claude in VS Code / Claude Code)
- **Editor**: VS Code with the Crucible project open
- **Project root**: `crucible/`
- **Output file**: `docs/architecture-interactive.html`
- **Time**: ~1.5 hours

---

## Step 1: The Architecture Brief

This is the plain-text brief prepared before any prompting. It contains all
the facts the AI needs. **Keep this brief in sync with the real system** —
every stale fact here becomes a stale diagram on the page.

```
PROJECT: Crucible: Pandora Toolbox Enhancement (v2.0)
ORG: Nestlé Research · Computational Sciences · NIPS
URL: http://nr-ubp-dev-02.nihs.ch.nestle.com:49160

COMPONENTS:
- Frontend: React 18.2 + Vite 5.1 + Tailwind 3.4 (unchanged from v1)
- Backend: FastAPI on Python 3.12, served by uvicorn (backend/app/)
- Database: SQLite (data/crucible.db) via SQLAlchemy 2 ORM
  - Hybrid document pattern: full record verbatim in a JSON `doc` column
    + indexed columns (id, business key, created_at, seq)
  - PostgreSQL-ready: switching is a DATABASE_URL change
- Chemistry: RDKit (SDF/MOL parsing, structural intelligence)
- Excel: openpyxl (SLIMS 3-row-header sample export + chemical templates)
- External APIs: PubChem (compound lookup by CAS/name/SMILES)
- Auth: None currently (SSO planned)
- Legacy: Node/Express/LowDB stack still in server/ until cutover
  (identical API; do NOT show it on the page beyond a mention)

DATA FLOW:
1. User clicks/searches/uploads in browser
2. React sends request via Axios to the FastAPI backend on port 49160
3. FastAPI validates input (Pydantic), parses files
   (Excel via openpyxl, SDF via RDKit-backed module)
4. SQLAlchemy reads/writes data/crucible.db (SQLite)
5. JSON response returns → React re-renders the table/dashboard

TECH STACK:
Frontend:
  - React 18.2.0 — UI component framework
  - Vite 5.1.0 — Build tool & dev server
  - Tailwind CSS 3.4.1 — Utility-first styling
  - React Router 6.22.0 — Client-side navigation
  - Axios 1.6.7 — HTTP client
  - React Hot Toast 2.4.1 — Toast notifications
  - Heroicons 2.1.1 — SVG icon library

Backend:
  - Python 3.12 — runtime (python:3.12-slim container)
  - FastAPI — web framework (routing, DI, OpenAPI docs at /docs)
  - uvicorn — ASGI server, 0.0.0.0:$PORT (default 49160)
  - SQLAlchemy 2 — ORM
  - Pydantic v2 — request models (lenient, to preserve the legacy contract)
  - SQLite — storage (single file, transactional)
  - RDKit — SDF/MOL parsing, polymer/mixture/stereo detection
  - openpyxl — Excel parsing
  - uuid4 — unique record IDs

DevOps:
  - container-py.sh — build/start/stop/logs/status/migrate;
    auto-detects podman or docker (CONTAINER_RUNTIME override)
  - backend/Dockerfile — multi-stage (Node builds client, python:3.12-slim runs)
  - HEALTHCHECK — GET http://127.0.0.1:$PORT/api/stats every 30s
  - monitor.sh — cron health check (CONTAINER_NAME=crucible-py)
  - pytest — 45 parity tests (backend/tests/) + optional live dual-backend diff

DATA MODEL:
- chemicals: { id, chemical_id, name, cas_number, molecular_formula, molecular_weight, smiles, inchi_key }
- samples: { id, sample_id, chemical_ids[], identification, content_type, material_type, status }
- screening: { id, chemical_id, assay_name, result, concentration, date }
- toxicology: { id, chemical_id, study_type, species, ld50, noael, classification }
- All collections link back to chemicals via chemical_id
- SQL tables store each record verbatim in a JSON `doc` column

SECURITY:
- HTTP inside the internal network (matches current production);
  TLS for the Python stack is an open item (reverse proxy or uvicorn SSL flags)
- CORS open (same as legacy API) — revisit with SSO
- Server-side validation (duplicate IDs, required references)
- File upload limit: 100MB
- Git ignores: certs/, *.db, .env, *.key, *.crt, *.pem

DEPLOYMENT:
- Host: nr-ubp-dev-02.nihs.ch.nestle.com (RHEL8) — also runs on macOS for dev
- Port: 49160 (PORT env var; published on 0.0.0.0 on Linux, 127.0.0.1 on macOS)
- Container: crucible-py (podman or docker, rootless on RHEL8)
- Volume: ./data → /app/data (crucible.db + pandora.json migration source; :Z for SELinux)
- Health: container HEALTHCHECK + monitor.sh cron → auto-restart on failure
- Boot persistence on RHEL8: systemd user unit / Quadlet (see MIGRATION.md)

CAPACITY:
- ~50,000 chemicals / samples / screening / toxicology records
- 50–100 concurrent users
- 100MB max file upload
```

---

## Step 2: Prompt 1 — Skeleton + Hero + Tabs + CSS

Paste this into the agent:

---

```
Create a single self-contained HTML file at `docs/architecture-interactive.html` for **Crucible: Pandora Toolbox Enhancement (v2.0)**.

Requirements:
- Single file, no build step. Load Tailwind via `<script src="https://cdn.tailwindcss.com"></script>`.
- **Dark glassmorphism design**: body background `radial-gradient(circle at 20% 10%, #1e1b4b 0%, #0f172a 40%, #020617 100%)`, color `#e2e8f0`, font Inter/system-ui.
- Cards use class `.glass`: `background: rgba(30,41,59,0.55); backdrop-filter: blur(12px); border: 1px solid rgba(148,163,184,0.18)`.
- `.glow`: `box-shadow: 0 0 25px rgba(139,92,246,0.35), 0 0 60px rgba(99,102,241,0.18)`.
- `.gradient-text`: linear-gradient 90deg #a5b4fc → #c4b5fd → #f9a8d4, background-clip text.
- `.lift`: hover translateY(-4px) with increased border-color and box-shadow.
- `.reveal`: opacity 0, translateY(24px), transitions to visible state.
- 3 decorative `.blob` divs (absolute, border-radius 50%, filter blur(80px), opacity 0.35): indigo top-left (480px), pink mid-right (520px), emerald bottom-left (420px).
- CSS keyframes: `pulse-ring` (scale 0.85→1.6 fade, 2.4s), `float` (translateY 0→-6px→0, 4s), `flow-path` (stroke-dashoffset -28, 1.6s), `travel` (offset-distance 0→100% with fade, 3.2s).

**Status banner** (above the hero): emerald-tinted glass card stating this page
describes the current Python/FastAPI architecture, and that the legacy
Node.js/Express backend remains in server/ until cutover (identical API),
pointing to MIGRATION.md, docs/architecture.md and docs/database-schema.md.

**Hero header** (max-w-7xl mx-auto, pt-14 pb-10):
- Left: 🧪 emoji in a w-12 h-12 floating glass+glow rounded-xl box
- Below icon: "Nestlé Research · Computational Sciences · NIPS" in xs uppercase tracking-[0.3em] text-indigo-300
- Title: "Crucible: Pandora Toolbox Enhancement **v2.0**" with "v2.0" in gradient-text (text-2xl font-semibold)
- Large heading (text-4xl md:text-5xl font-bold): "How **Pandora** works, explained visually." with "Pandora" in gradient-text
- Subtitle: "Architecture of Chemical & Sample Management System — from the user's browser, across the network, into the container, and down to the database."
- Pill badges (flex-wrap gap-2 mt-6): 🌐 Web App, ⚛️ React + Vite, 🐍 Python + FastAPI, 🗄️ SQLite + SQLAlchemy, 🧬 RDKit, 📦 Podman / Docker
- Right column: glass rounded-2xl p-5 card with "At a glance" header and stats:
  - 🧬 Chemicals capacity — ~50,000
  - 🧫 Samples capacity — ~50,000
  - 🔬 Screening records — ~50,000
  - ☣️ Toxicology records — ~50,000
  - 👥 Concurrent users — 50 – 100
  - 🚪 Hosted on port — 49160

**Sticky nav bar** (top-0 z-30 backdrop-blur-md bg-slate-950/70 border-y border-slate-800):
- 6 tab buttons (data-tab attributes: flow, layers, stack, data, security, deploy):
  - ⏩ Data Flow (active by default)
  - 🏗️ Layers
  - 🧰 Tech Stack
  - 🗄️ Data Model
  - 🛡️ Security
  - 🚀 Deployment
- `.tab-btn.active`: `background: linear-gradient(90deg, #6366f1, #ec4899); color: white`

**Main** (max-w-7xl mx-auto px-6 py-12 space-y-24) with 6 sections:
- id="tab-flow" (class="reveal", visible)
- id="tab-layers" (class="reveal hidden")
- id="tab-stack" (class="reveal hidden")
- id="tab-data" (class="reveal hidden")
- id="tab-security" (class="reveal hidden")
- id="tab-deploy" (class="reveal hidden")

**Footer**: "Crucible: Pandora Toolbox Enhancement (v2.0) · Nestlé Research · Computational Sciences · Interactive architecture · v1.0" and "Built using React, FastAPI, SQLite/SQLAlchemy, RDKit & Podman/Docker."

**JavaScript**:
- Tab switching: click toggles active class, shows/hides sections
- IntersectionObserver: adds `visible` to `.reveal` at threshold 0.1

No content inside sections yet.
```

---

### ✅ Checkpoint

- [ ] Status banner + hero with floating 🧪, gradient "v2.0", pill badges, stats card
- [ ] Tabs switch (empty sections toggle)
- [ ] Background blobs visible
- [ ] No console errors

---

## Step 3: Prompt 2 — Animated Data Flow SVG

---

```
In the `#tab-flow` section of `docs/architecture-interactive.html`, add:

**Header:**
- h3 (text-2xl font-bold): "⏩ Request–Response Pipeline"
- p (text-slate-400 text-sm): "Directed data flow: Browser → API → Database → Response (DAG with no cycles)."
- Right side: 3 buttons (glass lift, text-xs, z-50):
  - id="btn-sim-read": "📥 Simulate Read"
  - id="btn-sim-write": "📤 Simulate Write"
  - id="btn-sim-upload": "📂 Simulate Upload"

**Inline <script> immediately after buttons** (IIFE so buttons exist in DOM):
Scenario data:
- read: labels=['👁️ View list','📡 GET /api/chemicals','📖 Read crucible.db','📋 Table renders'], descs=['User clicks "View Chemicals" in the sidebar','Axios fires GET request','SQLAlchemy loads matching records from SQLite','React renders rows into the table']
- write: labels=['✏️ Save form','📡 POST /api/chemicals','✅ Validate + write','🎉 Toast: Saved!'], descs=['User fills out the form and clicks Save','Axios POSTs the JSON payload','FastAPI validates then commits to crucible.db','Success toast appears, table refreshes']
- upload: labels=['📂 Pick Excel','📡 POST upload/excel','🧮 Parse + bulk insert','📊 Summary report'], descs=['User selects an Excel or SDF file','File sent as multipart form-data','openpyxl/RDKit parses rows, validates, bulk-inserts','Summary shows inserted/updated/error counts']

Default labels: ['User Interaction','Secure API Call','Business Logic','UI Updates']
Default descs: ['Click, search, upload — events captured by React components.','Axios sends a request to the FastAPI backend.','Server validates input, parses files (Excel/SDF), updates the database.','JSON response flows back; the page refreshes instantly without reload.']

runScenario function: on click, reset all 4 cards, then sequentially (500ms delay each) highlight step-card-N with indigo glow (rgba(99,102,241,0.4) bg, box-shadow, outline), update label and desc text. Restore defaults after 4500ms.

**SVG** (viewBox="0 0 1000 560", w-full h-auto) inside glass rounded-3xl p-6 md:p-10:
- Hint: "💡 Click any box or numbered step below for a deeper explanation."
- Same gradients/markers/particle mechanics as the original template
  (gflow indigo→purple→pink, gflow-back green, arrow markers, travel particles).

Container wrapper (opacity 0.6):
- Dashed rect at (260, 180) 560×320, rx=22, stroke #64748b
- Text: "Container · port 49160"

**5 boxes** (`<g class="node" data-info="[id]" style="cursor:pointer">`):

1. **User** at (60, 55) 170×90 — 👤, "Scientist / PM · Browser"
2. **React SPA** at (290, 220) 140×90 — ⚛️, "Browser · Vite build"
3. **FastAPI** at (620, 220) 170×90 — 🐍, "Python · REST routes"
4. **SQLite** at (430, 390) 170×100 — cylinder icon, "crucible.db · SQLAlchemy"
5. **PubChem API** at (820, 120) 150×70 — 🌐, dashed border, "External Data Source (Example)"

**4 Bézier paths + particles**: User→React, React→FastAPI, FastAPI→SQLite,
SQLite→React (response, green) — same coordinates as the original template.

**Detail panel** node descriptions:
- user: "👤 User — The starting point" / interacts through a web browser; every action becomes an event that React turns into an API call.
- react: "⚛️ React SPA — The face of Pandora" / SPA built with React 18 + Vite; fetches data with Axios; re-renders only what changed.
- express (id kept for compatibility): "🐍 FastAPI backend — The traffic controller" / Python 3.12 + FastAPI served by uvicorn; identical REST contract to the legacy Express server; validates with Pydantic; parses Excel/SDF with openpyxl & RDKit; talks to the DB through SQLAlchemy; serves the React app and /docs.
- db: "🗄️ SQLite — The single-file database" / crucible.db accessed via SQLAlchemy 2; four tables, each storing the full record verbatim in a JSON doc column + indexed lookup columns (hybrid document pattern); upgradeable to PostgreSQL by changing DATABASE_URL.
- pubchem: "🌐 PubChem API — External chemical database" / free NIH database; backend can call it to auto-fill formula, MW, SMILES, InChIKey.

**4 step-explainer cards** (①②③④) using the default labels/descs above, each
clickable with an expanded panel: step 3's expansion should mention Pydantic
validation, openpyxl/RDKit parsing, and SQLAlchemy commit to crucible.db.
```

---

### ✅ Checkpoint

- [ ] 5 boxes visible in SVG: User, React SPA, FastAPI, SQLite, PubChem
- [ ] Particles flow along all paths
- [ ] Clicking 🐍 FastAPI shows "The traffic controller" panel
- [ ] Clicking the DB shows the SQLite / hybrid-document panel
- [ ] "Simulate Read/Write/Upload" show the crucible.db scenario texts

---

## Step 4: Prompt 3 — Layers Tab

---

```
In the `#tab-layers` section of `docs/architecture-interactive.html`, add:

Heading: "🏗️ The four layers of Pandora" (text-2xl font-bold)
Subtitle: "Like floors in a building — each layer has one clear job."

4 stacked cards in a `space-y-4` div. Each card: `glass rounded-2xl p-6 lift border-l-4`.

**Layer 1 · Presentation (Client)** (border #60a5fa, 🎨, right label "client/src"):
- "A **React 18 Single Page Application** bundled by Vite and styled with Tailwind CSS."
- Bullets: Dashboard · ELN upload forms (manual, Excel, SDF) · Viewer tables
  (search, sort, bulk ops) · React Router / Axios / React Hot Toast.

**Layer 2 · API Gateway (Routers)** (border #a78bfa, 🔀, right label "backend/app/routers"):
- "A **FastAPI** application (served by uvicorn) exposing RESTful endpoints on
  port 49160 — one router file per resource, mirroring the legacy Express
  routes one-to-one."
- Bullets: CRUD /api/chemicals · POST /api/chemicals/upload/excel via
  UploadFile + openpyxl · samples/screening/toxicology · GET /api/stats
  (healthcheck + monitoring) · PubChem proxy potential · serves the React
  static build + free OpenAPI docs at /docs.

**Layer 3 · Business Logic** (border #f472b6, 🧠, right label "route handlers + utils"):
- Bullets: validation (duplicate IDs, required references) · file parsing
  (openpyxl incl. SLIMS 3-row header; RDKit-backed SDF module: V2000/V3000,
  S-Groups/polymer detection, charges, stereo, verbatim regulatory metadata) ·
  bulk operations with per-row error reporting · uuid4 record IDs ·
  compat helpers that keep response semantics identical to the legacy API.

**Layer 4 · Data Persistence** (border #34d399, 💾, right label "data/crucible.db"):
- "**SQLite** stores all data in a single file (data/crucible.db), accessed
  through the SQLAlchemy 2 ORM. Replaced the LowDB JSON file in v2.0;
  records were imported by an idempotent migration script."
- Bullets: 4 tables linked via chemical_id · hybrid document pattern
  (verbatim JSON doc column + indexed columns) · backup = copy the file ·
  volume-mounted so data survives rebuilds · PostgreSQL later = DATABASE_URL.
```

---

### ✅ Checkpoint

- [ ] Layers tab shows 4 stacked cards with colored left borders
- [ ] Layer 2/3/4 name FastAPI, openpyxl/RDKit, SQLite respectively
- [ ] Cards lift on hover; single column on mobile

---

## Step 5: Prompt 4 — Tech Stack Tab

---

```
In the `#tab-stack` section of `docs/architecture-interactive.html`, add:

Heading: "🧰 The toolbox behind the Toolbox"
Subtitle: "Every piece chosen to be modern, lightweight, and easy to maintain."

Grid: `grid md:grid-cols-2 gap-6`

**Frontend card** — unchanged list (React, Vite, Tailwind, React Router,
Axios, React Hot Toast, Heroicons), each with a clickable "why" panel.

**Backend card** (h4 "⚙️ Backend") — clickable "why" sub-cards:

1. 🐍 **Python 3.12** — "Backend runtime (python:3.12-slim container)"
   - Why: maintainer's primary language; home turf for scientific tooling
     (RDKit, pandas, openpyxl). Migrated from Node strangler-fig style with
     parity tests, so the React client never noticed.

2. ⚡ **FastAPI + uvicorn** — "Web framework + ASGI server"
   - Why: type-hint-driven routing, dependency injection, Pydantic
     validation, free OpenAPI docs at /docs. vs Flask (validation/docs are
     add-ons) and Django (heavy for a REST API with an existing frontend).

3. 🗄️ **SQLite + SQLAlchemy 2** — "Single-file database + ORM"
   - Why: zero-ops, transactional, Python-native. Hybrid document pattern
     keeps API responses byte-identical to the LowDB era. PostgreSQL later
     = DATABASE_URL change.

4. 📂 **FastAPI UploadFile** — "Multipart file uploads"
   - Why: built-in (python-multipart); same form field name as the legacy
     Multer setup, so the React upload pages work unchanged.

5. 📊 **openpyxl** — "Excel parser"
   - Why: faithful cell-level control (mirrors the legacy SheetJS raw:false
     behaviour); handles the SLIMS 3-row header; CSV path keeps CAS numbers
     as text.

6. 🧬 **RDKit** — "SDF/structure handling"
   - Why: industry-standard chemistry toolkit, pip wheels for macOS arm64 and
     linux x86_64. Hybrid design preserves MOL blocks + every regulatory
     field verbatim while RDKit computes formula/MW, polymer S-Groups,
     charges, stereo, mixtures.

7. 🔑 **uuid4** — "Unique record IDs" (why: collision-free, no counters)

**DevOps card** (md:col-span-2):
1. 🐋 **Podman / Docker** — container-py.sh auto-detects either runtime
   (CONTAINER_RUNTIME override); rootless podman on RHEL8.
2. 📦 **Multi-stage Dockerfile** — Node stage builds the React client; final
   python:3.12-slim image contains no Node.
3. 🏥 **HEALTHCHECK + monitor.sh** — /api/stats probed every 30s in-container;
   cron script restarts the container on failure.
4. 🧪 **pytest** — 45 parity tests asserting the exact legacy API contract,
   plus an optional live dual-backend diff.

**Summary card** (md:col-span-2):
- Title: "💡 Why this combination?"
- Bullets:
  - One maintainable backend language (Python) matched to the team.
  - Zero external services: SQLite file + one container.
  - Identical API contract preserved through the migration (parity-tested).
  - Easy upgrades: PostgreSQL via DATABASE_URL; TLS via reverse proxy.
```

---

### ✅ Checkpoint

- [ ] Backend card lists Python, FastAPI, SQLite/SQLAlchemy, UploadFile, openpyxl, RDKit, uuid4
- [ ] DevOps card covers container-py.sh, multi-stage Dockerfile, healthcheck, pytest
- [ ] Toggle works (click to show, click again to hide)

---

## Step 6: Prompt 5 — Data Model + Security + Deployment

---

```
In `docs/architecture-interactive.html`, fill the last 3 tabs:

**`#tab-data` — Data Model:**
- h3: "🗄️ How the data is organised"
- p: "Four tables. One central link: every record points back to a chemical."
- SVG: chemicals (center) + samples / screening / toxicology with 1:many
  relationship lines — same layout as the original template.
- Below SVG, 2-col grid:
  - "🔗 All relationships flow through `chemical_id`" — star-schema keeps queries simple.
  - "📄 Hybrid document storage" — each row stores the full record verbatim in
    a JSON `doc` column plus indexed lookup columns; adding a field requires
    no schema migration, exactly like the lowdb days.

**`#tab-security` — Security:**
- Cards: transport status (HTTP internally; TLS is an open item — reverse
  proxy or uvicorn SSL flags; the legacy stack's in-process TLS is documented
  in DEPLOYMENT.md) · input validation (server-side, Pydantic kept lenient to
  preserve the contract) · upload limits (100MB) · git hygiene (certs/, *.db,
  keys ignored) · CORS (open, revisit with SSO) · Planned (dashed border):
  SSO, RBAC, rate limiting, audit logging.

**`#tab-deploy` — Deployment:**
- h3: "🚀 Where Pandora lives"
- SVG: host box (nr-ubp-dev-02 · RHEL8 — or macOS for dev) → container
  `crucible-py` (podman/docker) containing "Python + FastAPI · :49160"
  (serves React + API) and "💾 Data volume — crucible.db (persisted)" ·
  external Health Monitor box (cron) with arrow "curl /api/stats → restart
  if unhealthy" · User browser arrow through port 49160.
- Below SVG, 3-col grid: Host · Auto-heal (HEALTHCHECK + monitor.sh) ·
  Persistent data (./data volume mount survives rebuilds; also holds
  pandora.json, the migration source and rollback snapshot).
```

---

### ✅ Checkpoint

- [ ] Data Model: 4 entity boxes + hybrid-document explainer card
- [ ] Security: transport card honestly labels TLS as an open item
- [ ] Deployment: SVG shows crucible-py container with crucible.db volume
- [ ] All tabs render correctly when switched

---

## Step 7: Prompt 6 — Polish

---

```
Review `docs/architecture-interactive.html` and fix any issues:

1. All 6 tabs show/hide correctly (only one visible at a time)
2. The 3 simulate buttons work — cards highlight sequentially with correct scenario text, restore after 4.5s
3. All 5 SVG nodes (User, React, FastAPI, SQLite, PubChem) are clickable and show their detail panels
4. All 4 step cards (①②③④) are clickable and show expanded explanations
5. Close buttons (✕) work on both detail panels
6. Footer: "Crucible: Pandora Toolbox Enhancement (v2.0) · Nestlé Research · Computational Sciences · Interactive architecture · v1.0"
7. `.reveal` elements fade in on scroll (IntersectionObserver)
8. Hover effects: nodes get thicker stroke, cards lift
9. Mobile (<768px): grids collapse to 1 column, tab bar scrolls horizontally, SVGs scale
10. No console errors
11. Particles animate smoothly on all paths
12. No stale stack references: the page must not present Express, LowDB,
    Multer or SheetJS as the current architecture (mentions as labeled
    legacy/comparison content are fine)
```

---

### ✅ Final Checklist

- [ ] Status banner + hero: floating 🧪, gradient "v2.0", 6 pill badges, 6-row stats card
- [ ] Tabs: all 6 switch correctly, active tab has gradient background
- [ ] Data Flow: 5 animated nodes (FastAPI + SQLite among them), simulate buttons, clickable everything
- [ ] Layers: 4 colored cards describing the Python stack
- [ ] Tech Stack: frontend + Python backend + DevOps cards with toggleable "why" panels
- [ ] Data Model: 4-entity SVG diagram + hybrid-document card
- [ ] Security: honest TLS status
- [ ] Deployment: crucible-py container + volume + monitor
- [ ] Footer renders with the Crucible name and Python stack
- [ ] Mobile responsive, zero console errors

---

## Result

The finished file:
- **Path**: `docs/architecture-interactive.html`
- **Size**: ~1,270 lines
- **Served at**: `http://<host>:49160/architecture`
  (baked into the Python image — run `./container-py.sh rebuild` after edits)
- **Dependencies**: None (only Tailwind CDN at runtime)

---

## Lessons Learned from Building This

1. **The architecture brief took 20 minutes but saved hours** — every prompt was specific because the facts were already written down. Corollary from the v2.0 migration: **when the architecture changes, update the brief first**, then regenerate/edit the page — a page rebuilt from a stale brief confidently documents the wrong system.
2. **The SVG diagram (Prompt 2) needed the most iteration** — particle offset-paths must exactly match the Bézier `d` attribute or they fly off-screen.
3. **Inline `<script>` placement matters** — the simulate button script must come immediately after the button HTML (not at the bottom) because it references those elements by ID.
4. **Clickable "why" panels on tech cards were the highest-ROI addition** — they answer the question every reviewer asks: "why did you pick this library?" After the migration, they also became the natural place to explain *why the stack changed*.
5. **Keep internal element IDs stable across rewrites** (the FastAPI node still uses `data-info="express"`) — it avoids touching the event-wiring JavaScript when only content changes.

---

*Originally generated: May 27, 2026 · Updated for the v2.0 Python backend: July 29, 2026*
