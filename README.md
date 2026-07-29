# Crucible: Pandora Toolbox Enhancement (v2.0)

Chemical and Sample Management System - MVP

A comprehensive web application for managing chemical compounds, samples, screening data, and toxicology information with an integrated Electronic Lab Notebook (ELN). Deployed with **HTTPS/TLS** encryption using official Nestlé SSL certificates.

## 🚀 Quick Start

### Python backend (recommended — the new stack)

```bash
git clone https://github.com/akannan2987/crucible.git
cd crucible

# One command does everything (certs if available, build, start, migrate,
# verify, optional monitoring cron) — on macOS AND the RHEL8 VM:
./setup-after-clone-py.sh

# Or the individual steps:
./container-py.sh build      # build (auto-detects podman or docker)
./container-py.sh start      # run on http://localhost:49160
./container-py.sh migrate    # import existing lowdb data (idempotent)
```

Full runbooks (macOS Docker/Podman, RHEL8 Podman): **[MIGRATION.md](MIGRATION.md)**

### Legacy Node backend — fresh clone

```bash
# Clone the repository
git clone https://github.com/akannan2987/crucible.git
cd crucible

# Run the automated setup script
chmod +x setup-after-clone.sh
./setup-after-clone.sh
```

The setup script will:
1. Copy SSL certificates from the Nestlé certificate store
2. Verify certificate/key pair integrity
3. Create the data directory
4. Build the container image
5. Start the application with HTTPS
6. Optionally configure health monitoring

### Development Mode

```bash
# Install dependencies
npm run install:all

# Run in development mode
npm run dev
```

Access the application:
- **Production (HTTPS):** `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160`
- **Development:** `http://localhost:3000` (frontend) + `http://localhost:49160` (API)

---

## ✨ Features

- **Chemicals Management**: Upload and manage chemicals with bulk operations (no upload limit; optimized for 15,000+)
- **Sample Management**: Manage samples linked to chemicals (no upload limit; optimized for 1,000+)
- **Screening Data**: Store and link screening assay results to chemicals
- **Toxicology Data**: Manage toxicology study data linked to chemicals
- **Bulk Operations**: Multi-select, bulk delete, and bulk edit functionality
- **Live Dashboard**: Auto-refreshing dashboard with real-time statistics (5s interval)
- **Excel Upload**: Bulk import via Excel files with custom column mapping
- **RESTful API**: Complete API for programmatic access
- **HTTPS/TLS**: Encrypted connections using official Nestlé SSL certificates
- **Health Monitoring**: Automated health checks with auto-restart capability

---

## 🏗️ Architecture

> ⚙️ **Migration in progress (strangler fig):** the backend is being replaced
> by a **Python/FastAPI** implementation with an identical API. Both backends
> currently coexist in this repo; the React client works unchanged against
> either. See **[MIGRATION.md](MIGRATION.md)** for runbooks and the cutover plan.

**Tech Stack (new — Python backend, `backend/`):**
- **Frontend**: React 18 + Vite 5 + Tailwind CSS 3.4 (unchanged)
- **Backend**: Python 3.12 + FastAPI + uvicorn
- **Database**: SQLite via SQLAlchemy 2 (`data/crucible.db`; PostgreSQL-ready via `DATABASE_URL`)
- **Chemistry**: RDKit (SDF/structure handling)
- **Excel**: openpyxl (SLIMS sample template + chemical templates)
- **Container**: `crucible-py` image, managed by `container-py.sh` (podman or docker)

**Tech Stack (legacy — Node backend, `server/`, kept until cutover):**
- **Backend**: Node.js 18 + Express 4.18
- **Database**: LowDB 1.0 (JSON file: `data/pandora.json`)
- **Container**: `crucible` image, managed by `container.sh`

**Modules:**
1. **ELN (Electronic Lab Notebook)**: Upload interface for all data types
2. **Data Viewer**: Search, filter, and view all uploaded data
3. **Dashboard**: Real-time statistics and capacity monitoring

📚 **[View Architecture Details →](docs/architecture.md)** · **[Migration Guide →](MIGRATION.md)**

---

## 📦 Installation

### Prerequisites

- Podman or Docker (for containerized deployment — covers everything else)
- For bare-metal development only:
  - Node.js 18+ and npm 8+ (client + legacy server)
  - Python 3.12+ (new backend)
- OpenSSL (for certificate verification)
- Access to Nestlé certificate store (for HTTPS on the legacy stack)

### Install Dependencies (bare-metal development)

```bash
# From the project root directory:

# Node side (root, client, and legacy server)
npm run install:all

# Python backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
```

---

## 🛠️ Development

### Local Development (Hot Reload)

```bash
# Start frontend + legacy Node backend in development mode
npm run dev
```

This starts:
- Frontend dev server: `http://localhost:3000`
- Backend API server: `http://localhost:49160`

**Developing against the Python backend instead:**

```bash
# Terminal 1 — FastAPI with auto-reload on a side port
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000

# Terminal 2 — point the Vite proxy at it (no file edits needed)
cd client && VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev
```

### Build for Production

```bash
# Build the React frontend
npm run build

# Start the production server on port 49160
PORT=49160 npm start
```

Production app runs at: `http://localhost:49160`

---

## 🧪 Testing

### Python backend (45 parity tests)

```bash
cd backend
.venv/bin/pytest                     # contract-parity tests vs the Express behaviour
```

Optionally run the **live dual-backend diff** (identical requests against both
backends, responses compared) — see [backend/README.md](backend/README.md).

### Legacy Node backend (70 tests)

```bash
# From repo root (after running ./setup-after-clone.sh):
npm test

# Or directly:
cd server
npm test                # runs all 70 tests
npm run test:watch      # re-runs on file changes
```

> If `npm test` hangs on shared filesystems (e.g. GPFS), call the local binary directly to bypass npx's interactive install prompt:
> ```bash
> ./node_modules/.bin/jest --runInBand --watchman=false --forceExit
> ```

Tests cover (70 total, ~1s):
- **API** (21 tests): Statistics health, Chemicals CRUD + duplicate rejection, Samples CRUD, Screening (chemical linkage + filter), Toxicology, capacity limits, Architecture page
- **SDF Parser** (24 tests): V2000/V3000 parsing, V3000 line continuations, S-Groups (SRU/MUL/COP/MIX/SUP), polymer & mixture detection, stereochemistry, formal charges, catch-all metadata, Tier 1 named fields (`dtxsid`, `preferred_name`, `monoisotopic_mass`, `ms_ready_smiles`, `synonyms`)
- **Samples Parser** (25 tests): SLIMS 3-row header detection, field renames (`Barcode`→`sample_id`, etc.), European date normalisation (`DD/MM/YYYY`→ISO), metadata preservation, `chemical_ids` linkage defaults

---

## 🐳 Container Deployment

Both scripts auto-detect **podman or docker** (override with
`CONTAINER_RUNTIME=docker|podman`) and check the podman VM state on macOS.
Port override: `CRUCIBLE_PORT=<n>` (a generic `PORT` env var is ignored to
avoid clashes on shared machines).

### Deploy on the RHEL8 VM (production) — field-tested sequence

```bash
# On the VM (full runbook with troubleshooting: MIGRATION.md §6–§7)
cd /path/to/crucible
# Precaution: freeze the OLD Node app so nothing writes to pandora.json
# during migration. If it was never deployed on this machine, this prints
# "Container was not running" — that is expected and fine.
./container.sh stop 2>/dev/null || true
cp -r data ~/data-backup-$(date +%Y%m%d)  # back up production data
git pull
./container-py.sh build
./container-py.sh start                   # publishes 0.0.0.0:49160
./container-py.sh migrate                 # lowdb → SQLite (idempotent)
curl --noproxy '*' -s http://localhost:49160/api/stats
# then: systemd auto-start (MIGRATION.md §6) and cutover checklist (§8)
```

App URL: `http://nr-ubp-dev-02.nihs.ch.nestle.com:49160`. Firewall notes
(firewalld vs plain iptables vs none): MIGRATION.md Runbook C step 3.

### Python backend (new stack)

```bash
./container-py.sh build       # Build image (node build stage + python:3.12-slim)
./container-py.sh start       # Start on port 49160 (HTTP)
./container-py.sh start-ssl   # Start with HTTPS (certs/server.crt + server.key)
./container-py.sh migrate     # lowdb → SQLite import (idempotent)
./container-py.sh status      # Status + /api/stats healthcheck
./container-py.sh logs        # View logs
./container-py.sh stop        # Stop container
./container-py.sh rebuild     # Rebuild image + restart
./container-py.sh shell       # Shell inside the container
./container-py.sh clean       # Remove container and image
```

### 💾 Backup & Restore (Python backend — same commands on Mac and RHEL8)

```bash
./container-py.sh backup       # consistent snapshot → backups/ (safe while running)
./container-py.sh restore      # list available backups
./container-py.sh restore backups/crucible-<stamp>.db   # stop → swap db → restart
```

Backs up `data/crucible.db` (SQLite online-backup API — never a torn copy)
plus a `pandora.json` snapshot. Details, VM cron schedule, and
machine-to-machine transfer: **[MIGRATION.md §11](MIGRATION.md#11-backup--restore-python-backend)**.

### Legacy Node backend

```bash
# First-time setup after clone (HTTPS)
./setup-after-clone.sh

# Or manual steps:
./container.sh build
./container.sh start-ssl
```

```bash
./container.sh build       # Build container image
./container.sh start       # Start container (HTTP only)
./container.sh start-ssl   # Start container with HTTPS
./container.sh start-dev   # Start in DEV mode (live reload: nodemon + docs + client dist)
./container.sh stop        # Stop container
./container.sh restart     # Restart container
./container.sh status      # Check status
./container.sh logs        # View logs
./container.sh shell       # Open shell in container
./container.sh setup-ssl   # Generate self-signed SSL certs
./container.sh clean       # Remove container and image
```

📚 **[View Full Deployment Guide →](DEPLOYMENT.md)**

---

## 🔒 HTTPS / SSL Configuration

Both backends can serve **HTTPS with official Nestlé SSL certificates** from
the same `certs/` directory: Python via `./container-py.sh start-ssl`
(uvicorn TLS — see [MIGRATION.md Runbook C → "Enable HTTPS"](MIGRATION.md)),
legacy Node via `./container.sh start-ssl`. Note: HTTPS is transport
encryption; user *authentication* (SSO login) is still a planned enhancement.

### Certificate Source

Certificates are sourced from the Nestlé certificate store:
```
/gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe/
```

### Certificate Files (in `certs/` directory - NOT committed to git)

| File | Source | Purpose |
|------|--------|---------|
| `server.crt` | `nr-ubp-dev-02.nihs.ch.nestle.com.cer` | Server certificate |
| `server.key` | `nr-ubp-dev-02.nihs.ch.nestle.com.key` | Private key |
| `ca.crt` | `Nestle_Root_CA.cer` | CA root certificate |

### Verify Certificate/Key Pair

```bash
# Both commands must output the same MD5 hash
openssl x509 -noout -modulus -in certs/server.crt | openssl md5
openssl rsa -noout -modulus -in certs/server.key | openssl md5
```

> ⚠️ **Security**: SSL certificates and private keys are excluded from git via `.gitignore`. Never commit these files.

---

## 🌐 Access URLs

| Environment | URL | Protocol |
|-------------|-----|----------|
| **Production (HTTPS)** | `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160` | HTTPS/TLS |
| **Architecture Docs** | `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160/architecture` | HTTPS/TLS |
| Development (Frontend) | `http://localhost:3000` | HTTP |
| Development (API) | `http://localhost:49160` | HTTP |

---

## 📡 API Endpoints

Quick reference of available endpoints:

**Statistics & Dashboard:**
- `GET /api/stats` - Get dashboard statistics

**Chemicals:**
- `GET /api/chemicals` - List all chemicals (paginated)
- `POST /api/chemicals` - Add a single chemical
- `POST /api/chemicals/upload/excel` - Bulk upload via Excel
- `POST /api/chemicals/bulk/delete` - Bulk delete chemicals
- `POST /api/chemicals/bulk/update` - Bulk update chemicals

**Samples, Screening, Toxicology:**
- Similar CRUD endpoints available for each module

📚 **[View Full API Documentation →](API.md)**

---

## 📊 Excel Upload Format

For bulk chemical uploads, prepare an Excel file with these columns:

| Column | Maps To | Required |
|--------|---------|----------|
| `DTX_ID` | Chemical ID | Optional (auto-generated) |
| `NESTLE_ID` | Nestle ID | Optional |
| `CHEMICAL_NAME` | Chemical Name | **Required** |
| `CAS_NO` | CAS Number | Optional |
| `MOL_WEIGHT_ORIG` | Molecular Weight | Optional |
| `MOL_FORMULA` | Molecular Formula | Optional |
| `Supplier_ref` | Supplier Reference | Optional |

📥 **[Download Excel Templates →](docs/excel-templates/)**

---

## 🗄️ Database Schema

Four collections/tables: `chemicals`, `samples`, `screening`, `toxicology`.

- **Python backend**: SQLite (`data/crucible.db`) via SQLAlchemy — each table
  stores the full record as a JSON `doc` column plus indexed lookup columns
  (hybrid document pattern; PostgreSQL-ready via `DATABASE_URL`).
- **Legacy Node backend**: LowDB JSON file (`data/pandora.json`) — also the
  source for the one-shot migration script.

📚 **[View Database Schema Details →](docs/database-schema.md)**

---

## 📊 Health Monitoring

Automated health monitoring checks the application every 5 minutes and auto-restarts if unresponsive.

### Setup Monitoring

```bash
# Make monitor script executable
chmod +x monitor.sh

# Install cron job (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * $(pwd)/monitor.sh") | crontab -

# Or run manually
./monitor.sh
```

### Monitor Logs

```bash
# View monitoring log
tail -f /tmp/pandora-monitor.log

# Check cron job
crontab -l | grep pandora
```

### Server Stability Features

- **Keep-alive timeouts**: 65s (keepAliveTimeout), 66s (headersTimeout), 120s (requestTimeout)
- **Crash recovery**: Global handlers for `uncaughtException` and `unhandledRejection`
- **Memory monitoring**: Automatic memory usage logging every 5 minutes
- **Container health check**: Docker/Podman HEALTHCHECK every 30 seconds

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Check what's using port 49160
lsof -i :49160

# Kill the process
fuser -k 49160/tcp
```

### Container Issues

```bash
# View logs
./container.sh logs

# Restart container with HTTPS
./container.sh stop && podman rm crucible && ./container.sh start-ssl
```

### SSL Certificate Mismatch

```bash
# Verify certificate and key match
CERT_HASH=$(openssl x509 -noout -modulus -in certs/server.crt | openssl md5)
KEY_HASH=$(openssl rsa -noout -modulus -in certs/server.key | openssl md5)

echo "Cert: $CERT_HASH"
echo "Key:  $KEY_HASH"

# If they don't match, re-run setup:
./setup-after-clone.sh
```

### Application Unreachable

```bash
# Run health check
./monitor.sh

# Check container status
./container.sh status

# Full restart with HTTPS
./container.sh stop
podman rm crucible
./container.sh start-ssl
```

### Database Reset

```bash
# Python backend: delete the SQLite file (re-created empty on next start;
# re-import from lowdb with ./container-py.sh migrate)
rm -f data/crucible.db

# Legacy Node backend: delete the lowdb JSON file
rm -f data/pandora.json
```

---

## �️ Uninstall & Cleanup

A dedicated `uninstall.sh` script handles all cleanup operations:

```bash
# Interactive mode — choose what to remove step by step
./uninstall.sh

# Partial cleanup — remove runtime artifacts, keep source & data
./uninstall.sh --partial

# Full uninstall — remove everything including data & source code
./uninstall.sh --full

# Preview what would be removed (no changes made)
./uninstall.sh --dry-run
```

The script covers: container, image, cron job, monitor logs, SSL certs, data, node_modules, build artifacts, systemd service, and project directory removal.

📚 **[View Full Uninstall Details →](DEPLOYMENT.md#uninstall--cleanup)**

---

## �🔐 Security

### What's Protected

- **HTTPS/TLS**: All production traffic encrypted with official Nestlé certificates
- **Git Safety**: SSL certificates, private keys, and database files excluded via `.gitignore`
- **File Permissions**: Private key restricted to `chmod 600`
- **Error Handling**: No sensitive data exposed in error responses

### Files Excluded from Git

```
certs/             # SSL certificates and private keys
data/*.db          # SQLite database (data/pandora.json IS tracked)
server/data/       # bare-metal scratch data
node_modules/      # dependencies (installed per machine)
client/dist/       # build output
backend/.venv/     # Python virtualenv
```

### Future Security Enhancements

- [ ] SSO Login Integration
- [ ] Role-based access control
- [ ] Rate limiting
- [ ] Audit logging

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](CONTRIBUTING.md) for details.

> 📋 **Before pushing to `develop`**: Follow the [Pre-Push Checklist](CONTRIBUTING.md#pre-push-checklist-before-pushing-to-develop) to ensure no sensitive files are committed and the build passes.

---

## 📝 Documentation

| Document | Description |
|----------|-------------|
| **[MIGRATION.md](MIGRATION.md)** | Node → Python migration: runbooks (macOS Docker/Podman, RHEL8), learning map, cutover & rollback |
| **[Backend README](backend/README.md)** | Python backend: quickstart, tests, env vars, vite proxy switching |
| **[API Documentation](API.md)** | Complete REST API reference (identical for both backends) |
| **[Deployment Guide](DEPLOYMENT.md)** | Legacy Node deployment, SSL setup, and monitoring |
| **[Architecture](docs/architecture.md)** | System architecture — Python backend + legacy Node sections |
| **[Database Schema](docs/database-schema.md)** | SQL schema (Python) + LowDB collections (legacy) |
| **[Contributing Guidelines](CONTRIBUTING.md)** | How to contribute |

---

## 🎯 Future Enhancements

- [ ] SSO Login Integration
- [ ] Advanced search and filtering with facets
- [ ] Data export functionality (Excel, CSV, JSON)
- [ ] Chemical structure visualization
- [ ] Batch upload improvements with validation
- [ ] Audit trail and version history
- [ ] Advanced analytics and reporting
- [ ] Certificate expiry monitoring and alerts

---

## 📄 License

MIT License - See LICENSE file for details

---

## 👥 Authors

**NIHS Team** - Nestle Institute of Health Sciences

For support, contact: [support@example.com]

---

**Last Updated:** February 12, 2026
