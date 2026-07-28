#!/usr/bin/env python3
"""One-shot migration: lowdb JSON (data/pandora.json) → SQL database.

Usage (from the backend/ directory, inside the virtualenv):

    python scripts/migrate_from_lowdb.py                 # default paths
    python scripts/migrate_from_lowdb.py --source /path/to/pandora.json
    DATABASE_URL=sqlite:////tmp/test.db python scripts/migrate_from_lowdb.py

Properties:
  * **Idempotent** — records are upserted by their business key
    (chemicals.chemical_id, samples.sample_id, screening/toxicology.id),
    so running it twice changes nothing on the second run.
  * **Lossless** — each record is stored verbatim in the `doc` JSON column
    (see backend/app/models.py for why), so no field is dropped.
  * Prints a per-collection summary of inserted/updated/total counts.
"""

import argparse
import json
import sys
from pathlib import Path

# Allow running as `python scripts/migrate_from_lowdb.py` from backend/.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.config import LOWDB_PATH  # noqa: E402
from app.database import SessionLocal, init_db  # noqa: E402
from app.models import Chemical, Sample, Screening, Toxicology  # noqa: E402
from app.store import find_row, insert_doc, replace_doc  # noqa: E402

# collection name in pandora.json → (ORM model, business-key field)
COLLECTIONS = {
    "chemicals": (Chemical, "chemical_id"),
    "samples": (Sample, "sample_id"),
    "screening": (Screening, "id"),
    "toxicology": (Toxicology, "id"),
}


def migrate(source: Path) -> int:
    """Import all collections; returns a process exit code."""
    if not source.is_file():
        print(f"ERROR: lowdb file not found: {source}")
        return 1

    with open(source, encoding="utf-8") as fh:
        data = json.load(fh)

    init_db()
    db = SessionLocal()

    print(f"Migrating from {source}")
    print(f"{'collection':<12} {'in file':>8} {'inserted':>9} {'updated':>8} {'in db':>7}")
    print("-" * 50)

    try:
        for name, (model, key_field) in COLLECTIONS.items():
            records = data.get(name) or []
            inserted = 0
            updated = 0

            for record in records:
                if not isinstance(record, dict):
                    continue
                # Ensure every record has an id (primary key) — lowdb
                # records always did, but be defensive.
                if not record.get("id"):
                    import uuid

                    record = {**record, "id": str(uuid.uuid4())}

                existing = find_row(db, model, key_field, record.get(key_field))
                if existing:
                    # Upsert: replace the stored doc with the file's version
                    # only if it differs (keeps re-runs truly no-op).
                    if existing.doc != record:
                        replace_doc(db, existing, record)
                        updated += 1
                else:
                    insert_doc(db, model, record)
                    inserted += 1

            total_in_db = len(list(db.scalars(select(model))))
            print(f"{name:<12} {len(records):>8} {inserted:>9} {updated:>8} {total_in_db:>7}")
    finally:
        db.close()

    print("-" * 50)
    print("Migration complete. Re-running is safe (idempotent upsert).")
    return 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        type=Path,
        default=LOWDB_PATH,
        help=f"Path to the lowdb JSON file (default: {LOWDB_PATH})",
    )
    args = parser.parse_args()
    raise SystemExit(migrate(args.source))


if __name__ == "__main__":
    main()
