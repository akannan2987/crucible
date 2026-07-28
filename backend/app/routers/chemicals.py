"""/api/chemicals — port of server/src/routes/chemicals.js.

Every endpoint mirrors its Express counterpart: same paths, same response
shapes, same messages, same status codes — including the quirks (the
`errors` key is omitted when empty; `|| null` coerces '' and 0 to null).
"""

import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..compat import (
    js_or,
    now_iso,
    parse_float_or_none,
    parse_int_or,
    sort_created_desc,
    total_pages,
)
from ..database import get_db
from ..models import Chemical
from ..schemas import BulkDeleteChemicals, BulkUpdateChemicals, ChemicalIn
from ..store import all_docs, clear_all, delete_row, find_row, insert_doc, replace_doc
from ..utils.excel import parse_csv_rows, sheet_rows_as_dicts
from ..utils.sdf import map_molecule_to_chemical, parse_sdf

router = APIRouter(prefix="/api/chemicals", tags=["chemicals"])


@router.get("")
def list_chemicals(
    page: Optional[str] = None,
    limit: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """GET /api/chemicals — paginated list with optional search."""
    page_n = parse_int_or(page, 1)
    limit_n = parse_int_or(limit, 50)
    needle = (search or "").lower()
    offset = (page_n - 1) * limit_n

    chemicals = all_docs(db, Chemical)

    if needle:
        chemicals = [
            c
            for c in chemicals
            if (c.get("name") and needle in str(c["name"]).lower())
            or (c.get("chemical_id") and needle in str(c["chemical_id"]).lower())
            or (c.get("cas_number") and needle in str(c["cas_number"]).lower())
        ]

    chemicals = sort_created_desc(chemicals)
    total = len(chemicals)
    page_items = chemicals[offset : offset + limit_n]

    return {
        "data": page_items,
        "pagination": {
            "page": page_n,
            "limit": limit_n,
            "total": total,
            "totalPages": total_pages(total, limit_n),
        },
    }


@router.get("/list/dropdown")
def chemicals_dropdown(db: Session = Depends(get_db)) -> list[dict[str, Any]]:
    """GET /api/chemicals/list/dropdown — {chemical_id, name} sorted by name."""
    chemicals = all_docs(db, Chemical)
    items = [{"chemical_id": c.get("chemical_id"), "name": c.get("name")} for c in chemicals]
    # Express uses localeCompare (case-insensitive-ish); lower() is the
    # closest deterministic equivalent.
    items.sort(key=lambda x: str(x["name"] or "").lower())
    return items


@router.post("", status_code=201)
def add_chemical(body: ChemicalIn, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/chemicals — add one chemical (400 on duplicate chemical_id)."""
    existing = find_row(db, Chemical, "chemical_id", body.chemical_id)
    if existing:
        raise HTTPException(status_code=400, detail="Chemical ID already exists")

    chemical = {
        "id": str(uuid.uuid4()),
        "chemical_id": body.chemical_id,
        "nestle_id": js_or(body.nestle_id, None),
        "name": body.name,
        "cas_number": js_or(body.cas_number, None),
        "molecular_formula": js_or(body.molecular_formula, None),
        "molecular_weight": js_or(body.molecular_weight, None),
        "smiles": js_or(body.smiles, None),
        "inchi": js_or(body.inchi, None),
        "inchi_key": js_or(body.inchi_key, None),
        "supplier": js_or(body.supplier, None),
        "description": js_or(body.description, None),
        "metadata": js_or(body.metadata, None),
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    insert_doc(db, Chemical, chemical)
    return {"message": "Chemical added successfully", "chemical_id": chemical["chemical_id"]}


@router.post("/upload/sdf")
async def upload_sdf(
    file: Optional[UploadFile] = File(default=None), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """POST /api/chemicals/upload/sdf — bulk import from an SDF file."""
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    sdf_content = (await file.read()).decode("utf-8", errors="replace")
    molecules = parse_sdf(sdf_content)

    if not molecules:
        raise HTTPException(
            status_code=400,
            detail=(
                "No valid molecules found in the SDF file. Ensure the file follows "
                "the V2000/V3000 SDF format with $$$$ record delimiters."
            ),
        )

    inserted = 0
    updated = 0
    parse_errors: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []

    for idx, mol in enumerate(molecules):
        if mol.get("_parse_error"):
            parse_errors.append(
                {
                    "molecule": f"Record #{idx + 1}",
                    "error": "; ".join(mol.get("warnings") or []) or "Failed to parse",
                }
            )
            continue

        try:
            mapped = map_molecule_to_chemical(mol)
            # Generate a chemical_id if not found in the SDF properties
            # (JS used Date.now(); epoch-millis here for the same shape).
            chemical_id = mapped.get("chemical_id") or f"SDF-{int(time.time() * 1000)}-{idx}"

            existing = find_row(db, Chemical, "chemical_id", chemical_id)
            old = existing.doc if existing else None

            chemical = {
                "id": old["id"] if old else str(uuid.uuid4()),
                "chemical_id": chemical_id,
                "nestle_id": js_or(mapped.get("nestle_id"), None),
                "name": js_or(mapped.get("name"), "Unknown"),
                "cas_number": js_or(mapped.get("cas_number"), None),
                "molecular_formula": js_or(mapped.get("molecular_formula"), None),
                "molecular_weight": js_or(mapped.get("molecular_weight"), None),
                "smiles": js_or(mapped.get("smiles"), None),
                "inchi": js_or(mapped.get("inchi"), None),
                "inchi_key": js_or(mapped.get("inchi_key"), None),
                "supplier": js_or(mapped.get("supplier"), None),
                "purity": js_or(mapped.get("purity"), None),
                "storage_conditions": js_or(mapped.get("storage_conditions"), None),
                "hazard_info": js_or(mapped.get("hazard_info"), None),
                "description": js_or(mapped.get("description"), None),
                "mol_block": js_or(mapped.get("mol_block"), None),
                "metadata": mapped.get("metadata") or {},
                "dtxsid": js_or(mapped.get("dtxsid"), None),
                "preferred_name": js_or(mapped.get("preferred_name"), None),
                "monoisotopic_mass": js_or(mapped.get("monoisotopic_mass"), None),
                "ms_ready_smiles": js_or(mapped.get("ms_ready_smiles"), None),
                "inchi_string": js_or(mapped.get("inchi_string"), None),
                "synonyms": mapped.get("synonyms") or [],
                "structural": js_or(mapped.get("structural"), None),
                "created_at": old["created_at"] if old else now_iso(),
                "updated_at": now_iso(),
            }

            if existing:
                replace_doc(db, existing, chemical)
                updated += 1
            else:
                insert_doc(db, Chemical, chemical)
                inserted += 1
        except Exception as err:
            errors.append({"molecule": mol.get("name") or f"Record #{idx + 1}", "error": str(err)})

    all_errors = parse_errors + errors

    response: dict[str, Any] = {
        "message": (
            f"Successfully processed {inserted + updated} chemicals from SDF "
            f"({inserted} new, {updated} updated)"
        ),
        "inserted": inserted,
        "updated": updated,
        "total": inserted + updated,
        "totalRecords": len(molecules),
        "summary": {
            "recordsInFile": len(molecules),
            "successfullyProcessed": inserted + updated,
            "parseErrors": len(parse_errors),
            "insertErrors": len(errors),
        },
    }
    if all_errors:  # Express omits the key when empty (undefined)
        response["errors"] = all_errors
    return response


@router.post("/upload/excel")
async def upload_excel(
    file: Optional[UploadFile] = File(default=None), db: Session = Depends(get_db)
) -> dict[str, Any]:
    """POST /api/chemicals/upload/excel — bulk import from Excel/CSV."""
    if file is None:
        raise HTTPException(status_code=400, detail="No file uploaded")

    file_name = (file.filename or "").lower()
    is_csv = file_name.endswith(".csv") or file_name.endswith(".tsv")
    content = await file.read()

    if is_csv:
        text = content.decode("utf-8", errors="replace")
        data = parse_csv_rows(text)
        if not data:
            raise HTTPException(status_code=400, detail="CSV file is empty or has no data rows")
    else:
        data = sheet_rows_as_dicts(content)

    inserted = 0
    updated = 0
    errors: list[dict[str, Any]] = []

    def col(row: dict[str, str], *names: str) -> Optional[str]:
        """First non-falsy value among the candidate column names (JS `||` chain)."""
        for n in names:
            v = row.get(n)
            if v not in (None, ""):
                return v
        return None

    for row in data:
        try:
            chemical_id = col(row, "DTX_ID", "dtx_id", "Dtx_ID", "chemical_id",
                              "Chemical_ID", "ID") or f"CHEM-{int(time.time() * 1000)}-{inserted}"
            nestle_id = col(row, "NESTLE_ID", "Nestle_ID", "nestle_id")
            cas_number = col(row, "CAS_NO", "CAS_Number", "cas_no", "cas_number", "CAS")
            name = col(row, "CHEMICAL_NAME", "Chemical_Name", "chemical_name",
                       "Name", "name") or "Unknown"
            mol_weight = col(row, "MOL_WEIGHT_ORIG", "MOL_WEIGHT", "Mol_Weight", "mol_weight",
                             "MW", "molecular_weight", "Molecular_Weight")
            mol_formula = col(row, "MOL_FORMULA", "MOL_FOR", "Mol_For", "mol_for",
                              "molecular_formula", "Molecular_Formula", "Formula")
            supplier_ref = col(row, "Supplier_ref", "SUPPLIER_REF", "supplier_ref",
                               "Supplier", "supplier")

            existing = find_row(db, Chemical, "chemical_id", chemical_id)
            old = existing.doc if existing else None

            chemical = {
                "id": old["id"] if old else str(uuid.uuid4()),
                "chemical_id": chemical_id,
                "nestle_id": nestle_id,
                "name": name,
                "cas_number": str(cas_number) if cas_number else None,
                "molecular_formula": mol_formula,
                "molecular_weight": parse_float_or_none(mol_weight) if mol_weight else None,
                "smiles": col(row, "SMILES", "smiles"),
                "inchi": col(row, "InChI", "inchi"),
                "inchi_key": col(row, "InChIKey", "inchi_key"),
                "supplier": supplier_ref,
                "description": col(row, "Description", "description"),
                "metadata": row,
                "created_at": old["created_at"] if old else now_iso(),
                "updated_at": now_iso(),
            }

            if existing:
                replace_doc(db, existing, chemical)
                updated += 1
            else:
                insert_doc(db, Chemical, chemical)
                inserted += 1
        except Exception as err:
            errors.append(
                {"row": row.get("CHEMICAL_NAME") or row.get("Name") or "Unknown", "error": str(err)}
            )

    response: dict[str, Any] = {
        "message": (
            f"Successfully processed {inserted + updated} chemicals "
            f"({inserted} new, {updated} updated)"
        ),
        "inserted": inserted,
        "updated": updated,
        "total": inserted + updated,
    }
    if errors:
        response["errors"] = errors
    return response


@router.post("/bulk/delete")
def bulk_delete(body: BulkDeleteChemicals, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/chemicals/bulk/delete."""
    ids = body.chemical_ids
    if not ids or not isinstance(ids, list) or len(ids) == 0:
        raise HTTPException(status_code=400, detail="No chemical IDs provided")

    deleted = 0
    for cid in ids:
        row = find_row(db, Chemical, "chemical_id", cid)
        if row:
            delete_row(db, row)
            deleted += 1

    return {
        "message": f"Successfully deleted {deleted} chemicals",
        "deleted": deleted,
        "requested": len(ids),
    }


@router.post("/bulk/update")
def bulk_update(body: BulkUpdateChemicals, db: Session = Depends(get_db)) -> dict[str, Any]:
    """POST /api/chemicals/bulk/update — same updates applied to many records."""
    ids = body.chemical_ids
    updates = dict(body.updates or {})
    if not ids or not isinstance(ids, list) or len(ids) == 0:
        raise HTTPException(status_code=400, detail="No chemical IDs provided")
    if not updates:
        raise HTTPException(status_code=400, detail="No updates provided")

    # Never allow changing identity/audit fields (same guard as Express).
    for protected in ("chemical_id", "id", "created_at"):
        updates.pop(protected, None)

    updated = 0
    for cid in ids:
        row = find_row(db, Chemical, "chemical_id", cid)
        if row:
            replace_doc(db, row, {**row.doc, **updates, "updated_at": now_iso()})
            updated += 1

    return {
        "message": f"Successfully updated {updated} chemicals",
        "updated": updated,
        "requested": len(ids),
    }


@router.delete("/all/clear")
def clear_chemicals(db: Session = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/chemicals/all/clear — remove every chemical."""
    count = clear_all(db, Chemical)
    return {"message": f"Successfully deleted all {count} chemicals", "deleted": count}


@router.get("/{chemical_id}")
def get_chemical(chemical_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """GET /api/chemicals/:id — one chemical by its chemical_id."""
    row = find_row(db, Chemical, "chemical_id", chemical_id)
    if not row:
        raise HTTPException(status_code=404, detail="Chemical not found")
    return row.doc


@router.put("/{chemical_id}")
def update_chemical(
    chemical_id: str,
    payload: dict[str, Any] = Body(default={}),
    db: Session = Depends(get_db),
) -> dict[str, Any]:
    """PUT /api/chemicals/:id — merge arbitrary fields into the record.

    Express merges the whole request body (`.assign({...req.body})`), so the
    body is a free-form dict here on purpose — there is no fixed schema.
    """
    row = find_row(db, Chemical, "chemical_id", chemical_id)
    if not row:
        raise HTTPException(status_code=404, detail="Chemical not found")
    replace_doc(db, row, {**row.doc, **payload, "updated_at": now_iso()})
    return {"message": "Chemical updated successfully"}


@router.delete("/{chemical_id}")
def delete_chemical(chemical_id: str, db: Session = Depends(get_db)) -> dict[str, Any]:
    """DELETE /api/chemicals/:id."""
    row = find_row(db, Chemical, "chemical_id", chemical_id)
    if not row:
        raise HTTPException(status_code=404, detail="Chemical not found")
    delete_row(db, row)
    return {"message": "Chemical deleted successfully"}
