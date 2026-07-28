"""SLIMS "Content record" sample-sheet parser — port of server/src/utils/samplesParser.js.

The SLIMS export is NOT a simple one-header sheet. Its layout is:

    Row 1  →  machine config (a JSON blob + banner string)           [skipped]
    Row 2  →  SLIMS internal field keys (cntn_barCode, cntn_id, …)   [the parse keys]
    Row 3  →  human-readable labels ("Barcode", "Id *", …)           [kept as labels]
    Row 4+ →  actual sample data

Every raw SLIMS column is preserved verbatim in `metadata`, so no
information is ever lost even when it is not promoted to a first-class
field. Function-for-function port of the JS module:

    parse_samples_sheet(bytes) → (records, sheet_name, warnings)
    map_row_to_sample(raw_row) → clean Crucible sample record
"""

import re
from datetime import datetime
from typing import Any, Optional

from .excel import sheet_as_grid

# SLIMS machine keys that identify the "key header" row.
SLIMS_KEY_HINTS = [
    "cntn_barcode", "cntn_id", "cntn_fk_contenttype", "cntn_fk_status",
    "cntn_cf_description", "derivedcount",
]


def normalize_date(val: Any) -> Optional[str]:
    """Normalise a European date (DD/MM/YYYY) to ISO YYYY-MM-DD.

    Passes ISO through; returns None for blanks; returns the original string
    unchanged when it cannot be confidently parsed (the caller records a
    warning) — identical to the JS normalizeDate.
    """
    if val is None:
        return None
    s = str(val).strip()
    if not s:
        return None

    m = re.match(r"^(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        return f"{m.group(1)}-{m.group(2)}-{m.group(3)}"

    m = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})", s)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        if len(y) == 2:
            y = "20" + y
        if 1 <= int(mo) <= 12 and 1 <= int(d) <= 31:
            return f"{y}-{mo.zfill(2)}-{d.zfill(2)}"

    return s


def _clean(val: Any) -> Optional[str]:
    """Trim a cell; empty string → None (JS `clean`)."""
    if val is None:
        return None
    s = str(val).strip()
    return s if s else None


def parse_samples_rows(aoa: list[list[str]]) -> tuple[list[dict[str, Any]], int, list[str]]:
    """Build raw row dicts from an array-of-arrays (port of JS parseSamplesRows)."""
    warnings: list[str] = []
    if not aoa:
        return [], -1, ["Sheet is empty"]

    # Locate the machine-key header row: the row with the most SLIMS keys.
    key_row_index = -1
    best_score = 0
    for i in range(min(len(aoa), 10)):
        row = aoa[i] or []
        score = 0
        for cell in row:
            c = str(cell or "").strip().lower()
            if c in SLIMS_KEY_HINTS or c.startswith("cntn_"):
                score += 1
        if score > best_score:
            best_score = score
            key_row_index = i

    if key_row_index == -1:
        warnings.append("SLIMS key header row not found — treating row 1 as headers.")
        key_row_index = 0

    keys = [str(k or "").strip() for k in (aoa[key_row_index] or [])]

    # Is the next row a human-label row? SLIMS labels contain '*' or '(...)'.
    label_row_index = -1
    maybe_labels = aoa[key_row_index + 1] if key_row_index + 1 < len(aoa) else []
    looks_like_labels = any(
        "*" in str(c or "") or re.search(r"\([^)]*\)", str(c or "")) for c in maybe_labels
    )
    if looks_like_labels:
        label_row_index = key_row_index + 1

    labels: dict[str, str] = {}
    if label_row_index != -1:
        label_row = aoa[label_row_index] or []
        for idx, k in enumerate(keys):
            if k:
                labels[k] = str(label_row[idx] if idx < len(label_row) else "").strip()

    data_start = (label_row_index if label_row_index != -1 else key_row_index) + 1

    records: list[dict[str, Any]] = []
    for r in range(data_start, len(aoa)):
        row = aoa[r] or []
        if not any(str(c or "").strip() for c in row):
            continue  # skip completely empty rows
        obj: dict[str, Any] = {}
        for idx, k in enumerate(keys):
            if not k:
                continue
            obj[k] = row[idx] if idx < len(row) else ""
        obj["_labels"] = labels
        obj["_rowNumber"] = r + 1  # 1-based, matches Excel
        records.append(obj)

    return records, key_row_index, warnings


def parse_samples_sheet(content: bytes) -> tuple[list[dict[str, Any]], str, list[str]]:
    """Parse a SLIMS sample workbook (port of JS parseSamplesSheet)."""
    aoa, sheet_name = sheet_as_grid(content)
    records, _key_row, warnings = parse_samples_rows(aoa)
    return records, sheet_name, warnings


def map_row_to_sample(raw_row: dict[str, Any]) -> dict[str, Any]:
    """Map a raw SLIMS row to a clean Crucible sample record (port of JS)."""
    row = raw_row or {}
    warnings: list[str] = []

    # Case/format-insensitive lookup over the raw SLIMS keys.
    lc: dict[str, Any] = {}
    for key, val in row.items():
        if key.startswith("_"):
            continue
        base = key.lower()
        lc[base] = val
        lc[base.replace("_", " ")] = val
        lc[base.replace(" ", "_")] = val

    def find(*keys: str) -> Optional[Any]:
        for k in keys:
            v = lc.get(str(k).lower())
            if v is not None and str(v).strip() != "":
                return v
        return None

    sample_id = _clean(find("cntn_barcode", "barcode", "sample_id"))
    content_type = _clean(find("cntn_fk_category", "category", "content_type"))
    material_type = _clean(find("cntn_cf_fk_samplesubtype", "sample_subtype", "material_type"))
    responsible_person = _clean(find("cntn_cf_fk_responsible", "responsible", "responsible_person"))
    group_name = _clean(find("cntn_cf_fk_ownergroup", "owner_group", "group_name"))
    identification = _clean(find("cntn_id", "identification"))
    description = _clean(find("cntn_cf_description", "description"))
    project_number = _clean(find("cntn_cf_fk_project", "project_number", "npdi"))
    reception_date_raw = find("cntn_cf_receptiondate", "reception_date", "reception date")

    status_raw = _clean(find("cntn_fk_status", "status"))
    expiry_date_raw = find("cntn_cf_exp_date", "expiry_date", "exp_date")

    reception_date = normalize_date(reception_date_raw)
    if reception_date_raw and reception_date and not re.match(r"^\d{4}-\d{2}-\d{2}$", reception_date):
        warnings.append(f'reception_date "{reception_date_raw}" could not be normalised to ISO')
    expiry_date = normalize_date(expiry_date_raw)
    if expiry_date_raw and expiry_date and not re.match(r"^\d{4}-\d{2}-\d{2}$", expiry_date):
        warnings.append(f'expiry_date "{expiry_date_raw}" could not be normalised to ISO')

    if not sample_id:
        warnings.append("Missing Barcode (sample_id) — row cannot be uniquely identified")

    # Display name (back-compat with existing UI/search): use identification.
    name = identification or sample_id or "Unknown"

    # Metadata catch-all: every raw SLIMS column, verbatim ('' → None).
    metadata: dict[str, Any] = {}
    for key, val in row.items():
        if key.startswith("_"):
            continue
        metadata[key] = None if (val is None or val == "") else val

    # Status normalisation for the UI badge (JS: replace(/\s+/g, '_')).
    status = re.sub(r"\s+", "_", status_raw.lower()) if status_raw else "available"

    is_expired = False
    if expiry_date and re.match(r"^\d{4}-\d{2}-\d{2}$", expiry_date):
        is_expired = datetime.strptime(expiry_date, "%Y-%m-%d") < datetime.now()

    return {
        "sample_id": sample_id,
        "name": name,
        "identification": identification,
        "content_type": content_type,
        "material_type": material_type,
        "responsible_person": responsible_person,
        "group_name": group_name,
        "project_number": project_number,
        "description": description,
        "reception_date": reception_date,
        "expiry_date": expiry_date,
        "status": status,
        # Manual chemical linkage — populated later in the application.
        "chemical_ids": [],
        # Human labels (SLIMS) preserved for reference / UI tooltips.
        "labels": row.get("_labels") or {},
        "metadata": metadata,
        "_derived": {
            "hasExpiry": bool(expiry_date),
            "isExpired": is_expired,
            "slimsGuid": _clean(find("<slimsguid>")),
            "reception_date_raw": reception_date_raw or None,
            "rowNumber": row.get("_rowNumber"),
        },
        "_warnings": warnings,
    }
