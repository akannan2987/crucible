"""Database setup — SQLAlchemy 2.0 engine, session factory and FastAPI dependency.

Concepts used here (first appearance in this codebase):

* **Engine** — the connection pool to the database. Built once from
  DATABASE_URL, so switching SQLite → PostgreSQL is a config change only.
* **Session** — a unit-of-work object. Each HTTP request gets its own
  session via the `get_db` dependency and commits/rolls back at the end.
* **Declarative Base** — the parent class all ORM models inherit from;
  it collects table metadata so `create_all` can create the schema.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import DATABASE_URL


class Base(DeclarativeBase):
    """Declarative base class for all ORM models."""


# check_same_thread=False is SQLite-specific: FastAPI serves each request in
# a worker thread, and SQLite connections by default refuse to hop threads.
# Harmless for other databases (the option is simply not passed).
_connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=_connect_args)

# autoflush=False keeps behaviour predictable for an intermediate reader:
# nothing hits the database until we explicitly commit().
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def init_db() -> None:
    """Create all tables if they do not exist yet (no-op afterwards)."""
    # Imported here to avoid a circular import (models import Base from us).
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that yields a per-request database session.

    FastAPI's dependency injection calls this generator for every request:
    the code before `yield` runs on request start, the code after runs when
    the response is done (like a try/finally around the request).
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
