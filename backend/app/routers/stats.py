"""/api/stats — port of server/src/routes/stats.js (dashboard endpoints)."""

from typing import Any, Optional

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..compat import now_iso, parse_int_or, sort_created_desc, to_fixed_1
from ..config import CHEMICALS_MAX, SAMPLES_MAX
from ..database import get_db
from ..models import Chemical, Sample, Screening, Toxicology
from ..store import all_docs

router = APIRouter(prefix="/api/stats", tags=["stats"])


@router.get("")
def get_stats(db: Session = Depends(get_db)) -> dict[str, Any]:
    """GET /api/stats — dashboard statistics (three formats for back-compat)."""
    chemicals_count = len(all_docs(db, Chemical))
    samples_count = len(all_docs(db, Sample))
    screening_count = len(all_docs(db, Screening))
    toxicology_count = len(all_docs(db, Toxicology))

    return {
        # Original format. `max` is a soft dashboard-gauge target, NOT a cap.
        "chemicals": {"total": chemicals_count, "max": CHEMICALS_MAX},
        "samples": {"total": samples_count, "max": SAMPLES_MAX},
        "screening": {"total": screening_count},
        "toxicology": {"total": toxicology_count},
        # Counts format (Dashboard cards)
        "counts": {
            "chemicals": chemicals_count,
            "samples": samples_count,
            "screening": screening_count,
            "toxicology": toxicology_count,
        },
        # Capacities format (Dashboard capacity overview) — percentage is a
        # STRING, exactly like JS `Number.toFixed(1)`.
        "capacities": {
            "chemicals": {
                "current": chemicals_count,
                "max": CHEMICALS_MAX,
                "percentage": to_fixed_1(chemicals_count / CHEMICALS_MAX * 100),
            },
            "samples": {
                "current": samples_count,
                "max": SAMPLES_MAX,
                "percentage": to_fixed_1(samples_count / SAMPLES_MAX * 100),
            },
        },
        "lastUpdated": now_iso(),
    }


@router.get("/recent")
def recent_activity(limit: Optional[str] = None, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/stats/recent — merged newest-first activity feed."""
    limit_n = parse_int_or(limit, 10)

    chemicals = sort_created_desc(all_docs(db, Chemical))[:limit_n]
    samples = sort_created_desc(all_docs(db, Sample))[:limit_n]
    screening = sort_created_desc(all_docs(db, Screening))[:limit_n]
    toxicology = sort_created_desc(all_docs(db, Toxicology))[:limit_n]

    merged = (
        [
            {"type": "chemical", "id": c.get("chemical_id"), "name": c.get("name"),
             "created_at": c.get("created_at")}
            for c in chemicals
        ]
        + [
            {"type": "sample", "id": s.get("sample_id"), "name": s.get("name"),
             "created_at": s.get("created_at")}
            for s in samples
        ]
        + [
            {"type": "screening", "id": s.get("id"), "name": s.get("assay_name"),
             "chemical_id": s.get("chemical_id"), "created_at": s.get("created_at")}
            for s in screening
        ]
        + [
            {"type": "toxicology", "id": t.get("id"), "name": t.get("study_type"),
             "chemical_id": t.get("chemical_id"), "created_at": t.get("created_at")}
            for t in toxicology
        ]
    )
    return sort_created_desc(merged)[:limit_n]


@router.get("/chemicals-summary")
def chemicals_summary(limit: Optional[str] = None, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/stats/chemicals-summary — chemicals with related-data counts.

    NOTE: like Express, this takes the FIRST `limit` chemicals in insertion
    order (no sort) — preserved via the `seq` column.
    """
    limit_n = parse_int_or(limit, 20)

    chemicals = all_docs(db, Chemical)[:limit_n]
    screening = all_docs(db, Screening)
    toxicology = all_docs(db, Toxicology)

    return [
        {
            "chemical_id": c.get("chemical_id"),
            "name": c.get("name"),
            "cas_number": c.get("cas_number"),
            "molecular_formula": c.get("molecular_formula"),
            "screening_count": sum(
                1 for s in screening if s.get("chemical_id") == c.get("chemical_id")
            ),
            "toxicology_count": sum(
                1 for t in toxicology if t.get("chemical_id") == c.get("chemical_id")
            ),
            "created_at": c.get("created_at"),
        }
        for c in chemicals
    ]


@router.get("/sample-types")
def sample_types(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/stats/sample-types — distribution by sample_type."""
    counts: dict[str, int] = {}
    for s in all_docs(db, Sample):
        t = s.get("sample_type") or "Unknown"
        counts[t] = counts.get(t, 0) + 1
    return [{"type": t, "count": n} for t, n in counts.items()]


@router.get("/assay-types")
def assay_types(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/stats/assay-types — distribution by assay type/name."""
    counts: dict[str, int] = {}
    for s in all_docs(db, Screening):
        a = s.get("assay_type") or s.get("assay_name") or "Unknown"
        counts[a] = counts.get(a, 0) + 1
    return [{"assay": a, "count": n} for a, n in counts.items()]


@router.get("/study-types")
def study_types(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/stats/study-types — distribution by toxicology study type."""
    counts: dict[str, int] = {}
    for t in all_docs(db, Toxicology):
        s = t.get("study_type") or "Unknown"
        counts[s] = counts.get(s, 0) + 1
    return [{"study": s, "count": n} for s, n in counts.items()]
