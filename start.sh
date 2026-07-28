#!/bin/bash

# Crucible: Pandora Toolbox Enhancement (v2.0) - Startup Script
# Chemical & Sample Management System

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🧪 Crucible: Pandora Toolbox Enhancement (v2.0)        ║"
echo "║      Chemical & Sample Management                         ║"
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

# Set environment variables (env-overridable; default matches the Dockerfile)
export PORT="${PORT:-49160}"

# Start the server
echo ""
echo "🚀 Starting Crucible: Pandora Toolbox Enhancement (v2.0)..."
echo "   Access the application at:"
echo "   http://localhost:${PORT}"
echo "   http://$(hostname):${PORT}   (from another machine)"
echo ""

cd server && npm start
