#!/bin/bash

# Pandora Toolbox Health Monitor
# This script checks if the application is responding and restarts if needed

CONTAINER_NAME="pandora-toolbox"
API_URL="https://localhost:5942/api/stats"
LOG_FILE="/tmp/pandora-monitor.log"

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
    podman restart "$CONTAINER_NAME"
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
