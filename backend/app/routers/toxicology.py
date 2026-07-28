"""/api/toxicology — port of server/src/routes/toxicology.js."""

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..compat import js_or, now_iso, parse_int_or, sort_created_desc, total_pages
from ..database import get_db
from ..models import Chemical, Toxicology
from ..schemas import ToxicologyIn
from ..store import all_docs, delete_row, find_row, insert_doc, replace_doc
from ..utils.excel import sheet_rows_as_dicts

router = APIRouter(prefix="/api/toxicology", tags=["toxicology"])


@router.get("")
def list_toxicology(
    page: Optional[str] = None,
    limit: Optional[str] = None,
    search: Optional[str] = None,
    chemical_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """GET /api/toxicology — paginated list, filterable, enriched with chemical_name."""
    page_n = parse_int_or(page, 1)
    limit_n = parse_int_or(limit, 50)
    needle = (search or "").lower()
    offset = (page_n - 1) * limit_n

    data = all_docs(db, Toxicology)

    if chemical_id:
        data = [t for t in data if t.get("chemical_id") == chemical_id]

    if needle:
        data = [
            t
            for t in data
            if (t.get("study_type") and needle in str(t["study_type"]).lower())
            or (t.get("chemical_id") and needle in str(t["chemical_id"]).lower())
            or (t.get("endpoint") and needle in str(t["endpoint"]).lower())
            or (t.get("species") and needle in str(t["species"]).lower())
        ]

    data = sort_created_desc(data)
    total = len(data)
    page_items = data[offset : offset + limit_n]

    names = {c.get("chemical_id"): c.get("name") for c in all_docs(db, Chemical)}
    enriched = [
        {**t, "chemical_name": names.get(t.get("chemical_id"), "Unknown") or "Unknown"}
        for t in page_items
    ]

    return {
        "data": enriched,
        "pagination": {
            "page": page_n,
            "limit": limit_n,
            "total": total,
            "totalPages": total_pages(total, limit_n),
        },
    }


@router.get("/chemical/{chemical_id}")
def toxicology_by_chemical(chemical_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/toxicology/chemical/:chemicalId — raw records, no enrichment."""
    return [t for t in all_docs(db, Toxicology) if t.get("chemical_id") == chemical_id]


@router.post("", status_code=201)
def add_toxicology(body: ToxicologyIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/toxicology — must reference an existing chemical."""
    chemical = find_row(db, Chemical, "chemical_id", body.chemical_id)
    if not chemical:
        raise HTTPException(
            status_code=400,
            detail="Chemical not found. Toxicology data must be linked to an existing chemical.",
        )

    record = {
        "id": str(uuid.uuid4()),
        "chemical_id": body.chemical_id,
        "study_type": body.study_type,
        "species": js_or(body.species, None),
        "strain": js_or(body.strain, None),
        "sex": js_or(body.sex, None),
        "route_of_administration": js_or(body.route_of_administration, None),
        "duration": js_or(body.duration, None),
        "duration_unit": js_or(body.duration_unit, None),
        "dose": js_or(body.dose, None),
        "dose_unit": js_or(body.dose_unit, None),
        "endpoint": js_or(body.endpoint, None),
        "endpoint_value": js_or(body.endpoint_value, None),
        "endpoint_unit": js_or(body.endpoint_unit, None),
        "noael": js_or(body.noael, None),
        "loael": js_or(body.loael, None),
        "ld50": js_or(body.ld50, None),
        "study_reference": js_or(body.study_reference, None),
        "study_date": js_or(body.study_date, None),
        "source": js_or(body.source, None),
        "notes": js_or(body.notes, None),
        "metadata": js_or(body.metadata, None),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    insert_doc(db, Toxicology, record)
    return {"message": "Toxicology data added successfully", "id": record["id"]}


@router.post("/upload/excel")
async def upload_excel(
    file: Optional[UploadFile] = File(default=None), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """POST /api/toxicology/upload/excel."""
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    data = sheet_rows_as_dicts(await file.read())

    inserted = 0
    errors: list[dict[str, Any]] = []
    valid_ids = {c.get("chemical_id") for c in all_docs(db, Chemical)}

    def col(row: dict[str, str], *names: str) -> Optional[str]:
        for n in names:
            v = row.get(n)
            if v not in (None, ""):
                return v
        return None

    for row in data:
        try:
            chemical_id = col(row, "chemical_id", "Chemical_ID")
            if not chemical_id or chemical_id not in valid_ids:
                errors.append({"row": col(row, "study_type", "Study_Type"), "error": "Chemical not found"})
                continue

            record = {
                "id": str(uuid.uuid4()),
                "chemical_id": chemical_id,
                "study_type": col(row, "study_type", "Study_Type") or "Unknown Study",
                "species": col(row, "species", "Species"),
                "strain": col(row, "strain", "Strain"),
                "sex": col(row, "sex", "Sex"),
                "route_of_administration": col(row, "route_of_administration", "Route_Of_Administration"),
                "duration": col(row, "duration", "Duration"),
                "duration_unit": col(row, "duration_unit", "Duration_Unit"),
                "dose": col(row, "dose", "Dose"),
                "dose_unit": col(row, "dose_unit", "Dose_Unit"),
                "endpoint": col(row, "endpoint", "Endpoint"),
                "endpoint_value": col(row, "endpoint_value", "Endpoint_Value"),
                "endpoint_unit": col(row, "endpoint_unit", "Endpoint_Unit"),
                "noael": col(row, "noael", "NOAEL"),
                "loael": col(row, "loael", "LOAEL"),
                "ld50": col(row, "ld50", "LD50"),
                "study_reference": col(row, "study_reference", "Study_Reference"),
                "study_date": col(row, "study_date", "Study_Date"),
                "source": col(row, "source", "Source"),
                "notes": col(row, "notes", "Notes"),
                "metadata": row,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            insert_doc(db, Toxicology, record)
            inserted += 1
        except Exception as err:
            errors.append({"row": col(row, "study_type", "Study_Type"), "error": str(err)})

    response: dict[str, Any] = {
        "message": f"Successfully uploaded {inserted} toxicology records",
        "inserted": inserted,
    }
    if errors:
        response["errors"] = errors
    return response


@router.get("/{record_id}")
def get_toxicology(record_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """GET /api/toxicology/:id — one record, enriched with chemical_name."""
    row = find_row(db, Toxicology, "id", record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Toxicology data not found")
    chemical = find_row(db, Chemical, "chemical_id", row.doc.get("chemical_id"))
    name = chemical.doc.get("name") if chemical else "Unknown"
    return {**row.doc, "chemical_name": name or "Unknown"}


@router.put("/{record_id}")
def update_toxicology(
    record_id: str,
    payload: dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """PUT /api/toxicology/:id — merge arbitrary fields (free-form, like Express)."""
    row = find_row(db, Toxicology, "id", record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Toxicology data not found")
    replace_doc(db, row, {**row.doc, **payload, "updated_at": now_iso()})
    return {"message": "Toxicology data updated successfully"}


@router.delete("/{record_id}")
def delete_toxicology(record_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/toxicology/:id."""
    row = find_row(db, Toxicology, "id", record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Toxicology data not found")
    delete_row(db, row)
    return {"message": "Toxicology data deleted successfully"}
