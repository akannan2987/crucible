#!/bin/bash

# Crucible: Pandora Toolbox Enhancement (v2.0) - Container Management Script
# Uses Podman to build and run the application

IMAGE_NAME="crucible"
CONTAINER_NAME="crucible"
# Port selection: use CRUCIBLE_PORT to override (default 49160). A generic
# PORT variable from the environment is deliberately IGNORED — shared dev
# machines often export PORT for unrelated apps.
if [ -n "$CRUCIBLE_PORT" ]; then
    PORT="$CRUCIBLE_PORT"
else
    if [ -n "$PORT" ] && [ "$PORT" != "49160" ]; then
        echo "ℹ  Ignoring PORT=$PORT from the environment (use CRUCIBLE_PORT=<n> to override); using 49160."
    fi
    PORT=49160
fi
HTTPS_PORT="${HTTPS_PORT:-5943}"

# Host interface for published ports (override with HOST_BIND=<ip>).
# Linux (RHEL8 VM): 0.0.0.0 so the app is reachable from other machines.
# macOS: Apple's remoted daemon already listens on ports 49152+ on a
# link-local IPv6 address, which makes podman's wildcard bind of 49160
# fail with "address already in use" — 127.0.0.1 avoids that and is all
# local development needs.
if [ -z "$HOST_BIND" ]; then
    if [ "$(uname -s)" = "Darwin" ]; then
        HOST_BIND="127.0.0.1"
    else
        HOST_BIND="0.0.0.0"
    fi
fi
DATA_DIR="$(pwd)/data"
CERTS_DIR="$(pwd)/certs"
USE_HTTPS="${USE_HTTPS:-false}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Container runtime detection (podman preferred, docker fallback) ──
# Override with CONTAINER_RUNTIME=podman|docker. Detection is by CLI
# presence, so podman's docker-compatible socket cannot confuse it.
if [ -n "$CONTAINER_RUNTIME" ]; then
    RUNTIME="$CONTAINER_RUNTIME"
    if ! command -v "$RUNTIME" >/dev/null 2>&1; then
        echo -e "${RED}✗ CONTAINER_RUNTIME=$RUNTIME but '$RUNTIME' is not installed${NC}"
        exit 1
    fi
elif command -v podman >/dev/null 2>&1; then
    RUNTIME="podman"
elif command -v docker >/dev/null 2>&1; then
    RUNTIME="docker"
else
    echo -e "${RED}✗ Neither podman nor docker found. Install one, or set CONTAINER_RUNTIME.${NC}"
    exit 1
fi

# On macOS the podman VM does not auto-start on login — check it and give
# a clear message instead of a cryptic socket error.
check_podman_machine() {
    if [ "$RUNTIME" = "podman" ] && [ "$(uname -s)" = "Darwin" ]; then
        local state
        state=$(podman machine inspect --format '{{.State}}' 2>/dev/null)
        if [ "$state" != "running" ]; then
            echo -e "${RED}✗ The podman machine VM is not running (state: ${state:-not created}).${NC}"
            echo ""
            echo "  Start it with:   podman machine start"
            exit 1
        fi
    fi
}

show_help() {
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   🧪 Crucible: Pandora Toolbox Enhancement (v2.0)        ║"
    echo "║      Container Management                                 ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Usage: $0 [command]"
    echo ""
    echo "Commands:"
    echo "  build       Build the container image"
    echo "  start       Start the container (HTTP, production mode)"
    echo "  start-ssl   Start the container with HTTPS (production mode)"
    echo "  start-dev   Start in DEV mode: live server reload (nodemon) + live client bundle + live docs"
    echo "  stop        Stop the container"
    echo "  restart     Restart the container"
    echo "  logs        Show container logs"
    echo "  status      Show container status"
    echo "  shell       Open a shell in the container"
    echo "  clean       Remove container and image"
    echo "  setup-ssl   Generate self-signed SSL certificates"
    echo "  help        Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  USE_HTTPS=true  Enable HTTPS mode"
    echo ""
}

build_image() {
    check_podman_machine
    echo -e "${YELLOW}Building Crucible container image with ${RUNTIME}...${NC}"
    # --format docker is required so the Dockerfile HEALTHCHECK is honored;
    # podman's default OCI format silently ignores HEALTHCHECK. Docker
    # neither needs nor accepts the flag.
    local format_args=()
    if [ "$RUNTIME" = "podman" ]; then
        format_args=(--format docker)
    fi
    $RUNTIME build "${format_args[@]}" -t ${IMAGE_NAME}:latest .
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Image built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build image${NC}"
        exit 1
    fi
}

start_container() {
    check_podman_machine
    # Check if container already exists
    if $RUNTIME ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Container already exists. Starting...${NC}"
        $RUNTIME start ${CONTAINER_NAME}
    else
        echo -e "${YELLOW}Creating and starting container...${NC}"
        
        # Create data directory if it doesn't exist
        mkdir -p ${DATA_DIR}
        
        # Build volume and environment arguments
        # docs/ is bind-mounted read-only so /architecture and other doc pages
        # reflect host-side edits immediately — no rebuild needed.
        VOLUMES="-v ${DATA_DIR}:/app/server/data:Z -v $(pwd)/docs:/app/docs:Z,ro"
        ENV_VARS="-e PORT=${PORT} -e USE_HTTPS=false"
        PORTS="-p ${HOST_BIND}:${PORT}:${PORT}"
        
        $RUNTIME run -d \
            --name ${CONTAINER_NAME} \
            ${PORTS} \
            ${VOLUMES} \
            ${ENV_VARS} \
            --restart unless-stopped \
            ${IMAGE_NAME}:latest
    fi
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container started successfully${NC}"
        echo ""
        echo "Access the application at:"
        echo "  http://localhost:${PORT}"
        echo "  http://$(hostname):${PORT}   (from another machine)"
    else
        echo -e "${RED}✗ Failed to start container${NC}"
        exit 1
    fi
}

start_container_ssl() {
    check_podman_machine
    # Check if certificates exist
    if [ ! -f "${CERTS_DIR}/server.crt" ] || [ ! -f "${CERTS_DIR}/server.key" ]; then
        echo -e "${RED}✗ SSL certificates not found!${NC}"
        echo ""
        echo "Please run './container.sh setup-ssl' first to generate certificates."
        echo "Or place your certificates in: ${CERTS_DIR}/"
        echo "  - server.crt (Certificate)"
        echo "  - server.key (Private Key)"
        exit 1
    fi
    
    # Stop existing container if running
    if $RUNTIME ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Stopping existing container...${NC}"
        $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null
        $RUNTIME rm ${CONTAINER_NAME} 2>/dev/null
    fi
    
    echo -e "${YELLOW}Creating and starting container with HTTPS...${NC}"
    
    # Create directories
    mkdir -p ${DATA_DIR}
    
    $RUNTIME run -d \
        --name ${CONTAINER_NAME} \
        -p ${HOST_BIND}:${PORT}:${PORT} \
        -p ${HOST_BIND}:${HTTPS_PORT}:${HTTPS_PORT} \
        -v ${DATA_DIR}:/app/server/data:Z \
        -v ${CERTS_DIR}:/app/certs:Z,ro \
        -v $(pwd)/docs:/app/docs:Z,ro \
        -e PORT=${PORT} \
        -e HTTPS_PORT=${HTTPS_PORT} \
        -e USE_HTTPS=true \
        -e SSL_CERT_PATH=/app/certs/server.crt \
        -e SSL_KEY_PATH=/app/certs/server.key \
        --restart unless-stopped \
        ${IMAGE_NAME}:latest

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container started with HTTPS${NC}"
        echo ""
        echo -e "${BLUE}🔒 Access the application at:${NC}"
        echo "  https://localhost:${PORT}"
        echo "  https://$(hostname):${PORT}   (from another machine)"
        echo ""
        echo -e "${YELLOW}Note: If using self-signed certificate, browser will show a warning.${NC}"
        echo "Click 'Advanced' → 'Proceed' to continue."
    else
        echo -e "${RED}✗ Failed to start container${NC}"
        exit 1
    fi
}

start_container_dev() {
    # Live-reload development mode.
    # Bind-mounts server source (nodemon auto-reloads) + client dist + docs
    # so host edits propagate immediately without rebuilding the image.

    if [ ! -f "${CERTS_DIR}/server.crt" ] || [ ! -f "${CERTS_DIR}/server.key" ]; then
        echo -e "${RED}✗ SSL certificates not found in ${CERTS_DIR}/${NC}"
        echo "Run './container.sh setup-ssl' first, or copy real certs into ${CERTS_DIR}/"
        exit 1
    fi

    if [ ! -f "client/dist/index.html" ]; then
        echo -e "${YELLOW}client/dist not built yet — running 'npm run build' in client/ …${NC}"
        (cd client && npm run build) || { echo -e "${RED}✗ client build failed${NC}"; exit 1; }
    fi

    # Stop existing container if running
    if $RUNTIME ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Stopping existing container…${NC}"
        $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null
        $RUNTIME rm ${CONTAINER_NAME} 2>/dev/null
    fi

    mkdir -p ${DATA_DIR}

    echo -e "${YELLOW}Starting container in DEV mode (live reload)…${NC}"

    # Override CMD to run nodemon so server restarts on src/ changes.
    # CHOKIDAR_USEPOLLING + --legacy-watch is required for bind-mounts over GPFS.
    $RUNTIME run -d \
        --name ${CONTAINER_NAME} \
        -p ${HOST_BIND}:${PORT}:${PORT} \
        -p ${HOST_BIND}:${HTTPS_PORT}:${HTTPS_PORT} \
        -v ${DATA_DIR}:/app/server/data:Z \
        -v ${CERTS_DIR}:/app/certs:Z,ro \
        -v $(pwd)/docs:/app/docs:Z,ro \
        -v $(pwd)/server/src:/app/server/src:Z,ro \
        -v $(pwd)/server/package.json:/app/server/package.json:Z,ro \
        -v $(pwd)/client/dist:/app/client/dist:Z,ro \
        -e PORT=${PORT} \
        -e HTTPS_PORT=${HTTPS_PORT} \
        -e USE_HTTPS=true \
        -e SSL_CERT_PATH=/app/certs/server.crt \
        -e SSL_KEY_PATH=/app/certs/server.key \
        -e NODE_ENV=development \
        -e CHOKIDAR_USEPOLLING=true \
        --restart unless-stopped \
        ${IMAGE_NAME}:latest \
        sh -c "cd /app/server && npx nodemon --legacy-watch --watch src --ext js,json,mjs --ignore 'src/**/*.test.js' src/index.js"

    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container started in DEV mode${NC}"
        echo ""
        echo -e "${BLUE}🔥 Live reload active for:${NC}"
        echo "  • server/src/        → nodemon restarts Node on every save"
        echo "  • docs/              → /architecture and other doc pages refresh instantly"
        echo "  • client/dist/       → rebuild with 'cd client && npm run build' (or watch mode)"
        echo ""
        echo -e "${YELLOW}💡 For client HMR run in a separate terminal:${NC}"
        echo "  cd client && npm run dev       # Vite on http://localhost:3000 (proxies /api to ${PORT})"
        echo ""
        echo -e "${YELLOW}💡 Or for a watched production-style build:${NC}"
        echo "  cd client && npx vite build --watch"
        echo ""
        echo -e "${BLUE}🔒 App URL:${NC} https://$(hostname):${PORT}  (or https://localhost:${PORT})"
        echo -e "${BLUE}📜 Logs:${NC}    ./container.sh logs"
    else
        echo -e "${RED}✗ Failed to start container in dev mode${NC}"
        exit 1
    fi
}

setup_ssl() {
    echo -e "${YELLOW}Setting up SSL certificates...${NC}"
    echo ""
    
    mkdir -p ${CERTS_DIR}

    # Certificate CN defaults to this machine's FQDN; override with
    # SSL_DOMAIN=my.host.name ./container.sh setup-ssl
    DOMAIN="${SSL_DOMAIN:-$(hostname -f 2>/dev/null || hostname)}"

    echo "Generating self-signed SSL certificate for ${DOMAIN}..."
    
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout ${CERTS_DIR}/server.key \
        -out ${CERTS_DIR}/server.crt \
        -subj "/C=CH/ST=Vaud/L=Lausanne/O=Nestle/OU=NIHS/CN=${DOMAIN}" \
        -addext "subjectAltName=DNS:${DOMAIN},DNS:localhost,IP:127.0.0.1" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ SSL certificates generated successfully!${NC}"
        echo ""
        echo "Certificate files:"
        echo "  - ${CERTS_DIR}/server.crt"
        echo "  - ${CERTS_DIR}/server.key"
        echo ""
        echo "Next steps:"
        echo "  1. Rebuild: ./container.sh build"
        echo "  2. Start with HTTPS: ./container.sh start-ssl"
    else
        echo -e "${RED}✗ Failed to generate certificates${NC}"
        exit 1
    fi
}

stop_container() {
    echo -e "${YELLOW}Stopping container...${NC}"
    $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ Container stopped${NC}"
    else
        echo -e "${YELLOW}Container was not running${NC}"
    fi
}

restart_container() {
    stop_container
    sleep 2
    start_container
}

show_logs() {
    echo -e "${YELLOW}Container logs:${NC}"
    $RUNTIME logs -f ${CONTAINER_NAME}
}

show_status() {
    echo -e "${YELLOW}Container status:${NC}"
    $RUNTIME ps -a --filter name=${CONTAINER_NAME} --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # Check if running and show health
    if $RUNTIME ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${GREEN}✓ Container is running${NC}"
        echo ""
        echo "Testing API endpoint..."
        curl --noproxy '*' -s http://localhost:${PORT}/api/stats | head -100
        echo ""
    else
        echo -e "${RED}✗ Container is not running${NC}"
    fi
}

open_shell() {
    echo -e "${YELLOW}Opening shell in container...${NC}"
    $RUNTIME exec -it ${CONTAINER_NAME} /bin/sh
}

clean_up() {
    echo -e "${YELLOW}Cleaning up container and image...${NC}"
    $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null
    $RUNTIME rm ${CONTAINER_NAME} 2>/dev/null
    $RUNTIME rmi ${IMAGE_NAME}:latest 2>/dev/null
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main script
case "$1" in
    build)
        build_image
        ;;
    start)
        start_container
        ;;
    start-ssl)
        start_container_ssl
        ;;
    start-dev|dev)
        start_container_dev
        ;;
    stop)
        stop_container
        ;;
    restart)
        restart_container
        ;;
    logs)
        show_logs
        ;;
    status)
        show_status
        ;;
    shell)
        open_shell
        ;;
    clean)
        clean_up
        ;;
    setup-ssl)
        setup_ssl
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        show_help
        if [ -n "$1" ]; then
            echo -e "${RED}Unknown command: $1${NC}"
            exit 1
        fi
        ;;
esac
