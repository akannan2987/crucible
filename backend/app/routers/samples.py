"""/api/samples — port of server/src/routes/samples.js."""

import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from ..compat import js_or, now_iso, parse_int_or, sort_created_desc, total_pages
from ..config import SAMPLE_TEMPLATE_PATH
from ..database import get_db
from ..models import Chemical, Sample
from ..schemas import BulkDeleteSamples, LinkChemicals, SampleIn
from ..store import all_docs, clear_all, delete_row, find_row, insert_doc, replace_doc
from ..utils.samples_excel import map_row_to_sample, parse_samples_sheet

router = APIRouter(prefix="/api/samples", tags=["samples"])

_SEARCH_FIELDS = (
    "name",
    "sample_id",
    "identification",
    "project_number",
    "content_type",
    "material_type",
)


@router.get("")
def list_samples(
    page: Optional[str] = None,
    limit: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """GET /api/samples — paginated list with optional search."""
    page_n = parse_int_or(page, 1)
    limit_n = parse_int_or(limit, 50)
    needle = (search or "").lower()
    offset = (page_n - 1) * limit_n

    samples = all_docs(db, Sample)
    if needle:
        samples = [
            s
            for s in samples
            if any(s.get(f) and needle in str(s[f]).lower() for f in _SEARCH_FIELDS)
        ]

    samples = sort_created_desc(samples)
    total = len(samples)
    return {
        "data": samples[offset : offset + limit_n],
        "pagination": {
            "page": page_n,
            "limit": limit_n,
            "total": total,
            "totalPages": total_pages(total, limit_n),
        },
    }


@router.get("/template/download")
def download_template() -> FileResponse:
    """GET /api/samples/template/download — the SLIMS upload template."""
    if not SAMPLE_TEMPLATE_PATH.is_file():
        raise HTTPException(status_code=404, detail="Sample template file not found on server")
    return FileResponse(
        SAMPLE_TEMPLATE_PATH,
        filename="Upload_Sample_Template.xlsx",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


@router.post("", status_code=201)
def add_sample(body: SampleIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/samples — Express spreads the whole body into the record."""
    existing = find_row(db, Sample, "sample_id", body.sample_id)
    if existing:
        raise HTTPException(status_code=400, detail="Sample ID already exists")

    payload = body.merged_dict()
    sample = {
        "id": str(uuid.uuid4()),
        **payload,
        "status": js_or(payload.get("status"), "active"),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    insert_doc(db, Sample, sample)
    return {"message": "Sample added successfully", "sample_id": sample.get("sample_id")}


@router.post("/upload/excel")
async def upload_excel(
    file: Optional[UploadFile] = File(default=None), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """POST /api/samples/upload/excel — SLIMS 'Content record' bulk import."""
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    records, sheet_name, warnings = parse_samples_sheet(await file.read())

    if not records:
        raise HTTPException(
            status_code=400,
            detail=(
                "No sample rows found in the file. Ensure it is the SLIMS sample template "
                "with the machine-key header row (cntn_barCode, cntn_id, …)."
            ),
        )

    inserted = 0
    updated = 0
    skipped = 0
    errors: list[dict[str, Any]] = []

    for raw_row in records:
        try:
            mapped = map_row_to_sample(raw_row)

            if not mapped.get("sample_id"):
                skipped += 1
                errors.append(
                    {
                        "row": raw_row.get("_rowNumber"),
                        "error": "Missing Barcode (sample_id) — row skipped",
                    }
                )
                continue

            existing = find_row(db, Sample, "sample_id", mapped["sample_id"])
            old = existing.doc if existing else None

            sample = {
                "id": old["id"] if old else str(uuid.uuid4()),
                **mapped,
                # Preserve manual chemical links made in the app on re-upload.
                "chemical_ids": (
                    old["chemical_ids"]
                    if old and isinstance(old.get("chemical_ids"), list)
                    else (mapped.get("chemical_ids") or [])
                ),
                "created_at": old["created_at"] if old else now_iso(),
                "updated_at": now_iso(),
            }

            if existing:
                replace_doc(db, existing, sample)
                updated += 1
            else:
                insert_doc(db, Sample, sample)
                inserted += 1
        except Exception as err:
            errors.append({"row": raw_row.get("_rowNumber"), "error": str(err)})

    message = (
        f"Successfully processed {inserted + updated} samples "
        f"({inserted} new, {updated} updated)"
    )
    if skipped:
        message += f", {skipped} skipped"

    response: dict[str, Any] = {
        "message": message,
        "inserted": inserted,
        "updated": updated,
        "total": inserted + updated,
        "summary": {
            "rowsInFile": len(records),
            "successfullyProcessed": inserted + updated,
            "skipped": skipped,
            "parseWarnings": warnings,
            "sheet": sheet_name,
        },
    }
    if errors:
        response["errors"] = errors
    return response


@router.put("/{sample_id}/chemicals")
def link_chemicals(
    sample_id: str, body: LinkChemicals, db: Session = Depends(get_db)
) -> dict[str, Any]:
    """PUT /api/samples/:id/chemicals — set the full linked-chemicals list."""
    row = find_row(db, Sample, "sample_id", sample_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sample not found")

    ids = body.chemical_ids
    if not isinstance(ids, list):
        raise HTTPException(status_code=400, detail="chemical_ids must be an array")

    # De-duplicate (order-preserving) and drop blanks, like the JS Set trick.
    ids = list(dict.fromkeys(x for x in (str(i).strip() for i in ids) if x))

    known = {c.get("chemical_id") for c in all_docs(db, Chemical)}
    unknown = [i for i in ids if i not in known]

    replace_doc(db, row, {**row.doc, "chemical_ids": ids, "updated_at": now_iso()})

    response: dict[str, Any] = {
        "message": f"Linked {len(ids)} chemical(s) to sample {sample_id}",
        "sample_id": sample_id,
        "chemical_ids": ids,
    }
    if unknown:  # Express omits the key when empty
        response["unknownChemicalIds"] = unknown
    return response


@router.post("/bulk/delete")
def bulk_delete(body: BulkDeleteSamples, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/samples/bulk/delete."""
    ids = body.sample_ids
    if not ids or not isinstance(ids, list) or len(ids) == 0:
        raise HTTPException(status_code=400, detail="No sample IDs provided")

    deleted = 0
    for sid in ids:
        row = find_row(db, Sample, "sample_id", sid)
        if row:
            delete_row(db, row)
            deleted += 1

    return {
        "message": f"Successfully deleted {deleted} samples",
        "deleted": deleted,
        "requested": len(ids),
    }


@router.delete("/all/clear")
def clear_samples(db: Session = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/samples/all/clear."""
    count = clear_all(db, Sample)
    return {"message": f"Successfully deleted all {count} samples", "deleted": count}


@router.get("/{sample_id}")
def get_sample(sample_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """GET /api/samples/:id."""
    row = find_row(db, Sample, "sample_id", sample_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sample not found")
    return row.doc


@router.put("/{sample_id}")
def update_sample(
    sample_id: str,
    payload: dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """PUT /api/samples/:id — merge arbitrary fields (free-form, like Express)."""
    row = find_row(db, Sample, "sample_id", sample_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sample not found")
    replace_doc(db, row, {**row.doc, **payload, "updated_at": now_iso()})
    return {"message": "Sample updated successfully"}


@router.delete("/{sample_id}")
def delete_sample(sample_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/samples/:id."""
    row = find_row(db, Sample, "sample_id", sample_id)
    if not row:
        raise HTTPException(status_code=404, detail="Sample not found")
    delete_row(db, row)
    return {"message": "Sample deleted successfully"}
