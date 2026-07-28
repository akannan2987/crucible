#!/bin/bash

# Crucible: Pandora Toolbox Enhancement (v2.0) - Development Startup Script
# Runs both client and server in development mode

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║                                                           ║"
echo "║   🧪 Crucible: Pandora Toolbox Enhancement (v2.0)        ║"
echo "║      Development Mode                                     ║"
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

# Set environment variables (env-overridable; default matches the Dockerfile)
export PORT="${PORT:-49160}"

echo ""
echo "🚀 Starting development servers..."
echo "   Frontend: http://localhost:3000   (Vite dev server, see client/package.json)"
echo "   Backend:  http://localhost:${PORT}"
echo ""

npm run dev
