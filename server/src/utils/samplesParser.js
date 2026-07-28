/**
 * Samples Excel Parser — SLIMS "Content record" template
 * ======================================================
 *
 * Parses the Nestlé SLIMS sample-upload workbook
 * (e.g. "Upload_Sample template_PIPM00617.xlsx").
 *
 * The SLIMS export is NOT a simple one-header sheet. Its layout is:
 *
 *   Row 1  →  machine config (a JSON blob + a banner string)          [skipped]
 *   Row 2  →  SLIMS internal field keys (cntn_barCode, cntn_id, …)    [the parse keys]
 *   Row 3  →  human-readable labels ("Barcode", "Id *", …)            [skipped, kept as _labels]
 *   Row 4+ →  actual sample data
 *
 * Design mirrors utils/sdfParser.js:
 *   • parseSamplesSheet(buffer)  → array of raw row objects (keyed by SLIMS field key)
 *   • parseSamplesRows(aoa)      → same, but from an array-of-arrays (unit-testable)
 *   • mapRowToSample(rawRow)     → clean, structured Pandora sample record
 *
 * Everything is preserved: every raw SLIMS column is kept verbatim in
 * `metadata`, so no information is ever lost even if it is not promoted
 * to a first-class field.
 */

const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');

// SLIMS machine keys that identify the "key header" row.
const SLIMS_KEY_HINTS = [
  'cntn_barcode', 'cntn_id', 'cntn_fk_contenttype', 'cntn_fk_status',
  'cntn_cf_description', 'derivedcount'
];

/**
 * Normalise a European date string (DD/MM/YYYY, Europe/Zurich) to ISO YYYY-MM-DD.
 * Passes through values that are already ISO. Returns null for blanks.
 * Returns the original string (unchanged) when it cannot be confidently parsed.
 */
function normalizeDate(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;

  // Already ISO (YYYY-MM-DD[...])
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY (optionally followed by a time)
  m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})/);
  if (m) {
    let d = m[1], mo = m[2], y = m[3];
    if (y.length === 2) y = '20' + y;
    const dd = parseInt(d, 10), mm = parseInt(mo, 10);
    if (mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }

  return s; // leave as-is; mapRowToSample will record a warning
}

/** Trim a cell; convert empty string to null. */
function clean(val) {
  if (val === undefined || val === null) return null;
  const s = String(val).trim();
  return s === '' ? null : s;
}

/**
 * Build raw row objects from an array-of-arrays (sheet rows).
 * Detects the SLIMS machine-key header row, skips the config row and the
 * human-label row, and returns one object per data row keyed by SLIMS field
 * key. Each object also carries `_labels` (key→human label) and `_rowNumber`.
 *
 * @param {Array<Array<any>>} aoa
 * @returns {{ records: Array<Object>, keyRowIndex: number, warnings: string[] }}
 */
function parseSamplesRows(aoa) {
  const warnings = [];
  if (!Array.isArray(aoa) || aoa.length === 0) {
    return { records: [], keyRowIndex: -1, warnings: ['Sheet is empty'] };
  }

  // Locate the machine-key header row: the row containing the most SLIMS keys.
  let keyRowIndex = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(aoa.length, 10); i++) {
    const row = aoa[i] || [];
    let score = 0;
    for (const cell of row) {
      const c = String(cell || '').trim().toLowerCase();
      if (SLIMS_KEY_HINTS.includes(c) || /^cntn_/.test(c)) score++;
    }
    if (score > bestScore) { bestScore = score; keyRowIndex = i; }
  }

  if (keyRowIndex === -1) {
    // Fallback: assume a plain single-header sheet (row 0 = headers).
    warnings.push('SLIMS key header row not found — treating row 1 as headers.');
    keyRowIndex = 0;
  }

  const keys = (aoa[keyRowIndex] || []).map(k => String(k || '').trim());

  // Is the next row a human-label row? SLIMS labels contain '*' or '(...)'.
  let labelRowIndex = -1;
  const maybeLabels = aoa[keyRowIndex + 1] || [];
  const looksLikeLabels = maybeLabels.some(c => {
    const s = String(c || '');
    return /\*/.test(s) || /\([^)]*\)/.test(s);
  });
  if (looksLikeLabels) labelRowIndex = keyRowIndex + 1;

  const labels = {};
  if (labelRowIndex !== -1) {
    const labelRow = aoa[labelRowIndex] || [];
    keys.forEach((k, idx) => { if (k) labels[k] = String(labelRow[idx] || '').trim(); });
  }

  const dataStart = (labelRowIndex !== -1 ? labelRowIndex : keyRowIndex) + 1;

  const records = [];
  for (let r = dataStart; r < aoa.length; r++) {
    const row = aoa[r] || [];
    // Skip completely empty rows.
    const hasValue = row.some(c => String(c || '').trim() !== '');
    if (!hasValue) continue;

    const obj = {};
    keys.forEach((k, idx) => {
      if (!k) return;
      obj[k] = row[idx] !== undefined ? row[idx] : '';
    });
    obj._labels = labels;
    obj._rowNumber = r + 1; // 1-based, matches Excel
    records.push(obj);
  }

  return { records, keyRowIndex, warnings };
}

/**
 * Parse a SLIMS sample workbook buffer.
 * @param {Buffer} buffer
 * @returns {{ records: Array<Object>, sheetName: string, warnings: string[] }}
 */
function parseSamplesSheet(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  // header:1 → array-of-arrays; raw:false → formatted strings (avoid date serials)
  const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: '' });
  const { records, warnings } = parseSamplesRows(aoa);
  return { records, sheetName, warnings };
}

/**
 * Map a raw SLIMS row object to a clean Pandora sample record.
 *
 * Field renames requested by the team:
 *   cntn_barCode            → sample_id          (Barcode)
 *   cntn_fk_category        → content_type       (Category)
 *   cntn_cf_fk_sampleSubtype→ material_type      (Sample Subtype)
 *   cntn_cf_fk_responsible  → responsible_person (Responsible)
 *   cntn_cf_fk_ownerGroup   → group_name         (Owner Group)
 *   cntn_id                 → identification     (Id *)
 *   cntn_cf_description     → description        (Description)
 *   cntn_cf_fk_project      → project_number     (NPDI number Project)
 *   cntn_cf_receptionDate   → reception_date     (Reception Date)
 *
 * @param {Object} rawRow
 * @returns {Object} Pandora sample record
 */
function mapRowToSample(rawRow) {
  const row = rawRow || {};
  const warnings = [];

  // Case/format-insensitive lookup over the raw SLIMS keys.
  const lc = {};
  for (const [key, val] of Object.entries(row)) {
    if (key.startsWith('_')) continue;
    const base = key.toLowerCase();
    lc[base] = val;
    lc[base.replace(/_/g, ' ')] = val;
    lc[base.replace(/ /g, '_')] = val;
  }
  const find = function () {
    for (const k of arguments) {
      const v = lc[String(k).toLowerCase()];
      if (v !== undefined && String(v).trim() !== '') return v;
    }
    return null;
  };

  // ── User-named first-class fields ──
  const sample_id          = clean(find('cntn_barcode', 'barcode', 'sample_id'));
  const content_type       = clean(find('cntn_fk_category', 'category', 'content_type'));
  const material_type      = clean(find('cntn_cf_fk_samplesubtype', 'sample_subtype', 'material_type'));
  const responsible_person = clean(find('cntn_cf_fk_responsible', 'responsible', 'responsible_person'));
  const group_name         = clean(find('cntn_cf_fk_ownergroup', 'owner_group', 'group_name'));
  const identification     = clean(find('cntn_id', 'identification'));
  const description         = clean(find('cntn_cf_description', 'description'));
  const project_number     = clean(find('cntn_cf_fk_project', 'project_number', 'npdi'));
  const reception_dateRaw  = find('cntn_cf_receptiondate', 'reception_date', 'reception date');

  // ── Useful system fields (also promoted) ──
  const statusRaw          = clean(find('cntn_fk_status', 'status'));
  const expiry_dateRaw     = find('cntn_cf_exp_date', 'expiry_date', 'exp_date');

  // ── Date normalisation (DD/MM/YYYY → ISO) ──
  const reception_date = normalizeDate(reception_dateRaw);
  if (reception_dateRaw && reception_date && !/^\d{4}-\d{2}-\d{2}$/.test(reception_date)) {
    warnings.push(`reception_date "${reception_dateRaw}" could not be normalised to ISO`);
  }
  const expiry_date = normalizeDate(expiry_dateRaw);
  if (expiry_dateRaw && expiry_date && !/^\d{4}-\d{2}-\d{2}$/.test(expiry_date)) {
    warnings.push(`expiry_date "${expiry_dateRaw}" could not be normalised to ISO`);
  }

  if (!sample_id) {
    warnings.push('Missing Barcode (sample_id) — row cannot be uniquely identified');
  }

  // Display name (back-compat with existing UI/search): use identification.
  const name = identification || sample_id || 'Unknown';

  // ── Metadata catch-all: every raw SLIMS column, verbatim ──
  const metadata = {};
  for (const [key, val] of Object.entries(row)) {
    if (key.startsWith('_')) continue;
    metadata[key] = (val === undefined || val === '') ? null : val;
  }

  // Status normalisation for the UI badge.
  const status = statusRaw ? statusRaw.toLowerCase().replace(/\s+/g, '_') : 'available';

  // ── Tier 3 — derived intelligence ──
  const now = new Date();
  const isExpired = expiry_date && /^\d{4}-\d{2}-\d{2}$/.test(expiry_date)
    ? new Date(expiry_date) < now : false;

  return {
    sample_id: sample_id,
    name: name,
    identification: identification,
    content_type: content_type,
    material_type: material_type,
    responsible_person: responsible_person,
    group_name: group_name,
    project_number: project_number,
    description: description,
    reception_date: reception_date,
    expiry_date: expiry_date,
    status: status,
    // Manual chemical linkage — populated later in the application.
    // One sample may be linked to several chemicals.
    chemical_ids: [],
    // Human labels (SLIMS) preserved for reference / UI tooltips.
    labels: row._labels || {},
    // Catch-all: every raw SLIMS field.
    metadata: metadata,
    _derived: {
      hasExpiry: !!expiry_date,
      isExpired: isExpired,
      slimsGuid: clean(find('<slimsguid>')) || null,
      reception_date_raw: reception_dateRaw || null,
      rowNumber: row._rowNumber || null
    },
    _warnings: warnings
  };
}

module.exports = { parseSamplesSheet, parseSamplesRows, mapRowToSample, normalizeDate };
