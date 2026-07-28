"""JavaScript-compatibility helpers.

The Express backend leans on JavaScript idioms (`||` defaulting, `parseInt`,
`Date.toISOString()`, `Number.toFixed`). To keep the API contract identical,
these helpers reproduce those exact semantics rather than the closest
Pythonic equivalent. Each function documents the JS behaviour it mirrors.
"""

import math
import re
from datetime import datetime, timezone
from typing import Any, Optional


def js_falsy(value: Any) -> bool:
    """True when JavaScript would treat `value` as falsy.

    JS falsy values: undefined, null, false, 0, -0, NaN, "" (empty string).
    In Python terms: None, False, 0, 0.0, nan, "".
    """
    if value is None or value is False:
        return True
    if isinstance(value, str) and value == "":
        return True
    # bool is a subclass of int, but we handled False above; True is truthy.
    if isinstance(value, bool):
        return False
    if isinstance(value, (int, float)):
        return value == 0 or (isinstance(value, float) and math.isnan(value))
    return False


def js_or(value: Any, default: Any) -> Any:
    """Mirror of the JS `value || default` idiom (falsy → default).

    Used everywhere the Express routes write `req.body.x || null`, which
    converts empty strings AND the number 0 to null — we replicate that
    exactly, quirks included.
    """
    return default if js_falsy(value) else value


_INT_PREFIX = re.compile(r"^\s*[+-]?\d+")


def parse_int_or(value: Any, default: int) -> int:
    """Mirror of `parseInt(value) || default`.

    JS parseInt reads leading digits ("12abc" → 12) and returns NaN otherwise.
    The `|| default` part means NaN AND 0 both fall back to the default.
    """
    if value is None:
        return default
    m = _INT_PREFIX.match(str(value))
    if not m:
        return default
    n = int(m.group(0))
    return n if n != 0 else default


def parse_float_or_none(value: Any) -> Optional[float]:
    """Mirror of `parseFloat(value)` with NaN → None.

    parseFloat also accepts leading-number strings like "194.19 g/mol".
    """
    if value is None:
        return None
    m = re.match(r"^\s*[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?", str(value))
    if not m:
        return None
    try:
        return float(m.group(0))
    except ValueError:
        return None


def now_iso() -> str:
    """Current UTC time in the exact format of JS `new Date().toISOString()`:
    millisecond precision with a 'Z' suffix, e.g. 2026-07-28T14:51:12.177Z
    """
    dt = datetime.now(timezone.utc)
    return dt.strftime("%Y-%m-%dT%H:%M:%S.") + f"{dt.microsecond // 1000:03d}Z"


def to_fixed_1(value: float) -> str:
    """Mirror of JS `Number.toFixed(1)` — returns a STRING with one decimal.

    The Express stats route sends capacity percentages as strings ("0.5"),
    and the React dashboard expects that, so we must not send a float.
    """
    return f"{value:.1f}"


def sort_created_desc(records: list) -> list:
    """Newest-first sort on the `created_at` ISO string.

    Express sorts with `new Date(b.created_at) - new Date(a.created_at)`.
    ISO-8601 strings compare identically as plain strings, so a string sort
    gives the same order without date parsing.
    """
    return sorted(records, key=lambda r: r.get("created_at") or "", reverse=True)


def total_pages(total: int, limit: int) -> int:
    """Mirror of `Math.ceil(total / limit)`."""
    return math.ceil(total / limit) if limit else 0
