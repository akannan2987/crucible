#!/bin/bash

# Pandora Toolbox 2.0 - Startup Script
# Chemical & Sample Management System

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🧪 Pandora Toolbox 2.0 - Chemical & Sample Management   ║"
echo "║                                                           ║"
echo "╚═══════════════════════════════════════════════════════════╝"

# Change to script directory
cd "$(dirname "$0")"

# Check if node_modules exist
if [ ! -d "node_modules" ] || [ ! -d "client/node_modules" ] || [ ! -d "server/node_modules" ]; then
    echo ""
    echo "📦 Installing dependencies..."
    npm run install:all
fi

# Build client for production if dist doesn't exist
if [ ! -d "client/dist" ]; then
    echo ""
    echo "🔨 Building client..."
    npm run build
fi

# Set environment variables
export PORT=5942

# Start the server
echo ""
echo "🚀 Starting Pandora Toolbox 2.0..."
echo "   Access the application at:"
echo "   https://nr-ubp-dev-02.nihs.ch.nestle.com:5942"
echo ""

cd server && npm start
