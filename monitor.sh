#!/bin/bash

# Crucible Health Monitor
# This script checks if the application is responding and restarts if needed

CONTAINER_NAME="${CONTAINER_NAME:-crucible}"
PORT="${PORT:-49160}"

# Runtime detection (same convention as container*.sh)
if [ -n "$CONTAINER_RUNTIME" ]; then RUNTIME="$CONTAINER_RUNTIME"
elif command -v podman >/dev/null 2>&1; then RUNTIME="podman"
elif command -v docker >/dev/null 2>&1; then RUNTIME="docker"
else echo "Neither podman nor docker found"; exit 1; fi
# Default assumes plain-HTTP deployment (./container.sh start). For an SSL
# deployment set API_URL=https://localhost:<port>/api/stats explicitly.
API_URL="${API_URL:-http://localhost:${PORT}/api/stats}"
LOG_FILE="${LOG_FILE:-/tmp/crucible-monitor.log}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

check_health() {
    # Try to access the API
    response=$(curl --noproxy '*' -k -s -w "%{http_code}" -o /dev/null "$API_URL" --max-time 10)
    
    if [ "$response" = "200" ]; then
        return 0  # Healthy
    else
        return 1  # Unhealthy
    fi
}

restart_container() {
    log "⚠️  Container unhealthy, restarting..."
    $RUNTIME restart "$CONTAINER_NAME"
    sleep 5
    
    if check_health; then
        log "✓ Container restarted successfully"
    else
        log "✗ Container restart failed"
    fi
}

# Main monitoring loop
log "Starting health check..."

if ! check_health; then
    log "⚠️  Health check failed!"
    restart_container
else
    log "✓ Application is healthy"
fi
