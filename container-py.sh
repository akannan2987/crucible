#!/bin/bash

# Crucible: Pandora Toolbox Enhancement (v2.0) - Python Backend Container Management
#
# Runtime-agnostic: works with BOTH podman and docker using identical
# subcommands. Selection order:
#   1. CONTAINER_RUNTIME=podman|docker  (explicit override)
#   2. podman, if installed
#   3. docker, if installed
#
# All settings are env-overridable:
#   CRUCIBLE_PORT=<n>   host+container HTTP port (default 49160; a generic
#                       PORT env var is ignored to avoid shared-VM clashes)
#   HOST_BIND=<ip>      published-port interface (see below)
#   PLATFORM=linux/amd64  cross-build target (e.g. building amd64 on a Mac)

IMAGE_NAME="crucible-py"
CONTAINER_NAME="crucible-py"
DATA_DIR="$(pwd)/data"

# ── Port selection ──────────────────────────────────────────────────
# Use CRUCIBLE_PORT to override the port. A generic PORT variable from the
# environment is deliberately IGNORED: shared dev machines often export
# PORT for unrelated apps (observed on the RHEL8 VM, where PORT=3000 made
# the container bind the wrong port).
if [ -n "$CRUCIBLE_PORT" ]; then
    PORT="$CRUCIBLE_PORT"
else
    if [ -n "$PORT" ] && [ "$PORT" != "49160" ]; then
        echo "ℹ  Ignoring PORT=$PORT from the environment (use CRUCIBLE_PORT=<n> to override); using 49160."
    fi
    PORT=49160
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Container runtime detection ─────────────────────────────────────
# Note: on macOS the podman VM also exposes a docker-compatible socket at
# /var/run/docker.sock. Detection is by CLI presence (not by socket), so
# that socket cannot confuse the choice.
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

# ── macOS podman: the client talks to a Linux VM that does NOT auto-start
# on login. Check it before any command, so the user gets a clear message
# instead of a cryptic socket error.
check_podman_machine() {
    if [ "$RUNTIME" = "podman" ] && [ "$(uname -s)" = "Darwin" ]; then
        local state
        state=$(podman machine inspect --format '{{.State}}' 2>/dev/null)
        if [ "$state" != "running" ]; then
            echo -e "${RED}✗ The podman machine VM is not running (state: ${state:-not created}).${NC}"
            echo ""
            echo "  Start it with:   podman machine start"
            echo "  (create first with 'podman machine init' if it does not exist)"
            exit 1
        fi
    fi
}

# ── Host interface for published ports (same logic as container.sh) ──
# Linux (RHEL8 VM): 0.0.0.0 so the app is reachable from other machines.
# macOS: Apple's remoted daemon occupies ports 49152+ on a link-local IPv6
# address, which makes a wildcard bind of 49160 fail — 127.0.0.1 avoids
# that and is all local development needs. Override with HOST_BIND=<ip>.
if [ -z "$HOST_BIND" ]; then
    if [ "$(uname -s)" = "Darwin" ]; then
        HOST_BIND="127.0.0.1"
    else
        HOST_BIND="0.0.0.0"
    fi
fi

show_help() {
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   🧪 Crucible: Pandora Toolbox Enhancement (v2.0)        ║"
    echo "║      Python Backend Container Management                  ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
    echo "Usage: $0 [command]        (runtime: $RUNTIME)"
    echo ""
    echo "Commands:"
    echo "  build       Build the Python backend image"
    echo "  start       Start the container (port ${PORT})"
    echo "  stop        Stop the container"
    echo "  restart     Restart the container"
    echo "  rebuild     Rebuild image and restart container"
    echo "  migrate     Run the lowdb → SQLite migration inside the container"
    echo "  logs        Show container logs (follow)"
    echo "  status      Show container status + /api/stats healthcheck"
    echo "  shell       Open a shell in the container"
    echo "  clean       Remove container and image"
    echo "  help        Show this help message"
    echo ""
    echo "Environment variables:"
    echo "  CONTAINER_RUNTIME=podman|docker   force a runtime (default: auto-detect)"
    echo "  CRUCIBLE_PORT=<n>                 port (default 49160; generic PORT is ignored)"
    echo "  HOST_BIND=<ip>                    published-port interface"
    echo "  PLATFORM=linux/amd64              cross-build target platform"
    echo ""
}

build_image() {
    check_podman_machine
    echo -e "${YELLOW}Building ${IMAGE_NAME} image with ${RUNTIME}...${NC}"

    local build_args=(-f backend/Dockerfile -t "${IMAGE_NAME}:latest")
    # podman's native OCI format silently drops the Dockerfile HEALTHCHECK;
    # --format docker preserves it. Docker needs (and accepts) no such flag.
    if [ "$RUNTIME" = "podman" ]; then
        build_args=(--format docker "${build_args[@]}")
    fi
    # Optional cross-build, e.g. PLATFORM=linux/amd64 on an arm64 Mac.
    if [ -n "$PLATFORM" ]; then
        build_args=(--platform "$PLATFORM" "${build_args[@]}")
    fi

    if $RUNTIME build "${build_args[@]}" .; then
        echo -e "${GREEN}✓ Image built successfully${NC}"
    else
        echo -e "${RED}✗ Failed to build image${NC}"
        exit 1
    fi
}

start_container() {
    check_podman_machine
    if $RUNTIME ps -a --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${YELLOW}Container already exists. Starting...${NC}"
        $RUNTIME start ${CONTAINER_NAME}
    else
        echo -e "${YELLOW}Creating and starting container (runtime: ${RUNTIME}, port: ${PORT})...${NC}"
        mkdir -p "${DATA_DIR}"

        # :Z relabels the volume for SELinux (required on RHEL8; harmless
        # no-op on macOS and non-SELinux hosts, for both runtimes).
        $RUNTIME run -d \
            --name ${CONTAINER_NAME} \
            -p ${HOST_BIND}:${PORT}:${PORT} \
            -v "${DATA_DIR}:/app/data:Z" \
            -e PORT=${PORT} \
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

stop_container() {
    check_podman_machine
    echo -e "${YELLOW}Stopping container...${NC}"
    if $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null; then
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

rebuild() {
    build_image
    check_podman_machine
    $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null
    $RUNTIME rm ${CONTAINER_NAME} 2>/dev/null
    start_container
}

run_migration() {
    check_podman_machine
    # Runs inside the RUNNING container so it uses the same mounted /app/data.
    if ! $RUNTIME ps --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "${RED}✗ Container is not running — start it first: $0 start${NC}"
        exit 1
    fi
    echo -e "${YELLOW}Running lowdb → SQLite migration (idempotent)...${NC}"
    $RUNTIME exec ${CONTAINER_NAME} python scripts/migrate_from_lowdb.py
}

show_logs() {
    check_podman_machine
    echo -e "${YELLOW}Container logs:${NC}"
    $RUNTIME logs -f ${CONTAINER_NAME}
}

show_status() {
    check_podman_machine
    echo -e "${YELLOW}Container status (runtime: ${RUNTIME}):${NC}"
    $RUNTIME ps -a --filter name=${CONTAINER_NAME} --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
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
    check_podman_machine
    echo -e "${YELLOW}Opening shell in container...${NC}"
    $RUNTIME exec -it ${CONTAINER_NAME} /bin/bash
}

clean_up() {
    check_podman_machine
    echo -e "${YELLOW}Cleaning up container and image...${NC}"
    $RUNTIME stop ${CONTAINER_NAME} 2>/dev/null
    $RUNTIME rm ${CONTAINER_NAME} 2>/dev/null
    $RUNTIME rmi ${IMAGE_NAME}:latest 2>/dev/null
    echo -e "${GREEN}✓ Cleanup complete${NC}"
}

# Main script
case "$1" in
    build)    build_image ;;
    start)    start_container ;;
    stop)     stop_container ;;
    restart)  restart_container ;;
    rebuild)  rebuild ;;
    migrate)  run_migration ;;
    logs)     show_logs ;;
    status)   show_status ;;
    shell)    open_shell ;;
    clean)    clean_up ;;
    help|--help|-h) show_help ;;
    *)
        show_help
        if [ -n "$1" ]; then
            echo -e "${RED}Unknown command: $1${NC}"
            exit 1
        fi
        ;;
esac
