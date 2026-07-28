#!/bin/bash

# Crucible - Post-Clone Setup Script
# Run this after cloning the repository

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🧪 Crucible: Pandora Toolbox Enhancement (v2.0)        ║"
echo "║      Setup After Clone                                    ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Copy SSL Certificates
echo "Step 1: Copying SSL certificates..."
CERT_SOURCE="/gpfs/Development/cgi/envs/beta/nespipe_rdkannanab_betabuild_ubp_dev02/etc/nespipe"

if [ -d "$CERT_SOURCE" ]; then
    mkdir -p certs
    cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.cer" certs/server.crt
    cp "$CERT_SOURCE/nr-ubp-dev-02.nihs.ch.nestle.com.key" certs/server.key
    cp "$CERT_SOURCE/Nestle_Root_CA.cer" certs/ca.crt
    chmod 600 certs/server.key
    
    # Verify certificates match
    CERT_HASH=$(openssl x509 -noout -modulus -in certs/server.crt | openssl md5 | cut -d'=' -f2)
    KEY_HASH=$(openssl rsa -noout -modulus -in certs/server.key 2>/dev/null | openssl md5 | cut -d'=' -f2)
    
    if [ "$CERT_HASH" = "$KEY_HASH" ]; then
        echo "✓ SSL certificates copied and verified"
    else
        echo "✗ ERROR: Certificate and key don't match!"
        exit 1
    fi
else
    echo "⚠️  Certificate source not found: $CERT_SOURCE"
    echo "Please copy certificates manually to certs/ directory"
fi

# Step 2: Create data directory
echo ""
echo "Step 2: Creating data directory..."
mkdir -p data
echo "✓ Data directory created"

# Step 3: Install Node.js dependencies (root + client + server, INCLUDING devDeps)
# Required for running unit tests (jest, supertest) and the local dev server.
# The production container build uses --omit=dev separately in the Dockerfile.
echo ""
echo "Step 3: Installing Node.js dependencies (root + client + server)..."
if command -v npm >/dev/null 2>&1; then
    npm install --no-audit --no-fund --loglevel=error || { echo "✗ root npm install failed"; exit 1; }
    (cd client && npm install --no-audit --no-fund --loglevel=error) || { echo "✗ client npm install failed"; exit 1; }
    (cd server && npm install --no-audit --no-fund --loglevel=error) || { echo "✗ server npm install failed"; exit 1; }
    echo "✓ All Node.js dependencies installed (including devDeps for tests)"
else
    echo "⚠️  npm not found — skipping dependency install. Container build will install its own copy."
fi

# Step 4: Build container
echo ""
echo "Step 4: Building container..."
./container.sh build

# Step 5: Start container
echo ""
echo "Step 5: Starting container with HTTPS..."
./container.sh start-ssl

# Step 6: Setup monitoring (optional)
echo ""
read -p "Setup automatic health monitoring? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    chmod +x monitor.sh
    (crontab -l 2>/dev/null; echo "*/5 * * * * $(pwd)/monitor.sh") | crontab -
    echo "✓ Monitoring cron job installed"
fi

echo ""
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   ✅ Setup Complete!                                      ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "Access the application at:"
echo "  https://nr-ubp-dev-02.nihs.ch.nestle.com:5942"
echo ""
echo "Useful commands:"
echo "  ./container.sh status  - Check container status"
echo "  ./container.sh logs    - View container logs"
echo "  ./monitor.sh           - Manual health check"
