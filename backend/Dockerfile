# Crucible: Pandora Toolbox Enhancement (v2.0) — Python backend image
#
# Build from the REPO ROOT (the build needs client/ and docs/ too):
#     podman build --format docker -f backend/Dockerfile -t crucible-py .
#     docker build              -f backend/Dockerfile -t crucible-py .
# (or simply ./container-py.sh build, which handles both runtimes)
#
# Multi-stage: stage 1 builds the React client with Node, stage 2 is the
# Python runtime — the final image contains no Node at all.
# Fully-qualified image names so podman never prompts for a registry.

# ── Stage 1: build the React client ────────────────────────────────
FROM docker.io/library/node:18-alpine AS client-build

WORKDIR /build/client
# package files first so npm install layer-caches across code-only changes
COPY client/package.json client/package-lock.json ./
RUN npm install
COPY client/ ./
RUN npm run build

# ── Stage 2: Python runtime ────────────────────────────────────────
FROM docker.io/library/python:3.12-slim

LABEL maintainer="Crucible Team (NIHS)"
LABEL description="Crucible: Pandora Toolbox Enhancement (v2.0) - Python backend (FastAPI)"

WORKDIR /app

# Dependencies first (layer caching): RDKit, pandas etc. install as
# prebuilt manylinux wheels — no compiler needed on linux/amd64 or arm64.
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt

# Application code, docs (for /architecture) and the built client.
# The /app layout mirrors the repo layout (backend/, client/dist, docs/,
# data/), so app/config.py needs no path overrides inside the container.
COPY backend/app backend/app
COPY backend/scripts backend/scripts
COPY docs docs
COPY --from=client-build /build/client/dist client/dist

# data/ is a volume mount at runtime (SQLite db + lowdb JSON for migration)
RUN mkdir -p /app/data

ENV PORT=49160
ENV PYTHONUNBUFFERED=1

EXPOSE 49160

# Health check against the stats endpoint — tries HTTP then HTTPS, so the
# same image is healthy in both modes (see backend/scripts/healthcheck.py).
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD python /app/backend/scripts/healthcheck.py || exit 1

WORKDIR /app/backend
CMD ["python", "-m", "app.main"]
