# Tutorial Example: Building the Pandora Toolbox 2.0 Architecture Page

A concrete, copy-paste-ready walkthrough showing exactly how the interactive architecture page for **Pandora Toolbox 2.0** was built — prompt by prompt — using Claude Opus 4.6 in VS Code (GitHub Copilot Agent mode).

> **Prerequisite**: Read the generic tutorial in `architecture-template-tutorial.md` first for the methodology. This document provides the Pandora-specific implementation.

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

- **LLM**: Claude Opus 4.6 (via GitHub Copilot in VS Code, Agent mode)
- **Editor**: VS Code with the Pandora project open
- **Project root**: `nr-nips-forrest-gump-pandora-enhancement/`
- **Output file**: `docs/architecture-interactive.html`
- **Time**: ~1.5 hours

---

## Step 1: The Architecture Brief

This is the plain-text brief prepared before any prompting. It contains all the facts the AI needs.

```
PROJECT: Pandora Toolbox 2.0
ORG: Nestlé Research · Computational Sciences · NIPS
URL: https://nr-ubp-dev-02.nihs.ch.nestle.com:49160

COMPONENTS:
- Frontend: React 18.2 + Vite 5.1 + Tailwind 3.4
- Backend: Express 4.18 on Node.js 18
- Database: LowDB 1.0 (single JSON file: pandora.json)
- External APIs: PubChem (compound lookup by CAS/name/SMILES)
- Auth: None currently (SSO planned)

DATA FLOW:
1. User clicks/searches/uploads in browser
2. React sends HTTPS request via Axios to Express API on port 49160
3. Express validates input, parses files (Excel via XLSX, SDF via custom parser)
4. LowDB reads/writes to data/pandora.json
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
  - Node.js 18 — JavaScript runtime
  - Express 4.18.2 — Web framework
  - LowDB 1.0.0 — JSON file database
  - Multer 1.4.5 — File upload middleware
  - XLSX 0.18.5 — Excel file parser
  - Custom SDF Parser — Chemical structure parser (V2000/V3000)
  - UUID 9.0.0 — Unique ID generation
  - CORS 2.8.5 — Cross-origin headers

DevOps:
  - Podman — Container runtime (rootless)
  - Nodemon — Auto-restart for development
  - monitor.sh — Cron health check (every 5min)
  - setup-ssl.sh — Certificate setup script
  - Jest + Supertest — API testing (21 tests)

DATA MODEL:
- chemicals: { id, chemical_id, name, cas_number, molecular_formula, molecular_weight, smiles, inchi_key }
- samples: { id, sample_id, chemical_id, quantity, unit, location, status }
- screening: { id, chemical_id, assay_name, result, concentration, date }
- toxicology: { id, chemical_id, study_type, species, ld50, noael, classification }
- All collections link back to chemicals via chemical_id

SECURITY:
- HTTPS/TLS on port 49160 (Nestlé-signed SSL certificates)
- Certificate management: excluded from git, MD5 verified, key chmod 600
- CORS restricted to specific origins
- Server-side input validation on every field
- File upload limit: 100MB (Multer)
- JSON body limit: 50MB
- Git ignores: certs/, data/, .env, *.key, *.crt, *.pem

DEPLOYMENT:
- Host: nr-ubp-dev-02.nihs.ch.nestle.com (RHEL Linux)
- Port: 49160 (HTTPS only, no HTTP fallback)
- Container: Podman (Node 18 Alpine base image)
- Volumes: data/pandora.json (persistent), certs/ (read-only mount)
- Health: monitor.sh via cron every 5min → curl /api/stats → auto-restart on failure
- Memory logging every 5min (RSS, heap used/total)
- Crash recovery: global handlers for uncaughtException and unhandledRejection
- Server timeouts: keepAlive 65s, headers 66s, request 120s

CAPACITY:
- ~50,000 chemicals
- ~50,000 samples
- ~50,000 screening records
- ~50,000 toxicology records
- 50–100 concurrent users
- 100MB max file upload
```

---

## Step 2: Prompt 1 — Skeleton + Hero + Tabs + CSS

Paste this into Copilot Chat (Agent mode):

---

```
Create a single self-contained HTML file at `docs/architecture-interactive.html` for **Pandora Toolbox 2.0**.

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

**Hero header** (max-w-7xl mx-auto, pt-14 pb-10):
- Left: 🧪 emoji in a w-12 h-12 floating glass+glow rounded-xl box
- Below icon: "Nestlé Research · Computational Sciences · NIPS" in xs uppercase tracking-[0.3em] text-indigo-300
- Title: "Pandora Toolbox **2.0**" with "2.0" in gradient-text (text-2xl font-semibold)
- Large heading (text-4xl md:text-5xl font-bold): "How **Pandora** works, explained visually." with "Pandora" in gradient-text
- Subtitle: "Architecture of Chemical & Sample Management System — from the user's browser, across the network, into the container, and down to the database."
- Pill badges (flex-wrap gap-2 mt-6): 🌐 Web App, ⚛️ React + Vite, 🟢 Node.js + Express, 📦 Podman Container, 🔒 HTTPS / TLS
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

**Footer**: "Pandora Toolbox 2.0 · Nestlé Research · Computational Sciences · Interactive architecture · v1.0" and "Built using React, Express, LowDB & Podman."

**JavaScript**:
- Tab switching: click toggles active class, shows/hides sections
- IntersectionObserver: adds `visible` to `.reveal` at threshold 0.1

No content inside sections yet.
```

---

### ✅ Checkpoint

- [ ] Hero with floating 🧪, gradient "2.0", pill badges, stats card
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
- read: labels=['👁️ View list','📡 GET /api/chemicals','📖 Read pandora.json','📋 Table renders'], descs=['User clicks "View Chemicals" in the sidebar','Axios fires GET request over HTTPS','LowDB loads matching records from JSON','React renders rows into the table']
- write: labels=['✏️ Save form','📡 POST /api/chemicals','✅ Validate + write','🎉 Toast: Saved!'], descs=['User fills out the form and clicks Save','Axios POSTs the JSON payload over HTTPS','Express validates then writes to pandora.json','Success toast appears, table refreshes']
- upload: labels=['📂 Pick Excel','📡 POST upload/excel','🧮 Parse + bulk insert','📊 Summary report'], descs=['User selects an Excel or SDF file','File sent as multipart form-data over HTTPS','XLSX parses rows, validates, bulk-inserts','Summary shows inserted/updated/error counts']

Default labels: ['User Interaction','Secure API Call','Business Logic','UI Updates']
Default descs: ['Click, search, upload — events captured by React components.','Axios sends an HTTPS request over TLS to the Express API.','Server validates input, parses files (Excel/SDF), updates the database.','JSON response flows back; the page refreshes instantly without reload.']

runScenario function: on click, reset all 4 cards, then sequentially (500ms delay each) highlight step-card-N with indigo glow (rgba(99,102,241,0.4) bg, box-shadow, outline), update label and desc text. Restore defaults after 4500ms.

**SVG** (viewBox="0 0 1000 560", w-full h-auto) inside glass rounded-3xl p-6 md:p-10:
- Hint: "💡 Click any box or numbered step below for a deeper explanation."

<defs>:
- linearGradient id="gflow" x1=0 x2=1: #6366f1 → #a855f7 → #ec4899
- linearGradient id="gflow-back" x1=1 x2=0: #34d399 → #a5b4fc
- marker id="arrow": purple triangle (#c4b5fd)
- marker id="arrow-green": green triangle (#86efac)
- marker id="arrow-cyan": cyan triangle (#38bdf8)

Container wrapper (opacity 0.6):
- Dashed rect at (260, 180) 560×320, rx=22, stroke #64748b
- Podman seal icon at (600, 190): purple circles + ellipses forming a seal face
- Text: "Podman Container · port 49160 · HTTPS"

**5 boxes** (`<g class="node" data-info="[id]" style="cursor:pointer">`):

1. **User** at (60, 55) 170×90:
   - rect: fill #1e1b4b, stroke #818cf8, rx=16
   - text 👤 at (145, 93)
   - "User" at (145, 117), fill #e0e7ff, size 13, bold
   - "Scientist / PM · Browser" at (145, 133), fill #94a3b8, size 10

2. **React SPA** at (290, 220) 140×90:
   - rect: fill #0c4a6e, stroke #38bdf8, rx=16
   - text ⚛️ at (360, 258)
   - "React SPA" at (360, 282), fill #e0f2fe
   - "Browser · Vite build" at (360, 298), fill #94a3b8

3. **Express API** at (620, 220) 170×90:
   - rect: fill #3b0764, stroke #a78bfa, rx=16
   - text 🟢 at (705, 258)
   - "Express API" at (705, 282), fill #ede9fe
   - "Node.js · REST routes" at (705, 298), fill #94a3b8

4. **LowDB** at (430, 390) 170×100:
   - rect: fill #064e3b, stroke #34d399, rx=16
   - Cylinder icon at (515, 418): ellipse rx=18 ry=6 fill #34d399, path for cylinder body fill #10b981, two inner ellipses for "stacked data" look
   - "LowDB" at (515, 465), fill #d1fae5
   - "pandora.json" at (515, 481), fill #94a3b8

5. **PubChem API** at (820, 120) 150×70:
   - rect: fill #1e3a5f, stroke #38bdf8, stroke-dasharray="4,3", rx=14
   - text 🌐 at (895, 150)
   - "PubChem API" at (895, 168), fill #7dd3fc
   - "External Data Source (Example)" at (895, 182), fill #94a3b8, size 9

**4 Bézier paths** (flow-path class, stroke-width 3, stroke gradient, arrow markers):
- p1 User→React: `M 145 145 C 145 170, 300 170, 360 180 L 360 220` (gflow, marker-end arrow)
- p2 React→Express: `M 430 265 C 490 240, 560 240, 620 265` (gflow, marker-end arrow)
- p3 Express→LowDB: `M 705 310 C 705 400, 680 440, 600 440` (gflow, marker-end arrow)
- p4 LowDB→React (response): `M 430 440 C 360 440, 360 390, 360 310` (gflow-back, flow-reverse class, marker-end arrow-green)
- p-pubchem PubChem→Express: `M 895 190 Q 895 240 790 265` (stroke #38bdf8, width 1.8, dasharray 6,4, marker-end arrow-cyan)

**Particles** (circles with offset-path):
- r=6 fill #fde68a on p1 path, travel 3s
- r=6 fill #a5f3fc on p2 path, travel 2.4s delay 0.6s
- r=6 fill #fbcfe8 on p3 path, travel 2.6s delay 1.2s
- r=5 fill #86efac on p4 path, travel 3.4s delay 1.8s
- r=4 fill #38bdf8 on pubchem path using <animateMotion dur="3s" repeatCount="indefinite">

**HTTPS lock badge** at (250, 165):
- circle r=16, fill #1e293b, stroke #f472b6
- 🔒 emoji inside
- "HTTPS / TLS" label

**Step labels** (text on SVG):
- "1. Click / submit" at (130, 180), fill #a5b4fc
- "2. REST request" at (475, 255), fill #a5b4fc
- "3. Read / Write" at (715, 365), fill #a5b4fc
- "4. JSON response → UI updates" at (240, 355), fill #86efac

**Detail panel** (hidden div, id="node-detail", glass rounded-xl p-4, border-indigo-400/30):
- p#node-detail-title (font-semibold text-indigo-200)
- p#node-detail-body (text-slate-300 text-xs)
- button#node-detail-close (✕)

Node descriptions:
- user: "👤 User — The starting point" / "A scientist or project manager interacts with Pandora through a web browser. Every action they take becomes an event that the React app captures and turns into a secure API call."
- react: "⚛️ React SPA — The face of Pandora" / "A Single Page Application built with React 18 and bundled by Vite. It runs entirely inside the browser — pages don't reload. It fetches data using Axios over HTTPS, then re-renders only what changed."
- express: "🟢 Express API — The traffic controller" / "A Node.js 18 server using the Express framework. It exposes REST endpoints like /api/chemicals, validates every request, handles file uploads via Multer, parses Excel with XLSX and SDF with a custom parser. It also serves the compiled React app to the browser on port 49160."
- db: "🗄️ LowDB — The single-file database" / "A lightweight JSON-based database stored as one file: pandora.json. It holds four collections — chemicals, samples, screening, toxicology — and comfortably handles ~50,000 total records. Beyond that, consider migrating to SQLite or PostgreSQL. The file lives on a persistent volume so data survives container restarts."
- pubchem: "🌐 PubChem API — External chemical database" / "PubChem (pubchem.ncbi.nlm.nih.gov) is a free NIH database with 100M+ compounds. Pandora can call it to auto-fill molecular formula, weight, SMILES, and InChIKey when a user enters a CAS number or compound name."

**4 step-explainer cards** (grid md:grid-cols-4 gap-3):
- step-card-1: ① User Interaction / "Click, search, upload — events captured by React components."
- step-card-2: ② Secure API Call / "Axios sends an HTTPS request over TLS to the Express API."
- step-card-3: ③ Business Logic / "Server validates input, parses files (Excel/SDF), updates the database."
- step-card-4: ④ UI Updates / "JSON response flows back; the page refreshes instantly without reload."
Each has class `step-card`, data-step="N", is clickable.

**Expanded step panel** (id="step-detail", hidden, border-pink-400/30):
Step explanations (HTML content):
- Step 1: "User clicks a button, types a search query, or drops an Excel/SDF file onto the upload area. React captures this as a JavaScript event — onChange, onClick, or onDrop. No network call happens yet; only the user's intent is recorded in component state."
- Step 2: "Axios constructs an HTTP request (GET for reads, POST for creates, PUT for updates, DELETE for removals). The request travels over TLS-encrypted HTTPS to port 49160. The server's SSL certificate — signed by the Nestlé Root CA — proves the server's identity to the browser."
- Step 3: "The Express route handler receives the request. It validates required fields, checks types and formats (CAS numbers, numeric weights). For file uploads, Multer saves the file to a temp path, then XLSX or the custom SDF parser extracts rows. Valid records are written to pandora.json via LowDB. Invalid rows are collected into an errors array."
- Step 4: "Express sends back a JSON response with the result (created record, updated count, or error details). Axios resolves its Promise. React's setState triggers a re-render — only the affected components update. A toast notification (React Hot Toast) confirms success or reports errors. No page reload occurs."

**JavaScript** (at bottom with other scripts):
- Node click handler: find data-info, show panel, scroll into view
- Node hover: increase stroke-width to 3.5, restore on leave
- Close button hides panel
- Step card click: show step-detail panel with HTML content
- Step close button hides panel
```

---

### ✅ Checkpoint

- [ ] 5 boxes visible in SVG with correct labels
- [ ] Particles flow along all paths
- [ ] Clicking 👤 User shows "The starting point" panel
- [ ] Clicking ⚛️ React shows "The face of Pandora" panel
- [ ] Clicking ① shows detailed step explanation
- [ ] "Simulate Read" highlights cards sequentially with correct text
- [ ] "Simulate Upload" shows file upload scenario
- [ ] PubChem box has dashed border and animated particle

---

## Step 4: Prompt 3 — Layers Tab

---

```
In the `#tab-layers` section of `docs/architecture-interactive.html`, add:

Heading: "🏗️ The four layers of Pandora" (text-2xl font-bold)
Subtitle: "Like floors in a building — each layer has one clear job." (text-slate-400 text-sm mb-6)

4 stacked cards in a `space-y-4` div. Each card: `glass rounded-2xl p-6 lift border-l-4`.

**Layer 1** (border-color: #60a5fa):
- Emoji: 🎨 (text-3xl)
- Label: "Layer 1 · Presentation (Client)" in text-xs uppercase tracking-wider text-sky-300
- Title: "What the user sees and interacts with" (font-semibold text-lg)
- Description: "A **React 18 Single Page Application** bundled by Vite and styled with Tailwind CSS. It runs entirely in the user's browser — no server-side rendering."
- Bullets (text-slate-400 text-xs, list-disc pl-5):
  - **Dashboard** — summary cards showing record counts, recent activity, and system health.
  - **ELN (Electronic Lab Notebook)** — upload forms for Chemicals, Samples, Screening, and Toxicology. Supports manual entry, Excel bulk upload, and SDF chemical structure files.
  - **Viewer** — paginated data tables with search, sort, inline editing, bulk select/delete, and molecular structure preview.
  - **React Router** handles navigation without page reloads; **Axios** handles all HTTP calls; **React Hot Toast** provides user feedback.
- Right label: "client/src" (hidden md:block text-xs text-slate-500)

**Layer 2** (border-color: #a78bfa):
- Emoji: 🔀 (text-3xl)
- Label: "Layer 2 · API Gateway (Server Routes)" in text-violet-300
- Title: "The traffic controller & request dispatcher"
- Description: "An **Express.js** HTTP server exposing RESTful endpoints over HTTPS on port 49160. Each route maps to a specific resource and operation."
- Bullets:
  - `GET/POST/PUT/DELETE /api/chemicals` — CRUD operations for chemical records.
  - `POST /api/chemicals/upload/excel` — bulk import from Excel via Multer + XLSX.
  - `GET/POST /api/samples`, `/api/screening`, `/api/toxicology` — similar patterns for other collections.
  - `GET /api/stats` — health check and record counts (used by the monitoring cron).
  - **External API proxy:** can call PubChem to enrich or sync data without exposing credentials to the frontend.
  - **Static file server:** serves the built React app + the interactive architecture page.
- Right label: "server/src/routes"

**Layer 3** (border-color: #f472b6):
- Emoji: 🧠 (text-3xl)
- Label: "Layer 3 · Business Logic (Middleware & Handlers)" in text-pink-300
- Title: "The brain — validation, transformation & rules"
- Description: "Code that runs *between* receiving the request and writing to the database. This is where domain rules live."
- Bullets:
  - **Input validation**: required fields, type checks, CAS number format (NN-NN-N pattern).
  - **File parsing**: XLSX library for Excel, custom sdfParser.js for SDF V2000/V3000 molfiles.
  - **Molecular computation**: formula from atom block (Hill order), weight from IUPAC 2021 masses.
  - **Duplicate detection**: checks chemical_id / cas_number before insert.
  - **Capacity enforcement**: rejects uploads exceeding 50,000 record limit per collection.
  - **Bulk operations**: batch insert/update/delete with per-row error reporting.
  - **UUID generation** for new record IDs (cryptographically random, no collisions).
- Right label: "in route handlers"

**Layer 4** (border-color: #34d399):
- Emoji: 💾 (text-3xl)
- Label: "Layer 4 · Data Persistence (Storage)" in text-emerald-300
- Title: "The memory — where records live"
- Description: "**LowDB** stores all data in a single JSON file (`data/pandora.json`). Chosen for simplicity, zero-config, and human-readable backups."
- Bullets:
  - 4 collections: chemicals, samples, screening, toxicology.
  - All records are plain JSON objects — easy to inspect, export, or migrate.
  - File lives on a Podman volume mount → survives container restarts and rebuilds.
  - **Backup = copy one file.** Restore = paste it back.
  - Migration path when scale demands it: SQLite → PostgreSQL.
- Right label: "data/pandora.json"
```

---

### ✅ Checkpoint

- [ ] Layers tab shows 4 stacked cards with colored left borders
- [ ] Each card has emoji, label, title, description, bullets, path label
- [ ] Cards lift on hover
- [ ] Responsive: single column on mobile

---

## Step 5: Prompt 4 — Tech Stack Tab

---

```
In the `#tab-stack` section of `docs/architecture-interactive.html`, add:

Heading: "🧰 The toolbox behind the Toolbox" (text-2xl font-bold)
Subtitle: "Every piece chosen to be modern, lightweight, and easy to maintain. Here's what each does and why it was picked."

Grid: `grid md:grid-cols-2 gap-6`

**Frontend card** (glass rounded-2xl p-6):
- h4: "🎨 Frontend" (font-semibold text-lg mb-4)
- Vertical list of clickable sub-cards. Each sub-card is `glass rounded-lg p-3 lift cursor-pointer` with `onclick="document.getElementById('[id]-why').classList.toggle('hidden')"`:

1. ⚛️ **React** 18.2 — "UI component framework"
   - Why panel (id="react-why", hidden, mt-2 p-2 rounded bg-indigo-950/50 text-xs):
     "Component model makes complex UIs manageable. Huge ecosystem. Excellent DevTools. One-way data flow prevents bugs."

2. ⚡ **Vite** 5.1 — "Build tool & dev server"
   - Why: "10-100× faster than Webpack for dev startup. Hot Module Replacement updates the browser in <50ms. Native ES modules — no bundling during development."

3. 🎨 **Tailwind CSS** 3.4 — "Utility-first styling"
   - Why: "No context-switching to CSS files. Consistent design tokens. Production bundle is tiny (purges unused classes automatically)."

4. 🧭 **React Router** 6.22 — "Client-side navigation"
   - Why: "SPA navigation without page reloads. URL-driven state makes pages bookmarkable and shareable."

5. 📡 **Axios** 1.6.7 — "HTTP client"
   - Why: "Cleaner API than fetch(). Automatic JSON transforms. Request/response interceptors for global error handling."

6. 🍞 **React Hot Toast** 2.4 — "Notifications"
   - Why: "Lightweight (5KB). Beautiful defaults. Accessible (ARIA roles). Promise-based API for async feedback."

7. 🦸 **Heroicons** 2.1 — "SVG icon set"
   - Why: "Made by the Tailwind team — consistent style. 24px grid. Tree-shakeable (only ships icons you import)."

**Backend card** (glass rounded-2xl p-6):
- h4: "🟢 Backend"

1. 🟢 **Node.js** 18 — "JavaScript runtime"
   - Why: "Same language front and back. Non-blocking I/O handles concurrent requests. LTS until 2025."

2. 🚂 **Express** 4.18 — "Web framework"
   - Why: "Minimal and unopinionated. Massive middleware ecosystem. The de-facto Node.js web standard for 10+ years."

3. 📂 **LowDB** 1.0 — "JSON file database"
   - Why: "Zero config — no daemon, no port, no setup. Human-readable file. Perfect for <50K records. Easy to migrate later."

4. 📎 **Multer** 1.4.5 — "File upload middleware"
   - Why: "Handles multipart/form-data. Configurable size limits (100MB). Stores to disk — no memory overflow for large files."

5. 📊 **XLSX** 0.18.5 — "Excel parser"
   - Why: "Reads .xlsx, .xls, .csv. Returns rows as JSON arrays. Pure JavaScript — no native binary dependencies."

6. 🧬 **SDF Parser** (custom) — "Chemical structure file parser"
   - Why: "No npm package handles V2000+V3000 with property extraction. Custom parser computes molecular formula (Hill order) and weight (IUPAC 2021 masses). 200 lines of code."

7. 🔑 **UUID** 9.0 — "Unique ID generation"
   - Why: "Cryptographically random. Zero collision risk. No sequential patterns to guess or enumerate."

8. 🌐 **CORS** 2.8.5 — "Cross-origin headers"
   - Why: "Required when Vite dev server (:5173) calls Express (:49160). Configurable allowed origins for production."

**DevOps card** (glass rounded-2xl p-6 md:col-span-2):
- h4: "⚙️ DevOps & Infrastructure"

1. 🐋 **Podman** — "Container runtime"
   - Why: "Rootless by default (no daemon, more secure). OCI-compliant. Docker-compatible commands. Approved by Nestlé IT."

2. 🔄 **Nodemon** — "Auto-restart (dev)"
   - Why: "Watches source files. Restarts Node.js on any change. Zero config for development workflows."

3. 🏥 **monitor.sh** — "Health check cron"
   - Why: "Curls /api/stats every 5 minutes. If the container is unresponsive, auto-restarts it. Logs everything to /tmp/pandora-monitor.log."

4. 🔒 **setup-ssl.sh** — "Certificate setup"
   - Why: "Copies Nestlé-signed certs to correct paths. Sets chmod 600 on private key. Validates certificates via MD5 hash comparison."

5. 🧪 **Jest + Supertest** — "API testing"
   - Why: "21 automated tests covering all CRUD endpoints, capacity limits, error cases, and the /architecture route. Runs in <3 seconds."

**Summary card** (glass rounded-2xl p-6 md:col-span-2 border border-indigo-400/20):
- Title: "💡 Why this combination?"
- Bullets:
  - **One language everywhere**: JavaScript/Node.js front-to-back reduces context switching and lets one developer own the full stack.
  - **Zero external services**: No PostgreSQL, no Redis, no RabbitMQ to install, configure, or maintain. The entire app is one container.
  - **5-minute setup**: Clone → `npm install` → `npm start`. Works on any machine with Node 18+.
  - **Easy to migrate**: When scale demands it, swap LowDB → SQLite → PostgreSQL without touching a single frontend component.
```

---

### ✅ Checkpoint

- [ ] Frontend card: 7 technologies, each clickable to reveal "why"
- [ ] Backend card: 8 technologies with "why" panels
- [ ] DevOps card: 5 tools spanning full width
- [ ] Summary card at bottom with philosophy bullets
- [ ] Toggle works (click to show, click again to hide)

---

## Step 6: Prompt 5 — Data Model + Security + Deployment

---

```
In `docs/architecture-interactive.html`, fill the last 3 tabs:

**`#tab-data` — Data Model:**
- h3: "🗄️ How the data is organised"
- p: "Four collections. One central link: every record points back to a chemical."
- SVG (viewBox="0 0 900 420") inside glass rounded-3xl p-6 md:p-10:
  - **chemicals** box (center-left, 320 60, 200×200): indigo border (#818cf8), dark fill, title "🧬 chemicals" at top, fields listed vertically: id, chemical_id, name, cas_number, molecular_formula, molecular_weight, smiles, inchi_key
  - **samples** box (top-right, 600 30, 180×160): sky border (#38bdf8), title "🧫 samples", fields: id, sample_id, chemical_id, quantity, unit, location, status
  - **screening** box (bottom-left, 100 280, 180×130): pink border (#f472b6), title "🔬 screening", fields: id, chemical_id, assay_name, result, concentration, date
  - **toxicology** box (bottom-right, 600 260, 180×140): amber border (#fbbf24), title "☣️ toxicology", fields: id, chemical_id, study_type, species, ld50, noael, classification
  - Relationship lines (stroke #64748b, stroke-width 1.5):
    - samples → chemicals (with label "chemical_id →")
    - screening → chemicals
    - toxicology → chemicals
  - Small "1:N" labels on each relationship line
- Below SVG: 2-col grid:
  - "🔗 All relationships flow through `chemical_id`" — "Every sample, screening result, and toxicology study links back to a chemical record. This star-schema design keeps queries simple."
  - "📄 JSON format = no migrations" — "Adding a new field to any collection requires zero schema changes. Just start writing the new key — existing records without it still work."

**`#tab-security` — Security:**
- h3: "🛡️ Keeping data safe"
- p: "Defense in depth — multiple layers, simple to explain."
- Grid: `grid md:grid-cols-3 gap-4`

Cards (glass rounded-2xl p-5 lift):
1. 🔒 **HTTPS / TLS** — "All traffic encrypted with Nestlé-signed SSL certificates. No HTTP fallback. Certificate verified by browser via Root CA."
2. 📜 **Certificate Management** — "Certs excluded from git (.gitignore). MD5 hash verified on deployment. Private key restricted to chmod 600."
3. 🚧 **CORS Policy** — "Only configured origins can call the API. Blocks requests from unknown browsers, scripts, and domains."
4. ✅ **Input Validation** — "Server-side checks on every field. Required fields enforced. CAS number format validated. Numeric types checked."
5. 📦 **Upload Limits** — "Multer caps file size at 100MB. Express body-parser limits JSON to 50MB. Protects against memory exhaustion."
6. 🔮 **Planned Enhancements** — (border border-dashed border-amber-400/40): "SSO authentication, role-based access control, API rate limiting, audit logging, certificate expiry monitoring."

**`#tab-deploy` — Deployment:**
- h3: "🚀 Where Pandora lives"
- p: "A self-contained container that heals itself."
- SVG (viewBox="0 0 1000 460") inside glass rounded-3xl p-6 md:p-10:
  - Outer rect: "nr-ubp-dev-02.nihs.ch.nestle.com" server (full width, light border)
  - Inner dashed rect: "Podman Container" (with small podman seal icon)
  - Inside container:
    - Box: "Node.js HTTPS Server · :49160" (indigo)
    - Box: "📁 data/pandora.json" with "Volume mount (persistent)" label (emerald)
    - Box: "🔒 certs/" with "Read-only mount" label (pink)
  - External box (bottom-left): "🏥 Health Monitor" with "cron · every 5min" subtitle
  - Arrow from monitor → container: "curl /api/stats → restart if unhealthy"
  - External box (top): "👤 User Browser"
  - Arrow from user → container through "HTTPS :49160"
- Below SVG: 3-col grid:
  - "🖥️ Host" — "nr-ubp-dev-02 · RHEL Linux · Nestlé internal network"
  - "🔄 Auto-heal" — "monitor.sh checks every 5 minutes. If /api/stats fails, container is restarted automatically. Logs to /tmp/pandora-monitor.log."
  - "💾 Persistent data" — "pandora.json lives on a volume mount. Container can be rebuilt, restarted, or replaced — data survives."
```

---

### ✅ Checkpoint

- [ ] Data Model: 4 entity boxes with fields, relationship lines with labels
- [ ] Security: 6 cards in 3-column grid, last card has dashed amber border
- [ ] Deployment: SVG shows server → container → internal components + monitor
- [ ] All tabs render correctly when switched

---

## Step 7: Prompt 6 — Polish

---

```
Review `docs/architecture-interactive.html` and fix any issues:

1. All 6 tabs show/hide correctly (only one visible at a time)
2. The 3 simulate buttons work — cards highlight sequentially with correct scenario text, restore after 4.5s
3. All 5 SVG nodes (User, React, Express, LowDB, PubChem) are clickable and show their detail panels
4. All 4 step cards (①②③④) are clickable and show expanded explanations
5. Close buttons (✕) work on both detail panels
6. Footer: "Pandora Toolbox 2.0 · Nestlé Research · Computational Sciences · Interactive architecture · v1.0"
7. `.reveal` elements fade in on scroll (IntersectionObserver)
8. Hover effects: nodes get thicker stroke, cards lift
9. Mobile (<768px): grids collapse to 1 column, tab bar scrolls horizontally, SVGs scale
10. No console errors
11. Particles animate smoothly on all 5 paths
12. The Podman seal icon renders correctly (purple circles forming a face)
```

---

### ✅ Final Checklist

- [ ] Hero: floating 🧪, gradient "2.0", 5 pill badges, 6-row stats card
- [ ] Tabs: all 6 switch correctly, active tab has gradient background
- [ ] Data Flow: 5 animated nodes, 5 particle paths, 3 simulate buttons, clickable everything
- [ ] Layers: 4 colored cards with complete content
- [ ] Tech Stack: 20 technologies with toggleable "why" panels + philosophy card
- [ ] Data Model: 4-entity SVG diagram with relationship lines
- [ ] Security: 6 cards including "Planned" with dashed border
- [ ] Deployment: SVG with server/container/volumes/monitor
- [ ] Footer renders
- [ ] Mobile responsive
- [ ] Zero console errors

---

## Result

The finished file:
- **Path**: `docs/architecture-interactive.html`
- **Size**: ~1,070 lines
- **Served at**: `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160/architecture`
- **Dependencies**: None (only Tailwind CDN at runtime)

---

## Lessons Learned from Building This

1. **The architecture brief took 20 minutes but saved hours** — every prompt was specific because the facts were already written down.
2. **The SVG diagram (Prompt 2) needed the most iteration** — particle offset-paths must exactly match the Bézier `d` attribute or they fly off-screen.
3. **Inline `<script>` placement matters** — the simulate button script must come immediately after the button HTML (not at the bottom) because it references those elements by ID.
4. **The Podman seal icon is a fun detail** — small purple circles and ellipses forming a seal face. It's only 6 SVG elements but adds personality.
5. **Clickable "why" panels on tech cards were the highest-ROI addition** — they answer the question every reviewer asks: "why did you pick this library?"

---

*Generated: May 27, 2026*
