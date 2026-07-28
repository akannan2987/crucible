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

# Set environment variables
export PORT=5942

echo ""
echo "🚀 Starting development servers..."
echo "   Frontend: http://localhost:5173"
echo "   Backend:  http://localhost:5942"
echo ""

npm run dev
