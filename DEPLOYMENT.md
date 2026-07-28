# Deployment Guide - Crucible: Pandora Toolbox Enhancement (v2.0)

Comprehensive guide for deploying Crucible in different environments.

---

> **Python backend (FastAPI):** the Node stack documented here is being
> replaced by the Python backend in `backend/`. For the Python deployment,
> the three step-by-step runbooks — **macOS (Docker)**, **macOS (Podman)**
> and **RHEL8 VM (Podman)** — plus the cutover checklist and rollback path
> live in [MIGRATION.md](MIGRATION.md). Both `container.sh` (Node) and
> `container-py.sh` (Python) auto-detect podman/docker; override with
> `CONTAINER_RUNTIME=docker|podman`.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Port Migration: 5942 → 49160 (RHEL8 VM)](#port-migration-5942--49160-rhel8-vm)
- [Quick Start (After Clone)](#quick-start-after-clone)
- [SSL/TLS Certificate Setup](#ssltls-certificate-setup)
- [Local Development Deployment](#local-development-deployment)
- [Production Local Deployment](#production-local-deployment)
- [Container Deployment (Podman/Docker)](#container-deployment-podmandocker)
- [HTTPS Container Deployment](#https-container-deployment)
- [Server Deployment](#server-deployment)
- [Environment Variables](#environment-variables)
- [Health Monitoring](#health-monitoring)
- [Backup and Restore](#backup-and-restore)
- [Troubleshooting](#troubleshooting)
- [Security](#security)

---

## Port Migration: 5942 → 49160 (RHEL8 VM)

The application moved from port **5942** to **49160**. On the RHEL8 VM
(`nr-ubp-dev-02.nihs.ch.nestle.com`) run the following, in order, to pick up
the change. These commands are complete — no other manual steps are needed.

```bash
# 1. Get the new code
cd /path/to/crucible          # wherever the repo is checked out on the VM
git pull

# 2. Stop and remove the old container (old name was pandora-toolbox;
#    both commands are safe to run even if that container does not exist)
podman stop pandora-toolbox crucible 2>/dev/null
podman rm   pandora-toolbox crucible 2>/dev/null

# 3. Rebuild the image with the new port baked in
./container.sh build

# 4. Open the new port in firewalld and close the old one
sudo firewall-cmd --permanent --add-port=49160/tcp
sudo firewall-cmd --permanent --remove-port=5942/tcp   # ok if it reports "not enabled"
sudo firewall-cmd --reload
sudo firewall-cmd --list-ports                          # verify 49160/tcp is listed

# 5. Start and verify
./container.sh start
curl --noproxy '*' -s http://localhost:49160/api/stats   # expect JSON stats
```

The app is then reachable at `http://nr-ubp-dev-02.nihs.ch.nestle.com:49160`.

Notes:

- Nothing is hardcoded to a hostname or platform: the server reads the
  `PORT` env var (default 49160) and binds `0.0.0.0`, so the same image runs
  unmodified on macOS and RHEL8. The scripts accept `PORT=<n>` overrides.
- If a cron entry runs `monitor.sh`, it now defaults to checking
  `http://localhost:49160/api/stats` — no change needed unless you deployed
  with SSL, in which case set `API_URL=https://localhost:49160/api/stats`.
- Rootless podman cannot bind ports below 1024; 49160 is unaffected.
- macOS quirk: Apple's `remoted` daemon listens on ports 49152+ on a
  link-local IPv6 address, so a wildcard bind of 49160 fails on Macs.
  `container.sh` therefore publishes ports on `127.0.0.1` on macOS (fine
  for local dev) and `0.0.0.0` on Linux; override with `HOST_BIND=<ip>`.

---

## Prerequisites

### System Requirements

- **OS**: Linux (RHEL 7/8, Ubuntu 20.04+, CentOS 7+)
- **CPU**: 2 cores minimum (4 cores recommended)
- **RAM**: 2GB minimum (4GB recommended)
- **Disk**: 10GB minimum (for application + data)

### Software Requirements

- **Node.js**: 18.x or higher
- **npm**: 8.x or higher
- **Podman** or **Docker**: Latest stable version (for containerized deployment)
- **OpenSSL**: For certificate verification
- **Git**: For cloning the repository
- **curl**: For health monitoring

### Network Requirements

- **Port 49160**: Must be available and not blocked by firewall (HTTPS)
- **Outbound internet**: Required for npm package installation

### Certificate Requirements (for HTTPS)

- Access to Nestlé certificate store at:
  ```
  /gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe/
  ```
- Required files:
  - `nr-ubp-dev-02.nihs.ch.nestle.com.cer` (Server certificate)
  - `nr-ubp-dev-02.nihs.ch.nestle.com.key` (Private key)
  - `Nestle_Root_CA.cer` (CA root certificate)

---

## Quick Start (After Clone)

The fastest way to get up and running after cloning the repository:

```bash
# Clone the repository
git clone <repository-url> nr-nips-forrest-gump-pandora-enhancement
cd nr-nips-forrest-gump-pandora-enhancement

# Run the automated setup script
chmod +x setup-after-clone.sh
./setup-after-clone.sh
```

The `setup-after-clone.sh` script automatically:
1. ✅ Copies SSL certificates from the Nestlé certificate store
2. ✅ Verifies certificate/key pair integrity (MD5 hash match)
3. ✅ Installs npm dependencies (root, client, server) **including devDependencies** so `npm test` works
4. ✅ Creates the `data/` directory for database storage
5. ✅ Builds the container image
6. ✅ Starts the application with HTTPS on port 49160
7. ✅ Optionally installs health monitoring cron job

### Live-mounted directories

The container always bind-mounts the following host paths so they reflect edits **without a rebuild**:

| Host path | Container path | Mode | Purpose |
|-----------|---------------|------|---------|
| `./data/` | `/app/server/data` | read-write | LowDB JSON database (persisted across restarts) |
| `./certs/` | `/app/certs` | read-only | SSL cert + key |
| `./docs/` | `/app/docs` | read-only | Documentation pages incl. `/architecture` — edit and reload, no rebuild needed |

> ⚠️ In `start` / `start-ssl` (production) modes the application code itself (`server/`, `client/dist/`) is **baked into the image**. Changes to JS / route handlers / React components require `./container.sh build && ./container.sh start-ssl`.

### Full live-reload dev mode (`start-dev`)

For active development, run the container in **dev mode** which additionally bind-mounts the source code and runs the server under `nodemon`:

```bash
./container.sh start-dev
```

Additional bind-mounts active in dev mode:

| Host path | Container path | Mode | Reload mechanism |
|-----------|---------------|------|------------------|
| `./server/src/` | `/app/server/src` | read-only | `nodemon` watches and restarts Node on every save |
| `./server/package.json` | `/app/server/package.json` | read-only | (re-read on restart) |
| `./client/dist/` | `/app/client/dist` | read-only | Reflected immediately — rebuild on host to push new assets |

**Workflow:**

```bash
# Terminal 1 — start container in dev mode (HTTPS, nodemon)
./container.sh start-dev

# Terminal 2 — option A: full Vite HMR (browser preview at :3000, /api proxied to :49160)
cd client && npm run dev

# Terminal 2 — option B: production-style watched build (writes to client/dist/)
cd client && npx vite build --watch
```

Notes:
- Nodemon uses `--legacy-watch` (polling) because GPFS bind-mounts don't deliver inotify events; expect ~2-6 s reload latency.
- `data/`, `node_modules/`, and `*.test.js` files are excluded from the watch list to prevent restart loops.
- The image now bakes `nodemon@3` globally (~3 MB overhead) so `start-dev` works without any host install.

After setup, access the application at:
- **HTTPS**: `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160`

---

## SSL/TLS Certificate Setup

### Overview

The application uses HTTPS with official Nestlé SSL certificates. Certificates are **never committed to git** and must be set up on each deployment.

### Automatic Setup (Recommended)

```bash
./setup-after-clone.sh
```

### Manual Certificate Setup

```bash
# Step 1: Create certs directory
mkdir -p certs

# Step 2: Copy certificates from source
CERT_SOURCE="/gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe"

cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.cer" certs/server.crt
cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.key" certs/server.key
cp "$CERT_SOURCE/Nestle_Root_CA.cer" certs/ca.crt

# Step 3: Set proper permissions
chmod 600 certs/server.key
chmod 644 certs/server.crt certs/ca.crt
```

### Verify Certificate/Key Pair

**This is critical** - a mismatched certificate and key will cause the server to crash with `ERR_OSSL_X509_KEY_VALUES_MISMATCH`.

```bash
# Get certificate modulus hash
openssl x509 -noout -modulus -in certs/server.crt | openssl md5

# Get key modulus hash
openssl rsa -noout -modulus -in certs/server.key | openssl md5

# ✅ Both hashes MUST be identical
# Example output: (stdin)= e7f3c0b7ec46bc4c9f33e9a858947d31
```

### View Certificate Details

```bash
# View certificate information (subject, issuer, dates)
openssl x509 -in certs/server.crt -text -noout | head -20

# Check certificate expiry date
openssl x509 -in certs/server.crt -noout -enddate
```

### Self-Signed Certificates (Development Only)

If official certificates are not available:

```bash
./container.sh setup-ssl
```

This generates self-signed certificates for `nr-ubp-dev-02.nihs.ch.nestle.com` with a 365-day validity. Browsers will show security warnings with self-signed certificates.

---

## Local Development Deployment

Best for development and testing.

### Step 1: Clone Repository

```bash
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement
git clone <repository-url> nr-nips-forrest-gump-pandora-enhancement
cd nr-nips-forrest-gump-pandora-enhancement
```

### Step 2: Install Dependencies

```bash
# Install all dependencies (root, client, server)
npm run install:all
```

This will:
- Install root package dependencies
- Install client (React) dependencies
- Install server (Express) dependencies

### Step 3: Start Development Servers

```bash
# Start both frontend and backend
npm run dev
```

This starts:
- **Frontend**: `http://localhost:3000` (Vite dev server with hot reload)
- **Backend API**: `http://localhost:49160` (Express server with nodemon)

### Step 4: Access Application

Open your browser and navigate to:
- Frontend: `http://localhost:3000`
- API: `http://localhost:49160/api/stats`

### Development Features

- ✅ Hot module replacement (HMR) for React
- ✅ Auto-restart on server code changes
- ✅ Source maps for debugging
- ✅ React DevTools compatible

---

## Production Local Deployment

For running on a local machine in production mode.

### Step 1: Build Client

```bash
# Build optimized React production bundle
npm run build
```

This creates:
- Minified JavaScript bundles
- Optimized CSS
- Assets with cache hashing
- Output in `client/dist/`

### Step 2: Start Production Server

```bash
# Set port and start server
PORT=49160 npm start
```

Or create a start script:

```bash
#!/bin/bash
# start-prod.sh

export PORT=49160
export NODE_ENV=production

cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement
npm start
```

### Keep Running in Background

Use `nohup` or `screen`:

```bash
# Using nohup
nohup PORT=49160 npm start > pandora.log 2>&1 &

# Or using screen
screen -S pandora
PORT=49160 npm start
# Press Ctrl+A, then D to detach
```

---

## Container Deployment (Podman/Docker)

Recommended for production deployments.

### Quick Start (HTTP)

```bash
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement

# Build and start
./container.sh build
./container.sh start

# Verify
./container.sh status
```

### Manual Container Build

#### Using Podman

```bash
# Build image
podman build -t crucible:latest .

# Create and run container
podman run -d \
  --name crucible \
  -p 49160:49160 \
  -v pandora-data:/app/server/data \
  --restart unless-stopped \
  crucible:latest

# Check logs
podman logs -f crucible
```

#### Using Docker

```bash
docker build -t crucible:latest .

docker run -d \
  --name crucible \
  -p 49160:49160 \
  -v pandora-data:/app/server/data \
  --restart unless-stopped \
  crucible:latest
```

### Container Script Commands

```bash
./container.sh build       # Build container image
./container.sh start       # Start container (HTTP)
./container.sh start-ssl   # Start container with HTTPS
./container.sh stop        # Stop container
./container.sh restart     # Restart container
./container.sh status      # Check container status
./container.sh logs        # View container logs (follow mode)
./container.sh shell       # Open shell inside container
./container.sh setup-ssl   # Generate self-signed certificates
./container.sh clean       # Remove container and image
./container.sh help        # Show help
```

---

## HTTPS Container Deployment

**Recommended for production.** Uses official Nestlé SSL certificates.

### Step 1: Set Up Certificates

```bash
# Automatic setup (copies & verifies certificates)
./setup-after-clone.sh

# Or manually:
mkdir -p certs
CERT_SOURCE="/gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe"
cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.cer" certs/server.crt
cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.key" certs/server.key
cp "$CERT_SOURCE/Nestle_Root_CA.cer" certs/ca.crt
chmod 600 certs/server.key
```

### Step 2: Build Container

```bash
./container.sh build
```

### Step 3: Start with HTTPS

```bash
./container.sh start-ssl
```

This starts the container with:
- HTTPS on port **49160**
- Certificate/key mounted as read-only volumes
- Data directory for persistent database storage
- Automatic restart on failure

### Step 4: Verify

```bash
# Check container is running
./container.sh status

# Test HTTPS endpoint
curl --noproxy '*' -k -s https://localhost:49160/api/stats

# Test from hostname
curl --noproxy '*' -k -s https://nr-ubp-dev-02.nihs.ch.nestle.com:49160/api/stats
```

### Container Configuration

**Dockerfile highlights:**

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY . .
# Install server dependencies, build client
# Create data and certs directories
ENV NODE_ENV=production PORT=49160 USE_HTTPS=false
EXPOSE 49160
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 ...
CMD ["node", "src/index.js"]
```

**Volume mounts (HTTPS mode):**
- `/app/server/data` → `./data/` (Database persistence)
- `/app/certs` → `./certs/` (SSL certificates, read-only)

**Environment variables set by `start-ssl`:**
- `PORT=49160`
- `USE_HTTPS=true`
- `SSL_CERT_PATH=/app/certs/server.crt`
- `SSL_KEY_PATH=/app/certs/server.key`

---

## Server Deployment

Deploying to `nr-ubp-dev-02.nihs.ch.nestle.com`

### SSH Access

```bash
ssh rdkannanab@nr-ubp-dev-02.nihs.ch.nestle.com
```

### First-Time Deploy

```bash
# Navigate to project location
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement

# Clone repository
git clone <repository-url> nr-nips-forrest-gump-pandora-enhancement
cd nr-nips-forrest-gump-pandora-enhancement

# Run setup (certificates + build + start)
chmod +x setup-after-clone.sh
./setup-after-clone.sh
```

### Subsequent Deploys (Update)

```bash
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement

# Pull latest code
git pull origin main

# Rebuild and restart with HTTPS
./container.sh stop
podman rm crucible
./container.sh build
./container.sh start-ssl

# Verify deployment
./container.sh status
curl --noproxy '*' -k -s https://localhost:49160/api/stats
```

### Access URLs

- **HTTPS (Production)**: `https://nr-ubp-dev-02.nihs.ch.nestle.com:49160`
- **Local test**: `https://localhost:49160`

### Firewall Configuration

Ensure port 49160 is open:

```bash
# Check if port is listening
ss -tlnp | grep 49160

# Open firewall port (if needed)
sudo firewall-cmd --add-port=49160/tcp --permanent
sudo firewall-cmd --reload
```

### System Service (Optional)

Create a systemd service for auto-start:

```bash
sudo nano /etc/systemd/system/crucible.service
```

```ini
[Unit]
Description=Crucible: Pandora Toolbox Enhancement (v2.0)
After=network.target

[Service]
Type=simple
User=rdkannanab
WorkingDirectory=/gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement
ExecStart=/usr/bin/podman start -a crucible
ExecStop=/usr/bin/podman stop crucible
Restart=always

[Install]
WantedBy=multi-user.target
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable crucible
sudo systemctl start crucible
sudo systemctl status crucible
```

---

## Environment Variables

### Available Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 49160 | Server port (HTTP and HTTPS) |
| `NODE_ENV` | production | Environment mode |
| `USE_HTTPS` | false | Enable HTTPS mode |
| `SSL_CERT_PATH` | /app/certs/server.crt | Path to SSL certificate |
| `SSL_KEY_PATH` | /app/certs/server.key | Path to SSL private key |
| `CA_BUNDLE_PATH` | /etc/ssl/certs/ca-certificates.crt | Path to CA bundle |

### Setting Environment Variables

**Container (HTTPS):**

```bash
podman run -d \
  --name crucible \
  -e PORT=49160 \
  -e NODE_ENV=production \
  -e USE_HTTPS=true \
  -e SSL_CERT_PATH=/app/certs/server.crt \
  -e SSL_KEY_PATH=/app/certs/server.key \
  -p 49160:49160 \
  -v ./certs:/app/certs:Z,ro \
  -v ./data:/app/server/data:Z \
  crucible:latest
```

**Local:**

```bash
PORT=49160 USE_HTTPS=true npm start
```

---

## Health Monitoring

### Overview

The application includes automated health monitoring that checks the API every 5 minutes and restarts the container if it becomes unresponsive.

### Components

| Component | Purpose |
|-----------|---------|
| `monitor.sh` | Health check script (tests API, restarts container if down) |
| Cron job | Runs `monitor.sh` every 5 minutes |
| Server keepalive | Prevents idle connection drops (65s timeout) |
| Error handlers | Catches uncaught exceptions and unhandled rejections |
| Memory monitor | Logs memory usage every 5 minutes |
| HEALTHCHECK | Container-level health check every 30 seconds |

### Setup Monitoring

```bash
# Make scripts executable
chmod +x monitor.sh

# Install cron job
(crontab -l 2>/dev/null; echo "*/5 * * * * $(pwd)/monitor.sh") | crontab -

# Verify cron job installed
crontab -l | grep pandora
```

### Monitor Script Details

The `monitor.sh` script:
1. Sends a GET request to `https://localhost:49160/api/stats`
2. If response is HTTP 200 → logs "healthy"
3. If response fails → restarts the container and logs the action
4. All activity logged to `/tmp/pandora-monitor.log`

### Viewing Monitor Logs

```bash
# View real-time monitoring logs
tail -f /tmp/pandora-monitor.log

# View last 20 entries
tail -20 /tmp/pandora-monitor.log

# Check for restart events
grep -i "restart\|unhealthy\|failed" /tmp/pandora-monitor.log
```

### Manual Health Check

```bash
# Run health check manually
./monitor.sh

# Or test API directly
curl --noproxy '*' -k -s https://localhost:49160/api/stats
```

### Server Stability Configuration

The server includes built-in stability features:

```
keepAliveTimeout:  65,000ms  (65 seconds)
headersTimeout:    66,000ms  (66 seconds)
requestTimeout:   120,000ms  (120 seconds)
```

- **uncaughtException handler**: Logs error and exits gracefully
- **unhandledRejection handler**: Logs rejected promise details
- **Memory logging**: Reports RSS, heap used/total every 5 minutes

### Remove Monitoring

```bash
# Edit crontab and remove the pandora line
crontab -e
# Delete the line containing monitor.sh
```

---

## Backup and Restore

### Backup Database

**Container:**

```bash
# Backup data volume
podman run --rm \
  -v pandora-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar czf /backup/pandora-data-$(date +%Y%m%d).tar.gz -C /data .
```

**Local:**

```bash
# Create backup directory
mkdir -p backups

# Backup database file
cp data/pandora.json backups/pandora-$(date +%Y%m%d-%H%M%S).json
```

### Restore Database

**Container:**

```bash
./container.sh stop

podman run --rm \
  -v pandora-data:/data \
  -v $(pwd)/backups:/backup \
  alpine tar xzf /backup/pandora-data-20260212.tar.gz -C /data

./container.sh start-ssl
```

**Local:**

```bash
# Stop server, restore backup, start server
cp backups/pandora-20260212-100000.json data/pandora.json
```

### Automated Backups

Create a cron job:

```bash
crontab -e
```

Add:

```bash
# Daily backup at 2 AM
0 2 * * * cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement && mkdir -p backups && cp data/pandora.json backups/pandora-$(date +\%Y\%m\%d-\%H\%M\%S).json
```

---

## Troubleshooting

### SSL Certificate Mismatch

**Symptom**: Server crashes with `ERR_OSSL_X509_KEY_VALUES_MISMATCH`

**Diagnosis:**
```bash
# Check container logs
podman logs crucible 2>&1 | tail -20

# Verify certificate and key match
CERT_HASH=$(openssl x509 -noout -modulus -in certs/server.crt | openssl md5)
KEY_HASH=$(openssl rsa -noout -modulus -in certs/server.key | openssl md5)
echo "Cert: $CERT_HASH"
echo "Key:  $KEY_HASH"
```

**Fix:**
```bash
# Re-run the setup script (copies correct certificates)
./setup-after-clone.sh

# Or manually re-copy from source
CERT_SOURCE="/gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe"
rm -f certs/*
cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.cer" certs/server.crt
cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.key" certs/server.key
cp "$CERT_SOURCE/Nestle_Root_CA.cer" certs/ca.crt
chmod 600 certs/server.key

# Restart
./container.sh stop && podman rm crucible && ./container.sh start-ssl
```

### Application Unreachable / Connection Timeout

**Symptom**: Browser shows "connection refused" or "timed out"

**Diagnosis:**
```bash
# Check if container is running
./container.sh status

# Check container logs for errors
podman logs --tail 50 crucible

# Run health check
./monitor.sh

# Test API locally
curl --noproxy '*' -k -s https://localhost:49160/api/stats
```

**Fix:**
```bash
# Full restart
./container.sh stop
podman rm crucible
./container.sh start-ssl

# Verify it's working
sleep 5
curl --noproxy '*' -k -s https://localhost:49160/api/stats
```

### Port Already in Use

```bash
# Find process using port 49160
lsof -i :49160

# Kill the process
kill -9 <PID>

# Or kill by port
fuser -k 49160/tcp
```

### Container Won't Start

```bash
# Check logs for errors
podman logs crucible 2>&1 | tail -50

# Rebuild container from scratch
./container.sh clean
./container.sh build
./container.sh start-ssl

# Check disk space
df -h

# Check permissions
ls -la certs/ data/
```

### Mixed Content Warnings in Browser

**Symptom**: Browser console shows mixed content warnings

**Note**: The application has been configured to serve everything over HTTPS only (no HTTP redirect server). If you see mixed content warnings:

1. Ensure you access the app via `https://` not `http://`
2. Clear browser cache
3. The frontend is configured to use relative URLs to avoid protocol mismatches

### Database Corruption

```bash
# Stop application
./container.sh stop

# Restore from backup
cp backups/pandora-latest.json data/pandora.json

# Restart
./container.sh start-ssl
```

### Cannot Access from External Network

```bash
# Check firewall
sudo firewall-cmd --list-ports

# Add port if missing
sudo firewall-cmd --add-port=49160/tcp --permanent
sudo firewall-cmd --reload

# Check if service is listening
ss -tlnp | grep 49160
```

### Performance Issues

```bash
# Check system resources
top
free -h
df -h

# Container resource stats
podman stats crucible

# Check memory usage in app logs
podman logs crucible 2>&1 | grep "Memory"

# Restart container
./container.sh stop && podman rm crucible && ./container.sh start-ssl
```

### Build Failures

```bash
# Clear npm cache
npm cache clean --force

# Remove node_modules
rm -rf node_modules client/node_modules server/node_modules

# Reinstall
npm run install:all

# Rebuild container
./container.sh clean
./container.sh build
```

---

## Security

### Current Implementation

- **HTTPS/TLS**: All production traffic encrypted with official Nestlé certificates
- **Certificate Management**: Certificates excluded from git, verified on setup
- **File Permissions**: Private key restricted to `chmod 600`
- **Error Handling**: No sensitive data exposed in error responses
- **Git Safety**: `.gitignore` protects certificates, keys, database, and environment files
- **Container Isolation**: Application runs in isolated container
- **Health Monitoring**: Automated recovery from crashes

### Protected Files (.gitignore)

```
certs/          # SSL certificates and private keys
data/           # Database with real data
*.key           # Private key files
*.crt           # Certificate files
*.pem           # PEM-encoded files
*.cer           # Certificate files
.env            # Environment variables
```

### Network Security

- HTTPS on port 49160 (encrypted)
- No HTTP redirect server (prevents mixed content issues)
- CORS configured for specific origins
- Input validation on all API endpoints

### Future Enhancements

- [ ] SSO authentication
- [ ] Role-based access control (RBAC)
- [ ] Rate limiting
- [ ] Audit logging
- [ ] Certificate expiry monitoring
- [ ] Automated certificate renewal

---

## Uninstall & Cleanup

Instructions for partially or completely removing Crucible from the system.

### Using the Uninstall Script (Recommended)

The easiest way to clean up is with the `uninstall.sh` script:

```bash
# Interactive — guided step-by-step cleanup
./uninstall.sh

# Partial — remove container, image, cron, logs (keep source & data)
./uninstall.sh --partial

# Full — remove everything including data and source code
./uninstall.sh --full

# Dry run — preview what would be removed without deleting anything
./uninstall.sh --dry-run
```

If you prefer to run the steps manually, follow the guide below.

### Step 1: Stop the Application

```bash
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement

# Stop the container
./container.sh stop

# Verify it's stopped
podman ps -a --filter name=crucible
```

### Step 2: Remove the Container

```bash
# Remove the stopped container
podman rm crucible

# Verify removal
podman ps -a --filter name=crucible
# ✅ Should show no results
```

### Step 3: Remove the Container Image

```bash
# Remove the Crucible image
podman rmi crucible:latest

# Verify removal
podman images | grep pandora
# ✅ Should show no results

# (Optional) Remove any dangling/orphaned images
podman image prune -f
```

### Step 4: Remove Health Monitoring Cron Job

```bash
# View current cron jobs
crontab -l

# Remove the pandora monitor entry
crontab -l | grep -v 'monitor.sh' | crontab -

# Verify removal
crontab -l | grep pandora
# ✅ Should show no results

# Remove monitor log file
rm -f /tmp/pandora-monitor.log
```

### Step 5: Remove SSL Certificates

```bash
# Delete local certificate copies
rm -rf certs/

# ⚠️ Do NOT delete the source certificates at:
# /gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe/
# Those are shared infrastructure certificates.
```

### Step 6: Remove Application Data

> ⚠️ **Warning**: This permanently deletes all uploaded chemicals, samples, screening, and toxicology data.

```bash
# Delete database
rm -rf data/

# If using named volumes
podman volume rm pandora-data 2>/dev/null
```

**To back up before deleting:**

```bash
mkdir -p ~/pandora-backups
cp data/pandora.json ~/pandora-backups/pandora-final-$(date +%Y%m%d-%H%M%S).json
```

### Step 7: Remove node_modules (Optional)

If you plan to keep the source code but want to free disk space:

```bash
rm -rf node_modules/ client/node_modules/ server/node_modules/

# You can reinstall later with:
# npm run install:all
```

### Step 8: Remove the Project Directory (Full Removal)

> ⚠️ **Warning**: This deletes all source code. Make sure you've pushed any changes to git first.

```bash
cd /gpfs/home/rdkannanab/work/Pandora_toolbox/nr-nips-forrest-gump-pandora-enhancement
rm -rf nr-nips-forrest-gump-pandora-enhancement
```

### Step 9: Remove systemd Service (If Configured)

If you set up the optional systemd service:

```bash
sudo systemctl stop crucible
sudo systemctl disable crucible
sudo rm /etc/systemd/system/crucible.service
sudo systemctl daemon-reload
```

### Cleanup Summary

The following table lists everything that gets created during installation and where to find it:

| Component | Location | Cleanup Command |
|-----------|----------|----------------|
| Container | `crucible` | `podman rm crucible` |
| Image | `crucible:latest` | `podman rmi crucible:latest` |
| Data volume | `./data/` or `pandora-data` | `rm -rf data/` or `podman volume rm pandora-data` |
| SSL certificates | `./certs/` | `rm -rf certs/` |
| Cron job | User crontab | `crontab -l \| grep -v 'monitor.sh' \| crontab -` |
| Monitor log | `/tmp/pandora-monitor.log` | `rm -f /tmp/pandora-monitor.log` |
| node_modules | `./node_modules/`, `client/`, `server/` | `rm -rf node_modules/ client/node_modules/ server/node_modules/` |
| Build output | `client/dist/` | `rm -rf client/dist/` |
| systemd service | `/etc/systemd/system/crucible.service` | `sudo rm` + `systemctl daemon-reload` |
| Project source | Full project directory | `rm -rf nr-nips-forrest-gump-pandora-enhancement/` |

### Partial Cleanup (Keep Source Code)

If you want to stop running the application but keep the repository for future use:

```bash
# Automated (recommended)
./uninstall.sh --partial

# Or manually:
./container.sh clean
crontab -l | grep -v 'monitor.sh' | crontab -
rm -f /tmp/pandora-monitor.log
rm -rf certs/ data/

# The source code remains intact and can be re-deployed with:
# ./setup-after-clone.sh
```

---

## Scaling

### Horizontal Scaling

For high availability, deploy multiple instances:

```bash
# Instance 1
podman run -d --name crucible-1 -p 49160:49160 ...

# Instance 2
podman run -d --name crucible-2 -p 5944:49160 ...

# Use load balancer (nginx) to distribute traffic
```

### Vertical Scaling

Increase container resources:

```bash
podman run -d \
  --name crucible \
  --cpus 4 \
  --memory 4g \
  -p 49160:49160 \
  crucible:latest
```

---

## Environment Variables Reference

Complete list of all environment variables used by Crucible:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `49160` | Application port (HTTP or HTTPS depending on `USE_HTTPS`) |
| `USE_HTTPS` | `false` | Set to `true` to enable TLS. Requires valid cert/key files. |
| `SSL_CERT_PATH` | `/app/certs/server.crt` | Path to SSL certificate file |
| `SSL_KEY_PATH` | `/app/certs/server.key` | Path to SSL private key file |
| `CA_BUNDLE_PATH` | `/etc/pki/ca-trust/extracted/pem/tls-ca-bundle.pem` | CA bundle for certificate chain (overridden to `/etc/ssl/certs/ca-certificates.crt` in Alpine containers) |
| `NODE_ENV` | `undefined` | Set to `production` for optimized builds |
| `NODE_TLS_REJECT_UNAUTHORIZED` | `1` | Set to `0` only for development with self-signed certs |

---

## Server Runtime Behaviour

### Timeouts

| Setting | Value | Purpose |
|---------|-------|---------|
| `keepAliveTimeout` | 65,000 ms | How long to keep idle connections open |
| `headersTimeout` | 66,000 ms | Maximum time to receive request headers |
| `server.timeout` | 120,000 ms | Maximum time for the entire request/response cycle |

### Memory Monitoring

The server logs memory usage every **5 minutes** to stdout:
```
Memory: RSS=85MB, Heap=42MB
```

### Error Resilience

- **`uncaughtException`** — logged but does NOT crash the server (keeps running)
- **`unhandledRejection`** — logged but does NOT crash the server
- Combined with Podman `--restart=always` and the cron health monitor, this ensures maximum uptime.

---

## Support

For deployment issues:
- Email: support@example.com
- Slack: #crucible
- Docs: [README.md](README.md) | [API.md](API.md)

---

**Last Updated:** May 19, 2026
