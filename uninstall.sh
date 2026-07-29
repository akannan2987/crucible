#!/bin/bash

# Crucible: Pandora Toolbox Enhancement (v2.0) - Uninstall & Cleanup Script
# Safely removes all Crucible components from the system
# Run from the project root directory

set -euo pipefail

# ── Configuration ────────────────────────────────────────────
# Covers BOTH stacks: the Python backend (crucible-py) and the legacy
# Node backend (crucible).
IMAGES="crucible-py crucible"
CONTAINERS="crucible-py crucible"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONITOR_LOGS="/tmp/crucible-monitor.log /tmp/pandora-monitor.log"

# Runtime detection (same convention as container*.sh)
if [ -n "${CONTAINER_RUNTIME:-}" ]; then RUNTIME="$CONTAINER_RUNTIME"
elif command -v podman >/dev/null 2>&1; then RUNTIME="podman"
elif command -v docker >/dev/null 2>&1; then RUNTIME="docker"
else RUNTIME=":"; fi   # ':' = no-op → container steps report "not found" gracefully

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
    echo "║   🧪 Crucible: Pandora Toolbox Enhancement (v2.0)        ║"
    echo "║      Uninstall & Cleanup                                  ║"
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
    echo -e "${BOLD}Step 1: Stop Containers (both stacks)${NC}"
    local name
    for name in ${CONTAINERS}; do
        if $RUNTIME ps --format '{{.Names}}' 2>/dev/null | grep "^${name}$" >/dev/null; then
            $RUNTIME stop "${name}" 2>/dev/null
            success "Container '${name}' stopped"
        else
            info "Container '${name}' is not running"
        fi
    done
}

remove_container() {
    echo ""
    echo -e "${BOLD}Step 2: Remove Containers (both stacks)${NC}"
    local name found=0
    for name in ${CONTAINERS}; do
        if $RUNTIME ps -a --format '{{.Names}}' 2>/dev/null | grep "^${name}$" >/dev/null; then
            $RUNTIME rm -f "${name}" 2>/dev/null
            success "Container '${name}' removed"
            found=1
        fi
    done
    [ "$found" -eq 0 ] && { info "No crucible containers exist"; skip; }
}

remove_image() {
    echo ""
    echo -e "${BOLD}Step 3: Remove Container Images (both stacks)${NC}"
    local name found=0
    for name in ${IMAGES}; do
        if $RUNTIME images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep "${name}:latest$" >/dev/null; then
            $RUNTIME rmi "${name}:latest" 2>/dev/null
            success "Image '${name}:latest' removed"
            found=1
        fi
    done
    [ "$found" -eq 0 ] && { info "No crucible images exist"; skip; }

    # Prune dangling images
    local dangling
    dangling=$($RUNTIME images -f "dangling=true" -q 2>/dev/null | wc -l)
    if [ "$dangling" -gt 0 ]; then
        $RUNTIME image prune -f >/dev/null 2>&1
        success "Pruned ${dangling} dangling image(s)"
    fi
    info "Base images (python:3.12-slim, node:18-alpine) are left in place;"
    info "remove with '$RUNTIME image prune -a' if you want them gone too."
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

    local log
    for log in ${MONITOR_LOGS}; do
        if [ -f "${log}" ]; then
            rm -f "${log}"
            success "Monitor log removed (${log})"
        fi
    done
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
    echo -e "${BOLD}Step 6a: Backup Application Data (both databases)${NC}"
    local backup_dir="${HOME}/crucible-backups"
    local stamp
    stamp=$(date +%Y%m%d-%H%M%S)
    local found=0
    mkdir -p "${backup_dir}"
    # Containers are already stopped at this point, so plain copies are safe
    # (never copy a RUNNING SQLite database — see MIGRATION.md §11).
    if [ -f "${PROJECT_DIR}/data/crucible.db" ]; then
        cp "${PROJECT_DIR}/data/crucible.db" "${backup_dir}/crucible-final-${stamp}.db"
        success "SQLite database backed up to ${backup_dir}/crucible-final-${stamp}.db"
        found=1
    fi
    if [ -f "${PROJECT_DIR}/data/pandora.json" ]; then
        cp "${PROJECT_DIR}/data/pandora.json" "${backup_dir}/pandora-final-${stamp}.json"
        success "Legacy lowdb file backed up to ${backup_dir}/pandora-final-${stamp}.json"
        found=1
    fi
    [ "$found" -eq 0 ] && info "No database files found to back up"
}

remove_data() {
    echo ""
    echo -e "${BOLD}Step 6b: Remove Application Data${NC}"
    if [ -d "${PROJECT_DIR}/data" ]; then
        rm -rf "${PROJECT_DIR}/data"
        success "Data directory removed (crucible.db + pandora.json)"
    else
        info "No data directory found"
        skip
    fi

    if [ -d "${PROJECT_DIR}/backups" ]; then
        rm -rf "${PROJECT_DIR}/backups"
        success "Local backups directory removed (backups/)"
        info "Final safety copies remain in ~/crucible-backups"
    fi

    # Remove named volume if it exists (legacy)
    if $RUNTIME volume exists pandora-data 2>/dev/null; then
        $RUNTIME volume rm pandora-data 2>/dev/null
        success "Volume 'pandora-data' removed"
    fi
}

remove_node_modules() {
    echo ""
    echo -e "${BOLD}Step 7: Remove Dependencies & Build Artifacts (Node + Python)${NC}"
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

    # Python artifacts (new backend)
    if [ -d "${PROJECT_DIR}/backend/.venv" ]; then
        local vsize
        vsize=$(du -sh "${PROJECT_DIR}/backend/.venv" 2>/dev/null | cut -f1)
        rm -rf "${PROJECT_DIR}/backend/.venv"
        success "Removed backend/.venv (${vsize})"
        freed=1
    fi
    if find "${PROJECT_DIR}/backend" -type d \( -name "__pycache__" -o -name ".pytest_cache" \) 2>/dev/null | grep -q .; then
        find "${PROJECT_DIR}/backend" -type d \( -name "__pycache__" -o -name ".pytest_cache" \) -exec rm -rf {} + 2>/dev/null || true
        success "Removed Python caches (__pycache__, .pytest_cache)"
        freed=1
    fi

    [ "$freed" -eq 0 ] && { info "No dependency or build artifacts found"; skip; }
}

remove_systemd() {
    echo ""
    echo -e "${BOLD}Step 8: Remove systemd Services (rootless + system, if configured)${NC}"
    local found=0

    # Rootless user units from MIGRATION.md §6 (RHEL8: podman generate systemd / Quadlet)
    local user_unit="${HOME}/.config/systemd/user/container-crucible-py.service"
    if [ -f "$user_unit" ]; then
        systemctl --user stop container-crucible-py.service 2>/dev/null || true
        systemctl --user disable container-crucible-py.service 2>/dev/null || true
        rm -f "$user_unit"
        systemctl --user daemon-reload 2>/dev/null || true
        success "User systemd unit removed (container-crucible-py.service)"
        found=1
    fi
    local quadlet="${HOME}/.config/containers/systemd/crucible-py.container"
    if [ -f "$quadlet" ]; then
        systemctl --user stop crucible-py.service 2>/dev/null || true
        rm -f "$quadlet"
        systemctl --user daemon-reload 2>/dev/null || true
        success "Quadlet unit removed (crucible-py.container)"
        found=1
    fi
    if [ "$found" -eq 1 ]; then
        info "Login lingering was left enabled; disable with: sudo loginctl disable-linger \$USER"
    fi

    # Legacy system-wide unit
    local service_file="/etc/systemd/system/crucible.service"
    if [ -f "$service_file" ]; then
        warn "System-wide systemd service found — requires sudo to remove"
        if confirm "Remove systemd service?"; then
            sudo systemctl stop crucible 2>/dev/null || true
            sudo systemctl disable crucible 2>/dev/null || true
            sudo rm -f "$service_file"
            sudo systemctl daemon-reload
            success "systemd service removed"
        else
            warn "Skipped systemd service removal"
        fi
        found=1
    fi

    [ "$found" -eq 0 ] && { info "No systemd services installed"; skip; }
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

    # Containers (both stacks)
    local name
    for name in ${CONTAINERS}; do
        if $RUNTIME ps -a --format '{{.Names}}' 2>/dev/null | grep "^${name}$" >/dev/null; then
            echo -e "  ${RED}✗${NC} Container: ${name}"
        else
            echo -e "  ${GREEN}✓${NC} Container ${name}: (already removed)"
        fi
    done

    # Images (both stacks)
    for name in ${IMAGES}; do
        if $RUNTIME images --format '{{.Repository}}:{{.Tag}}' 2>/dev/null | grep "${name}:latest$" >/dev/null; then
            echo -e "  ${RED}✗${NC} Image: ${name}:latest"
        else
            echo -e "  ${GREEN}✓${NC} Image ${name}: (already removed)"
        fi
    done

    # Cron
    if crontab -l 2>/dev/null | grep -q 'monitor.sh'; then
        echo -e "  ${RED}✗${NC} Cron job: monitor.sh entry"
    else
        echo -e "  ${GREEN}✓${NC} Cron job: (none found)"
    fi

    # Monitor logs
    local log
    for log in ${MONITOR_LOGS}; do
        if [ -f "${log}" ]; then
            echo -e "  ${RED}✗${NC} Monitor log: ${log}"
        else
            echo -e "  ${GREEN}✓${NC} Monitor log ${log}: (not found)"
        fi
    done

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

    # backups/
    if [ -d "${PROJECT_DIR}/backups" ]; then
        echo -e "  ${RED}✗${NC} Local backups: backups/ ($(du -sh "${PROJECT_DIR}/backups" 2>/dev/null | cut -f1))"
    else
        echo -e "  ${GREEN}✓${NC} Local backups: (not found)"
    fi

    # Python venv
    if [ -d "${PROJECT_DIR}/backend/.venv" ]; then
        echo -e "  ${RED}✗${NC} Python venv: backend/.venv ($(du -sh "${PROJECT_DIR}/backend/.venv" 2>/dev/null | cut -f1))"
    else
        echo -e "  ${GREEN}✓${NC} Python venv: (not found)"
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

    # systemd (system-wide + rootless user units + Quadlet)
    if [ -f "/etc/systemd/system/crucible.service" ]; then
        echo -e "  ${RED}✗${NC} systemd service: crucible.service"
    else
        echo -e "  ${GREEN}✓${NC} systemd service: (not installed)"
    fi
    if [ -f "${HOME}/.config/systemd/user/container-crucible-py.service" ]; then
        echo -e "  ${RED}✗${NC} user systemd unit: container-crucible-py.service"
    else
        echo -e "  ${GREEN}✓${NC} user systemd unit: (not installed)"
    fi
    if [ -f "${HOME}/.config/containers/systemd/crucible-py.container" ]; then
        echo -e "  ${RED}✗${NC} Quadlet unit: crucible-py.container"
    else
        echo -e "  ${GREEN}✓${NC} Quadlet unit: (not installed)"
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
    echo "To redeploy later: ./setup-after-clone-py.sh (Python backend)"
    echo "               or: ./setup-after-clone.sh    (legacy Node backend)"
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
