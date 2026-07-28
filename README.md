# Crucible: Pandora Toolbox Enhancement (v2.0)

Chemical and Sample Management System - MVP

A comprehensive web application for managing chemical compounds, samples, screening data, and toxicology information with an integrated Electronic Lab Notebook (ELN). Deployed with **HTTPS/TLS** encryption using official Nestlé SSL certificates.

## 🚀 Quick Start

### Fresh Clone (Recommended)

```bash
# Clone the repository
git clone <repository-url> nr-nips-forrest-gump-pandora-enhancement
cd nr-nips-forrest-gump-pandora-enhancement

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
- **Production (HTTPS):** `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942`
- **Development:** `http://localhost:3000` (frontend) + `http://localhost:5942` (API)

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

**Tech Stack:**
- **Frontend**: React 18 + Vite 5 + Tailwind CSS 3.4
- **Backend**: Node.js 18 + Express 4.18
- **Database**: LowDB 1.0 (JSON file storage)
- **Security**: HTTPS/TLS with official Nestlé certificates
- **Container**: Podman/Docker compatible
- **Monitoring**: Cron-based health checks with auto-restart

**Modules:**
1. **ELN (Electronic Lab Notebook)**: Upload interface for all data types
2. **Data Viewer**: Search, filter, and view all uploaded data
3. **Dashboard**: Real-time statistics and capacity monitoring

📚 **[View Architecture Details →](docs/architecture.md)**

---

## 📦 Installation

### Prerequisites

- Node.js 18 or higher
- npm 8 or higher
- Podman or Docker (for containerized deployment)
- OpenSSL (for certificate verification)
- Access to Nestlé certificate store (for HTTPS)

### Install Dependencies

```bash
# From project root directory
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement

# Install all dependencies (root, client, and server)
npm run install:all
```

---

## 🛠️ Development

### Local Development (Hot Reload)

```bash
# Start both frontend and backend in development mode
npm run dev
```

This starts:
- Frontend dev server: `http://localhost:3000`
- Backend API server: `http://localhost:5942`

### Build for Production

```bash
# Build the React frontend
npm run build

# Start the production server on port 5942
PORT=5942 npm start
```

Production app runs at: `http://localhost:5942`

---

## 🧪 Testing

### Run all tests

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

### Quick Deploy (with HTTPS)

```bash
# First-time setup after clone
./setup-after-clone.sh

# Or manual steps:
./container.sh build
./container.sh start-ssl
```

### Container Management

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

The application uses **HTTPS with official Nestlé SSL certificates** for encrypted communication.

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
| **Production (HTTPS)** | `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942` | HTTPS/TLS |
| **Architecture Docs** | `https://nr-ubp-dev-02.nihs.ch.nestle.com:5942/architecture` | HTTPS/TLS |
| Development (Frontend) | `http://localhost:3000` | HTTP |
| Development (API) | `http://localhost:5942` | HTTP |

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

The application uses LowDB (JSON-based) with the following collections:
- `chemicals` - Chemical compounds data
- `samples` - Sample information
- `screening` - Screening assay results
- `toxicology` - Toxicology study data

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
# Check what's using port 5942
lsof -i :5942

# Kill the process
fuser -k 5942/tcp
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
# Local: Delete data file
rm -rf data/pandora.json

# Container: Remove volume
podman volume rm pandora-data
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
certs/          # SSL certificates and private keys
data/           # Database with real data
*.key, *.crt    # Any certificate files
*.pem, *.cer    # Any certificate files
.env            # Environment variables
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
| **[API Documentation](API.md)** | Complete REST API reference with HTTPS examples |
| **[Deployment Guide](DEPLOYMENT.md)** | Deployment, SSL setup, and monitoring |
| **[Architecture](docs/architecture.md)** | System architecture and design |
| **[Database Schema](docs/database-schema.md)** | Database structure and relationships |
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
