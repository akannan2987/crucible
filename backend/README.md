# Crucible Python Backend (FastAPI)

Strangler-fig replacement for the Express server in `server/`. Implements the
**identical API contract** (see `../API.md`) so the React client works
unchanged. The Express server stays in place until the cutover.

## Stack

| Piece | Choice | Where to see it |
|---|---|---|
| Web framework | FastAPI | `app/main.py`, `app/routers/` |
| ASGI server | uvicorn | `app/main.py` (bottom) |
| ORM | SQLAlchemy 2.0 | `app/models.py`, `app/database.py` |
| Validation | Pydantic v2 | `app/schemas.py` |
| Database | SQLite (PostgreSQL-ready) | `app/config.py` (`DATABASE_URL`) |
| Excel | openpyxl (+ pandas available) | `app/utils/excel.py`, `app/utils/samples_excel.py` |
| Structures | RDKit | `app/utils/sdf.py` |
| Tests | pytest | `tests/` |

## Quickstart (macOS)

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Run the test suite (parity tests against the Express contract)
.venv/bin/pytest

# Migrate existing data from lowdb (idempotent — safe to re-run)
.venv/bin/python scripts/migrate_from_lowdb.py

# Start the API (dev, with auto-reload, on a side port)
.venv/bin/uvicorn app.main:app --reload --port 8000

# Start the API (production style: 0.0.0.0:$PORT, default 49160)
.venv/bin/python -m app.main
```

Interactive API docs (FastAPI generates them from the code): http://localhost:8000/docs

## Pointing the React dev server at either backend

`client/vite.config.js` proxies `/api` to `http://localhost:49160` by default.
Override per-run with an env var — no file edits needed:

```bash
# against the Node backend (default)
cd client && npm run dev

# against the Python backend running on 8000
cd client && VITE_API_PROXY_TARGET=http://localhost:8000 npm run dev
```

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `49160` | HTTP port read by the app itself (`python -m app.main`). Note: the container scripts pass this in for you and ignore a shell-inherited `PORT` — use `CRUCIBLE_PORT=<n>` with `container-py.sh` |
| `DATABASE_URL` | `sqlite:///<repo>/data/crucible.db` | SQLAlchemy connection string. PostgreSQL later: `postgresql+psycopg://user:pass@host/db` (add `psycopg[binary]` to requirements) |
| `CLIENT_DIST` | `<repo>/client/dist` | Built React app served as static files |
| `LOWDB_PATH` | `<repo>/data/pandora.json` | Source file for the migration script |

## Live parity diff (optional but recommended before cutover)

Runs the same requests against BOTH backends and diffs the responses:

```bash
# terminal 1
cd server && npm start                       # Express on 49160
# terminal 2
cd backend && PORT=8000 .venv/bin/python -m app.main
# terminal 3
cd backend && EXPRESS_URL=http://localhost:49160 FASTAPI_URL=http://localhost:8000 \
    .venv/bin/pytest tests/test_parity_live.py -v
```

## Layout

```
backend/
├── app/
│   ├── main.py          # app factory, static/SPA serving, error shape parity
│   ├── config.py        # env-var configuration (PORT, DATABASE_URL, paths)
│   ├── compat.py        # helpers replicating JS semantics (||, parseInt, toFixed)
│   ├── database.py      # engine, sessions, get_db dependency
│   ├── models.py        # SQLAlchemy models (hybrid document pattern — see docstring)
│   ├── schemas.py       # Pydantic request models (lenient, like Express)
│   ├── store.py         # lowdb-like data-access verbs over SQLAlchemy
│   ├── routers/         # one file per Express route file
│   └── utils/           # SDF (RDKit), SLIMS Excel, generic Excel/CSV
├── scripts/
│   └── migrate_from_lowdb.py
└── tests/               # parity tests (+ optional live dual-backend diff)
```
