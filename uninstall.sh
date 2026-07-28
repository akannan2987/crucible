#!/bin/bash

# Pandora Toolbox 2.0 - Uninstall & Cleanup Script
# Safely removes all Pandora Toolbox components from the system
# Run from the project root directory

set -euo pipefail

# ── Configuration ────────────────────────────────────────────
IMAGE_NAME="pandora-toolbox"
CONTAINER_NAME="pandora-toolbox"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITOR_LOG="/tmp/pandora-monitor.log"

# ── Colors ───────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
BOLD='\033[1m'
NC='\033[0m'

# ── Helpers ──────────────────────────────────────────────────
info()    { echo -e "${BLUE}ℹ ${NC}$1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn()    { echo -e "${YELLOW}⚠${NC} $1"; }
error()   { echo -e "${RED}✗${NC} $1"; }
skip()    { echo -e "  ${YELLOW}↳ Skipped${NC} (not found)"; }

confirm() {
    local msg="$1"
    read -p "$(echo -e "${YELLOW}? ${NC}${msg} (y/N) ")" -n 1 -r
    echo
    [[ $REPLY =~ ^[Yy]$ ]]
}

show_header() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   🧪 Pandora Toolbox 2.0 - Uninstall & Cleanup           ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
}

show_help() {
    show_header
    echo "Usage: $0 [option]"
    echo ""
    echo "Options:"
    echo "  --partial     Remove container, image, cron, logs (keep source & data)"
    echo "  --full        Remove everything including data and source code"
    echo "  --interactive Guided step-by-step cleanup (default)"
    echo "  --dry-run     Show what would be removed without deleting anything"
    echo "  --help        Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                  # Interactive mode"
    echo "  $0 --partial        # Quick cleanup, keep source code"
    echo "  $0 --full           # Remove absolutely everything"
    echo "  $0 --dry-run        # Preview what would be removed"
    echo ""
}

# ── Cleanup Functions ────────────────────────────────────────

stop_container() {
    echo ""
    echo -e "${BOLD}Step 1: Stop Container${NC}"
    if podman ps --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
        podman stop "${CONTAINER_NAME}" 2>/dev/null
        success "Container '${CONTAINER_NAME}' stopped"
    else
        info "Container '${CONTAINER_NAME}' is not running"
    fi
}

remove_container() {
    echo ""
    echo -e "${BOLD}Step 2: Remove Container${NC}"
    if podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
        podman rm -f "${CONTAINER_NAME}" 2>/dev/null
        success "Container '${CONTAINER_NAME}' removed"
    else
        info "Container '${CONTAINER_NAME}' does not exist"
        skip
    fi
}

remove_image() {
    echo ""
    echo -e "${BOLD}Step 3: Remove Container Image${NC}"
    if podman images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -q "^${IMAGE_NAME}:latest$"; then
        podman rmi "${IMAGE_NAME}:latest" 2>/dev/null
        success "Image '${IMAGE_NAME}:latest' removed"
    else
        info "Image '${IMAGE_NAME}:latest' does not exist"
        skip
    fi

    # Prune dangling images
    local dangling
    dangling=$(podman images -f "dangling=true" -q 2>/dev/null | wc -l)
    if [ "$dangling" -gt 0 ]; then
        podman image prune -f >/dev/null 2>&1
        success "Pruned ${dangling} dangling image(s)"
    fi
}

remove_cron() {
    echo ""
    echo -e "${BOLD}Step 4: Remove Health Monitoring Cron Job${NC}"
    if crontab -l 2>/dev/null | grep -q 'monitor.sh'; then
        crontab -l 2>/dev/null | grep -v 'monitor.sh' | crontab -
        success "Monitoring cron job removed"
    else
        info "No monitoring cron job found"
        skip
    fi

    if [ -f "${MONITOR_LOG}" ]; then
        rm -f "${MONITOR_LOG}"
        success "Monitor log removed (${MONITOR_LOG})"
    fi
}

remove_certs() {
    echo ""
    echo -e "${BOLD}Step 5: Remove SSL Certificates${NC}"
    if [ -d "${PROJECT_DIR}/certs" ]; then
        rm -rf "${PROJECT_DIR}/certs"
        success "Local certificate copies removed (certs/)"
        info "Source certificates are untouched"
    else
        info "No local certificates found"
        skip
    fi
}

backup_data() {
    echo ""
    echo -e "${BOLD}Step 6a: Backup Application Data${NC}"
    if [ -f "${PROJECT_DIR}/data/pandora.json" ]; then
        local backup_dir="${HOME}/pandora-backups"
        local backup_file="${backup_dir}/pandora-final-$(date +%Y%m%d-%H%M%S).json"
        mkdir -p "${backup_dir}"
        cp "${PROJECT_DIR}/data/pandora.json" "${backup_file}"
        success "Database backed up to ${backup_file}"
    else
        info "No database file found to back up"
    fi
}

remove_data() {
    echo ""
    echo -e "${BOLD}Step 6b: Remove Application Data${NC}"
    if [ -d "${PROJECT_DIR}/data" ]; then
        rm -rf "${PROJECT_DIR}/data"
        success "Data directory removed"
    else
        info "No data directory found"
        skip
    fi

    # Remove named volume if it exists
    if podman volume exists pandora-data 2>/dev/null; then
        podman volume rm pandora-data 2>/dev/null
        success "Podman volume 'pandora-data' removed"
    fi
}

remove_node_modules() {
    echo ""
    echo -e "${BOLD}Step 7: Remove node_modules & Build Artifacts${NC}"
    local freed=0

    for dir in "${PROJECT_DIR}/node_modules" "${PROJECT_DIR}/client/node_modules" "${PROJECT_DIR}/server/node_modules"; do
        if [ -d "$dir" ]; then
            local size
            size=$(du -sh "$dir" 2>/dev/null | cut -f1)
            rm -rf "$dir"
            success "Removed $(basename "$(dirname "$dir")")/node_modules (${size})"
            freed=1
        fi
    done

    if [ -d "${PROJECT_DIR}/client/dist" ]; then
        rm -rf "${PROJECT_DIR}/client/dist"
        success "Removed client/dist build output"
        freed=1
    fi

    [ "$freed" -eq 0 ] && { info "No node_modules or build artifacts found"; skip; }
}

remove_systemd() {
    echo ""
    echo -e "${BOLD}Step 8: Remove systemd Service (if configured)${NC}"
    local service_file="/etc/systemd/system/pandora-toolbox.service"
    if [ -f "$service_file" ]; then
        warn "systemd service found — requires sudo to remove"
        if confirm "Remove systemd service?"; then
            sudo systemctl stop pandora-toolbox 2>/dev/null || true
            sudo systemctl disable pandora-toolbox 2>/dev/null || true
            sudo rm -f "$service_file"
            sudo systemctl daemon-reload
            success "systemd service removed"
        else
            warn "Skipped systemd service removal"
        fi
    else
        info "No systemd service installed"
        skip
    fi
}

remove_project() {
    echo ""
    echo -e "${BOLD}Step 9: Remove Project Directory${NC}"
    warn "This will delete ALL source code at:"
    echo "  ${PROJECT_DIR}"
    echo ""
    if confirm "Are you absolutely sure?"; then
        # We need to cd out before removing
        cd "${PROJECT_DIR}/.."
        rm -rf "${PROJECT_DIR}"
        success "Project directory removed"
    else
        warn "Skipped project directory removal"
    fi
}

# ── Summary ──────────────────────────────────────────────────

show_summary() {
    echo ""
    echo "╔═══════════════════════════════════════════════════════════╗"
    echo "║   ✅ Cleanup Complete!                                    ║"
    echo "╚═══════════════════════════════════════════════════════════╝"
    echo ""
}

# ── Dry Run ──────────────────────────────────────────────────

dry_run() {
    show_header
    echo -e "${BOLD}Dry Run — the following items would be removed:${NC}"
    echo ""

    # Container
    if podman ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${CONTAINER_NAME}$"; then
        echo -e "  ${RED}✗${NC} Container: ${CONTAINER_NAME}"
    else
        echo -e "  ${GREEN}✓${NC} Container: (already removed)"
    fi

    # Image
    if podman images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep -q "^${IMAGE_NAME}:latest$"; then
        echo -e "  ${RED}✗${NC} Image: ${IMAGE_NAME}:latest"
    else
        echo -e "  ${GREEN}✓${NC} Image: (already removed)"
    fi

    # Cron
    if crontab -l 2>/dev/null | grep -q 'monitor.sh'; then
        echo -e "  ${RED}✗${NC} Cron job: monitor.sh entry"
    else
        echo -e "  ${GREEN}✓${NC} Cron job: (none found)"
    fi

    # Monitor log
    if [ -f "${MONITOR_LOG}" ]; then
        echo -e "  ${RED}✗${NC} Monitor log: ${MONITOR_LOG}"
    else
        echo -e "  ${GREEN}✓${NC} Monitor log: (not found)"
    fi

    # Certs
    if [ -d "${PROJECT_DIR}/certs" ]; then
        echo -e "  ${RED}✗${NC} SSL certificates: certs/"
    else
        echo -e "  ${GREEN}✓${NC} SSL certificates: (not found)"
    fi

    # Data
    if [ -d "${PROJECT_DIR}/data" ]; then
        local dbsize
        dbsize=$(du -sh "${PROJECT_DIR}/data" 2>/dev/null | cut -f1)
        echo -e "  ${RED}✗${NC} Application data: data/ (${dbsize})"
    else
        echo -e "  ${GREEN}✓${NC} Application data: (not found)"
    fi

    # node_modules
    local total_nm=0
    for dir in "${PROJECT_DIR}/node_modules" "${PROJECT_DIR}/client/node_modules" "${PROJECT_DIR}/server/node_modules"; do
        if [ -d "$dir" ]; then
            local nmsize
            nmsize=$(du -sh "$dir" 2>/dev/null | cut -f1)
            echo -e "  ${RED}✗${NC} $(echo "$dir" | sed "s|${PROJECT_DIR}/||"): (${nmsize})"
            total_nm=1
        fi
    done
    [ "$total_nm" -eq 0 ] && echo -e "  ${GREEN}✓${NC} node_modules: (not found)"

    # Build artifacts
    if [ -d "${PROJECT_DIR}/client/dist" ]; then
        echo -e "  ${RED}✗${NC} Build output: client/dist/"
    else
        echo -e "  ${GREEN}✓${NC} Build output: (not found)"
    fi

    # systemd
    if [ -f "/etc/systemd/system/pandora-toolbox.service" ]; then
        echo -e "  ${RED}✗${NC} systemd service: pandora-toolbox.service"
    else
        echo -e "  ${GREEN}✓${NC} systemd service: (not installed)"
    fi

    echo ""
    echo -e "${BLUE}ℹ ${NC}No changes were made. Run without --dry-run to proceed."
    echo ""
}

# ── Mode: Partial ────────────────────────────────────────────

run_partial() {
    show_header
    echo -e "${BOLD}Partial Cleanup${NC} — removes runtime artifacts, keeps source code & data"
    echo ""

    stop_container
    remove_container
    remove_image
    remove_cron
    remove_certs
    remove_node_modules
    show_summary

    echo "Source code and data are preserved."
    echo "To redeploy later, run: ./setup-after-clone.sh"
    echo ""
}

# ── Mode: Full ───────────────────────────────────────────────

run_full() {
    show_header
    echo -e "${RED}${BOLD}Full Uninstall${NC} — removes EVERYTHING including data and source code"
    echo ""
    warn "This will permanently delete all application data and source code."
    echo ""

    if ! confirm "Continue with full uninstall?"; then
        echo ""
        info "Aborted."
        exit 0
    fi

    stop_container
    remove_container
    remove_image
    remove_cron
    remove_certs
    backup_data
    remove_data
    remove_node_modules
    remove_systemd
    remove_project
    show_summary
}

# ── Mode: Interactive ────────────────────────────────────────

run_interactive() {
    show_header
    echo -e "${BOLD}Interactive Cleanup${NC} — choose what to remove step by step"
    echo ""

    # Step 1-3: Container
    if confirm "Stop and remove container + image?"; then
        stop_container
        remove_container
        remove_image
    fi

    # Step 4: Cron
    if confirm "Remove health monitoring cron job?"; then
        remove_cron
    fi

    # Step 5: Certs
    if confirm "Remove local SSL certificate copies?"; then
        remove_certs
    fi

    # Step 6: Data
    if confirm "Remove application data? (chemicals, samples, etc.)"; then
        if confirm "  Back up data before removing?"; then
            backup_data
        fi
        remove_data
    fi

    # Step 7: node_modules
    if confirm "Remove node_modules and build artifacts?"; then
        remove_node_modules
    fi

    # Step 8: systemd
    remove_systemd

    # Step 9: Project
    echo ""
    if confirm "Remove the entire project directory?"; then
        remove_project
    fi

    show_summary
}

# ── Main ─────────────────────────────────────────────────────

MODE="${1:---interactive}"

case "$MODE" in
    --partial|-p)
        run_partial
        ;;
    --full|-f)
        run_full
        ;;
    --interactive|-i)
        run_interactive
        ;;
    --dry-run|-d)
        dry_run
        ;;
    --help|-h|help)
        show_help
        ;;
    *)
        error "Unknown option: $MODE"
        echo ""
        show_help
        exit 1
        ;;
esac
