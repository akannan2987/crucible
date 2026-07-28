"""Small data-access layer shared by all routers.

Wraps the hybrid document pattern (see models.py) with lowdb-like verbs so
the routers read almost like the Express routes they replace:

    Express  db.get('chemicals').value()          → all_docs(db, Chemical)
    Express  .find({chemical_id: id}).value()     → find_row(db, Chemical, 'chemical_id', id)
    Express  .push(doc).write()                   → insert_doc(db, Chemical, doc)
    Express  .assign(doc).write()                 → replace_doc(row, doc)
"""

from typing import Any, Optional, Type

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .database import Base

# The column each model uses as its business key, mirrored from doc on write.
_KEY_FIELD = {
    "chemicals": "chemical_id",
    "samples": "sample_id",
    "screening": "chemical_id",
    "toxicology": "chemical_id",
}


def all_rows(db: Session, model: Type[Base]) -> list:
    """All rows in lowdb array order (insertion order via `seq`)."""
    return list(db.scalars(select(model).order_by(model.seq)))


def all_docs(db: Session, model: Type[Base]) -> list[dict[str, Any]]:
    """All record documents in insertion order — the lowdb `.value()` equivalent."""
    return [row.doc for row in all_rows(db, model)]


def find_row(db: Session, model: Type[Base], field: str, value: Any):
    """First row whose extracted column `field` equals `value` (or None)."""
    return db.scalars(select(model).where(getattr(model, field) == value)).first()


def _next_seq(db: Session, model: Type[Base]) -> int:
    current = db.scalar(select(func.max(model.seq)))
    return (current or 0) + 1


def _sync_columns(row, doc: dict[str, Any]) -> None:
    """Copy the indexed lookup values out of the document into real columns."""
    key = _KEY_FIELD[row.__tablename__]
    setattr(row, key, doc.get(key))
    row.created_at = doc.get("created_at")


def insert_doc(db: Session, model: Type[Base], doc: dict[str, Any]) -> None:
    """Insert a new record document (lowdb `.push(...).write()`)."""
    row = model(id=doc["id"], seq=_next_seq(db, model), doc=doc)
    _sync_columns(row, doc)
    db.add(row)
    db.commit()


def replace_doc(db: Session, row, doc: dict[str, Any]) -> None:
    """Replace a row's document (lowdb `.assign(...).write()`).

    A NEW dict must be assigned (not mutated in place) so SQLAlchemy's
    change tracking notices the JSON column changed.
    """
    row.doc = doc
    _sync_columns(row, doc)
    db.commit()


def delete_row(db: Session, row) -> None:
    db.delete(row)
    db.commit()


def clear_all(db: Session, model: Type[Base]) -> int:
    """Delete every row; returns how many were deleted (lowdb `.set(col, [])`)."""
    rows = all_rows(db, model)
    for row in rows:
        db.delete(row)
    db.commit()
    return len(rows)
