"""/api/screening — port of server/src/routes/screening.js."""

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..compat import js_or, now_iso, parse_int_or, sort_created_desc, total_pages
from ..database import get_db
from ..models import Chemical, Screening
from ..schemas import ScreeningIn
from ..store import all_docs, delete_row, find_row, insert_doc, replace_doc
from ..utils.excel import sheet_rows_as_dicts

router = APIRouter(prefix="/api/screening", tags=["screening"])


def _chemical_name_map(db: Session) -> dict[Optional[str], str]:
    return {c.get("chemical_id"): c.get("name") for c in all_docs(db, Chemical)}


@router.get("")
def list_screening(
    page: Optional[str] = None,
    limit: Optional[str] = None,
    search: Optional[str] = None,
    chemical_id: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """GET /api/screening — paginated list, filterable, enriched with chemical_name."""
    page_n = parse_int_or(page, 1)
    limit_n = parse_int_or(limit, 50)
    needle = (search or "").lower()
    offset = (page_n - 1) * limit_n

    data = all_docs(db, Screening)

    if chemical_id:
        data = [s for s in data if s.get("chemical_id") == chemical_id]

    if needle:
        data = [
            s
            for s in data
            if (s.get("assay_name") and needle in str(s["assay_name"]).lower())
            or (s.get("chemical_id") and needle in str(s["chemical_id"]).lower())
            or (s.get("result") and needle in str(s["result"]).lower())
        ]

    data = sort_created_desc(data)
    total = len(data)
    page_items = data[offset : offset + limit_n]

    names = _chemical_name_map(db)
    enriched = [
        {**s, "chemical_name": names.get(s.get("chemical_id"), "Unknown") or "Unknown"}
        for s in page_items
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
def screening_by_chemical(chemical_id: str, db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/screening/chemical/:chemicalId — raw records, no enrichment."""
    return [s for s in all_docs(db, Screening) if s.get("chemical_id") == chemical_id]


@router.post("", status_code=201)
def add_screening(body: ScreeningIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/screening — must reference an existing chemical."""
    chemical = find_row(db, Chemical, "chemical_id", body.chemical_id)
    if not chemical:
        raise HTTPException(
            status_code=400,
            detail="Chemical not found. Screening data must be linked to an existing chemical.",
        )

    record = {
        "id": str(uuid.uuid4()),
        "chemical_id": body.chemical_id,
        "assay_name": body.assay_name,
        "assay_type": js_or(body.assay_type, None),
        "target": js_or(body.target, None),
        "result": body.result,
        "result_value": js_or(body.result_value, None),
        "result_unit": js_or(body.result_unit, None),
        "concentration": js_or(body.concentration, None),
        "concentration_unit": js_or(body.concentration_unit, None),
        "timepoint": js_or(body.timepoint, None),
        "replicate": js_or(body.replicate, None),
        "plate_id": js_or(body.plate_id, None),
        "well_position": js_or(body.well_position, None),
        "experiment_date": js_or(body.experiment_date, None),
        "operator": js_or(body.operator, None),
        "notes": js_or(body.notes, None),
        "metadata": js_or(body.metadata, None),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    insert_doc(db, Screening, record)
    return {"message": "Screening data added successfully", "id": record["id"]}


@router.post("/upload/excel")
async def upload_excel(
    file: Optional[UploadFile] = File(default=None), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """POST /api/screening/upload/excel."""
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
                errors.append({"row": col(row, "assay_name", "Assay_Name"), "error": "Chemical not found"})
                continue

            record = {
                "id": str(uuid.uuid4()),
                "chemical_id": chemical_id,
                "assay_name": col(row, "assay_name", "Assay_Name") or "Unknown Assay",
                "assay_type": col(row, "assay_type", "Assay_Type"),
                "target": col(row, "target", "Target"),
                "result": col(row, "result", "Result"),
                "result_value": col(row, "result_value", "Result_Value"),
                "result_unit": col(row, "result_unit", "Result_Unit"),
                "concentration": col(row, "concentration", "Concentration"),
                "concentration_unit": col(row, "concentration_unit", "Concentration_Unit"),
                "timepoint": col(row, "timepoint", "Timepoint"),
                "replicate": col(row, "replicate", "Replicate"),
                "plate_id": col(row, "plate_id", "Plate_ID"),
                "well_position": col(row, "well_position", "Well_Position"),
                "experiment_date": col(row, "experiment_date", "Experiment_Date"),
                "operator": col(row, "operator", "Operator"),
                "notes": col(row, "notes", "Notes"),
                "metadata": row,
                "created_at": now_iso(),
                "updated_at": now_iso(),
            }
            insert_doc(db, Screening, record)
            inserted += 1
        except Exception as err:
            errors.append({"row": col(row, "assay_name", "Assay_Name"), "error": str(err)})

    response: dict[str, Any] = {
        "message": f"Successfully uploaded {inserted} screening records",
        "inserted": inserted,
    }
    if errors:
        response["errors"] = errors
    return response


@router.get("/{record_id}")
def get_screening(record_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """GET /api/screening/:id — one record, enriched with chemical_name."""
    row = find_row(db, Screening, "id", record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening data not found")
    chemical = find_row(db, Chemical, "chemical_id", row.doc.get("chemical_id"))
    name = chemical.doc.get("name") if chemical else "Unknown"
    return {**row.doc, "chemical_name": name or "Unknown"}


@router.put("/{record_id}")
def update_screening(
    record_id: str,
    payload: dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """PUT /api/screening/:id — merge arbitrary fields (free-form, like Express)."""
    row = find_row(db, Screening, "id", record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening data not found")
    replace_doc(db, row, {**row.doc, **payload, "updated_at": now_iso()})
    return {"message": "Screening data updated successfully"}


@router.delete("/{record_id}")
def delete_screening(record_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/screening/:id."""
    row = find_row(db, Screening, "id", record_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening data not found")
    delete_row(db, row)
    return {"message": "Screening data deleted successfully"}
