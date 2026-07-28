#!/bin/bash

# SSL Certificate Setup Script for Pandora Toolbox
# This script generates self-signed certificates for HTTPS

CERT_DIR="$(pwd)/certs"
DOMAIN="nr-ubp-dev-02.nihs.ch.nestle.com"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║   🔐 SSL Certificate Setup for Pandora Toolbox           ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""

# Create certs directory
mkdir -p ${CERT_DIR}

echo "Generating self-signed SSL certificate for ${DOMAIN}..."
echo ""

# Generate private key and certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout ${CERT_DIR}/server.key \
    -out ${CERT_DIR}/server.crt \
    -subj "/C=CH/ST=Vaud/L=Lausanne/O=Nestle/OU=NIHS/CN=${DOMAIN}" \
    -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1"

if [ $? -eq 0 ]; then
    echo "✓ SSL certificates generated successfully!"
    echo ""
    echo "Certificate files:"
    echo "  - ${CERT_DIR}/server.crt (Certificate)"
    echo "  - ${CERT_DIR}/server.key (Private Key)"
    echo ""
    echo "Next steps:"
    echo "  1. Rebuild the container: ./container.sh build"
    echo "  2. Start with HTTPS: ./container.sh start"
    echo "  3. Access at: https://${DOMAIN}:5942"
    echo ""
    echo "Note: Since this is a self-signed certificate, browsers will show"
    echo "a security warning. Click 'Advanced' and 'Proceed' to continue."
else
    echo "✗ Failed to generate certificates"
    exit 1
fi
