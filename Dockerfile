# Crucible: Pandora Toolbox Enhancement (v2.0) - Container Image
FROM node:18-alpine

LABEL maintainer="Crucible Team (NIHS)"
LABEL description="Crucible: Pandora Toolbox Enhancement (v2.0) - Chemical & Sample Management System"

# Note: openssl and ca-certificates are already included in node:18-alpine

# Set working directory
WORKDIR /app

# Copy all application files first
COPY . .

# Install server dependencies
WORKDIR /app/server
RUN npm install --omit=dev

# Install nodemon globally so './container.sh start-dev' can live-reload
# the server. Pure-JS so safe on alpine. Adds ~3 MB to the image.
RUN npm install -g nodemon@3

# Install client dependencies and build
WORKDIR /app/client
RUN npm install && npm run build

# Set working directory to server
WORKDIR /app/server

# Create data and certs directories
RUN mkdir -p /app/server/data /app/certs

# Set environment variables
ENV NODE_ENV=production
ENV PORT=49160
ENV USE_HTTPS=false
ENV SSL_CERT_PATH=/app/certs/server.crt
ENV SSL_KEY_PATH=/app/certs/server.key
ENV CA_BUNDLE_PATH=/etc/ssl/certs/ca-certificates.crt

# Expose application port
EXPOSE 49160

# Health check — shell form so ${PORT} is expanded at runtime; stays
# correct even if the container is started with a different -e PORT=...
# 127.0.0.1 (not localhost): in-container localhost resolves to ::1 first,
# but the server binds 0.0.0.0 (IPv4), so busybox wget would get refused.
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT}/api/stats || \
      wget --no-verbose --tries=1 --spider --no-check-certificate https://127.0.0.1:${PORT}/api/stats || exit 1

# Start the server
CMD ["node", "src/index.js"]
