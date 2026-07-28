/**
 * SDF (Structure Data File) Parser — Pandora Toolbox 2.0
 *
 * Parses V2000 and V3000 molfiles embedded in SDF containers.
 *
 * SDF Format Overview (per CTFile Specification):
 *   ┌────────────────────────────────┐
 *   │  Header Block (3 lines)        │  ← molecule name, program/date, comment
 *   │  Counts Line                   │  ← num atoms, num bonds, … , "V2000"|"V3000"
 *   │  Atom Block                    │  ← one line per atom (x, y, z, symbol, …)
 *   │  Bond Block                    │  ← one line per bond (atom1, atom2, type, …)
 *   │  Properties Block (M  lines)   │  ← M  CHG, M  ISO, … , M  END
 *   │  Data Items                    │  ← >  <FIELD_NAME> followed by value lines
 *   │  $$$$                          │  ← record delimiter
 *   └────────────────────────────────┘
 *
 * References:
 *   - BIOVIA CTFile Formats 2020
 *   - https://en.wikipedia.org/wiki/Chemical_table_file
 *   - https://chem.libretexts.org/.../2.05:_Structural_Data_Files
 */

// ---------------------------------------------------------------------------
// Average atomic masses (IUPAC 2021) — used to compute MW from atom block
// ---------------------------------------------------------------------------
const ATOMIC_WEIGHTS = {
  H: 1.008, He: 4.003, Li: 6.941, Be: 9.012, B: 10.81, C: 12.011,
  N: 14.007, O: 15.999, F: 18.998, Ne: 20.180, Na: 22.990, Mg: 24.305,
  Al: 26.982, Si: 28.086, P: 30.974, S: 32.06, Cl: 35.45, Ar: 39.948,
  K: 39.098, Ca: 40.078, Sc: 44.956, Ti: 47.867, V: 50.942, Cr: 51.996,
  Mn: 54.938, Fe: 55.845, Co: 58.933, Ni: 58.693, Cu: 63.546, Zn: 65.38,
  Ga: 69.723, Ge: 72.630, As: 74.922, Se: 78.971, Br: 79.904, Kr: 83.798,
  Rb: 85.468, Sr: 87.62, Y: 88.906, Zr: 91.224, Nb: 92.906, Mo: 95.95,
  Tc: 97, Ru: 101.07, Rh: 102.91, Pd: 106.42, Ag: 107.87, Cd: 112.41,
  In: 114.82, Sn: 118.71, Sb: 121.76, Te: 127.60, I: 126.90, Xe: 131.29,
  Cs: 132.91, Ba: 137.33, La: 138.91, Ce: 140.12, Pr: 140.91, Nd: 144.24,
  Pm: 145, Sm: 150.36, Eu: 151.96, Gd: 157.25, Tb: 158.93, Dy: 162.50,
  Ho: 164.93, Er: 167.26, Tm: 168.93, Yb: 173.05, Lu: 174.97, Hf: 178.49,
  Ta: 180.95, W: 183.84, Re: 186.21, Os: 190.23, Ir: 192.22, Pt: 195.08,
  Au: 196.97, Hg: 200.59, Tl: 204.38, Pb: 207.2, Bi: 208.98, Po: 209,
  At: 210, Rn: 222, Fr: 223, Ra: 226, Ac: 227, Th: 232.04, Pa: 231.04,
  U: 238.03, Np: 237, Pu: 244, Am: 243, Cm: 247, Bk: 247, Cf: 251,
  Es: 252, Fm: 257, Md: 258, No: 259, Lr: 266, D: 2.014, T: 3.016
};

// Bond type labels
const BOND_TYPES = {
  1: 'Single', 2: 'Double', 3: 'Triple', 4: 'Aromatic',
  5: 'Single or Double', 6: 'Single or Aromatic',
  7: 'Double or Aromatic', 8: 'Any'
};

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

/**
 * Parse an SDF file and return an array of molecule objects.
 *
 * Each molecule object has:
 *   - name            {string}   molecule name from header line 1
 *   - program         {string}   program/timestamp from header line 2
 *   - comment         {string}   comment from header line 3
 *   - version         {string}   "V2000" or "V3000"
 *   - molBlock        {string}   the full MOL block (header through M  END)
 *   - atoms           {Array}    parsed atom objects
 *   - bonds           {Array}    parsed bond objects
 *   - atomCounts      {Object}   element → count map
 *   - molecularFormula {string}  Hill-order formula derived from atom block
 *   - molecularWeight  {number}  computed from atom block
 *   - properties      {Object}   key→value from the data items after M  END
 *   - warnings        {Array}    non-fatal parse warnings
 *
 * @param {string} content  Raw SDF file content
 * @returns {Array<Object>}
 */
function parseSDF(content) {
  if (!content || typeof content !== 'string') {
    return [];
  }

  // Normalise line endings
  const normalised = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split on the $$$$ record separator
  const records = normalised.split(/^\$\$\$\$[^\S\n]*$/m).filter(r => r.trim());

  const molecules = [];

  for (const record of records) {
    try {
      // IMPORTANT: only strip trailing whitespace.
      // Stripping the leading blank line would shift the header block down
      // by one — the SDF spec requires 3 header lines (name, program, comment)
      // BEFORE the counts line, and the molecule-name line is often blank.
      const mol = parseRecord(record.replace(/^\n+/, '').replace(/\s+$/, ''));
      if (mol) {
        molecules.push(mol);
      }
    } catch (err) {
      molecules.push({
        name: 'Parse Error',
        molBlock: '',
        atoms: [],
        bonds: [],
        atomCounts: {},
        molecularFormula: '',
        molecularWeight: 0,
        properties: {},
        warnings: ['Failed to parse record: ' + err.message],
        _parseError: true
      });
    }
  }

  return molecules;
}

// ---------------------------------------------------------------------------
// Parse a single SDF record (one molecule)
// ---------------------------------------------------------------------------
function parseRecord(text) {
  const lines = text.split('\n');
  if (lines.length < 4) return null;

  const warnings = [];

  // ── Header Block (3 lines) ──
  const name = lines[0].trim();
  const programLine = lines[1] || '';
  const comment = (lines[2] || '').trim();

  // ── Counts Line (line index 3) ──
  // Some SDF writers omit the blank molecule-name line, shifting the counts line
  // up by one (to index 2). Also some files have V3000 markers without `V3000`
  // appearing on the counts line. Scan the body as a fallback.
  let countsLine = lines[3] || '';
  let version = detectVersion(countsLine);
  if (version !== 'V3000' && lines.some(function(l){ return /^M\s+V30\s/.test(l); })) {
    version = 'V3000';
    warnings.push('V3000 markers found despite V2000 counts line — using V3000 parser');
  }

  let atoms = [];
  let bonds = [];
  let sGroups = [];
  let collections = [];
  let mEndIndex = -1;

  if (version === 'V3000') {
    ({ atoms, bonds, sGroups, collections, mEndIndex } = parseV3000(lines, warnings));
  } else {
    ({ atoms, bonds, mEndIndex } = parseV2000(lines, countsLine, warnings));
  }

  // ── MOL Block ──
  const molBlock = mEndIndex >= 0
    ? lines.slice(0, mEndIndex + 1).join('\n')
    : lines.join('\n');

  // ── Atom counts & derived formula / MW ──
  const atomCounts = {};
  let molecularWeight = 0;

  for (const atom of atoms) {
    const sym = normaliseSymbol(atom.symbol);
    if (!sym || sym === 'R' || sym === '*' || sym === 'A' || sym === 'Q' || sym === 'Lp') continue;
    atomCounts[sym] = (atomCounts[sym] || 0) + 1;
    molecularWeight += (ATOMIC_WEIGHTS[sym] || 0);
  }

  const molecularFormula = buildHillFormula(atomCounts);
  molecularWeight = Math.round(molecularWeight * 1000) / 1000;

  // ── Data Items (properties after M  END) ──
  const properties = parseDataItems(lines, mEndIndex, warnings);

  return {
    name: name || properties['COMPOUND_NAME'] || properties['NAME'] || properties['name'] || 'Unknown',
    program: programLine.trim(),
    comment,
    version,
    molBlock,
    atoms,
    bonds,
    sGroups: sGroups || [],
    collections: collections || [],
    atomCounts,
    molecularFormula,
    molecularWeight,
    properties,
    warnings
  };
}

// ---------------------------------------------------------------------------
// Detect V2000 vs V3000
// ---------------------------------------------------------------------------
function detectVersion(countsLine) {
  if (countsLine.trim().includes('V3000')) return 'V3000';
  return 'V2000';
}

// ---------------------------------------------------------------------------
// V2000 parser
// ---------------------------------------------------------------------------
function parseV2000(lines, countsLine, warnings) {
  const counts = countsLine.trim().split(/\s+/);
  const numAtoms = parseInt(counts[0], 10) || 0;
  const numBonds = parseInt(counts[1], 10) || 0;

  if (numAtoms === 0) {
    warnings.push('Counts line reports 0 atoms');
  }

  const atoms = [];
  const bonds = [];
  let mEndIndex = -1;

  // ── Atom Block (starts at line index 4) ──
  const atomStart = 4;
  for (let i = atomStart; i < atomStart + numAtoms && i < lines.length; i++) {
    const atom = parseV2000AtomLine(lines[i], i - atomStart + 1, warnings);
    if (atom) atoms.push(atom);
  }

  // ── Bond Block ──
  const bondStart = atomStart + numAtoms;
  for (let i = bondStart; i < bondStart + numBonds && i < lines.length; i++) {
    const bond = parseV2000BondLine(lines[i], warnings);
    if (bond) bonds.push(bond);
  }

  // ── Find M  END ──
  for (let i = bondStart + numBonds; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (trimmed.startsWith('M  END') || trimmed === 'M END') {
      mEndIndex = i;
      break;
    }
  }

  // Fallback scan
  if (mEndIndex < 0) {
    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (trimmed.startsWith('M  END') || trimmed === 'M END') {
        mEndIndex = i;
        break;
      }
    }
  }

  if (mEndIndex < 0) {
    warnings.push('M  END not found');
    mEndIndex = lines.length - 1;
  }

  return { atoms, bonds, mEndIndex };
}

/**
 * Parse a single V2000 atom line.
 * Format (fixed-width):
 *   xxxxx.xxxxyyyyy.yyyyzzzzz.zzzz aaaddcccssshhhbbbvvvHHHrrriiimmmnnneee
 */
function parseV2000AtomLine(line, index, warnings) {
  if (!line || line.trim().length < 31) {
    warnings.push('Atom line ' + index + ': too short');
    return null;
  }

  let x, y, z, symbol;

  // Try fixed-width first
  if (line.length >= 34) {
    x = parseFloat(line.substring(0, 10).trim());
    y = parseFloat(line.substring(10, 20).trim());
    z = parseFloat(line.substring(20, 30).trim());
    symbol = line.substring(31, 34).trim();
  }

  // Fallback to whitespace splitting
  if (!symbol || isNaN(x)) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4) {
      x = parseFloat(parts[0]);
      y = parseFloat(parts[1]);
      z = parseFloat(parts[2]);
      symbol = parts[3];
    }
  }

  if (!symbol) {
    warnings.push('Atom line ' + index + ': could not extract symbol');
    return null;
  }

  // Charge encoding from atom line (column 36-38)
  let charge = 0;
  if (line.length >= 39) {
    const chgField = parseInt(line.substring(36, 39).trim(), 10);
    const chargeMap = { 0: 0, 1: 3, 2: 2, 3: 1, 4: 0, 5: -1, 6: -2, 7: -3 };
    charge = chargeMap[chgField] !== undefined ? chargeMap[chgField] : 0;
  }

  // Mass difference (column 34-35)
  let massDiff = 0;
  if (line.length >= 36) {
    massDiff = parseInt(line.substring(34, 36).trim(), 10) || 0;
  }

  return { index, x: isNaN(x) ? 0 : x, y: isNaN(y) ? 0 : y, z: isNaN(z) ? 0 : z, symbol, charge, massDiff };
}

/**
 * Parse a V2000 bond line.
 * Format: 111222tttsssxxxrrrccc (each field 3 chars)
 */
function parseV2000BondLine(line, warnings) {
  const parts = line.trim().split(/\s+/);
  if (parts.length < 3) {
    warnings.push('Bond line too short: ' + line.trim());
    return null;
  }

  const bondType = parseInt(parts[2], 10);
  return {
    atom1: parseInt(parts[0], 10),
    atom2: parseInt(parts[1], 10),
    type: bondType,
    typeLabel: BOND_TYPES[bondType] || 'Unknown',
    stereo: parts.length > 3 ? parseInt(parts[3], 10) : 0
  };
}

// ---------------------------------------------------------------------------
// V3000 parser — atoms, bonds, S-Groups (polymer SRU detection),
// stereo collection (STEABS / STEREL / STERAC), and link nodes
// ---------------------------------------------------------------------------
function parseV3000(lines, warnings) {
  const atoms = [];
  const bonds = [];
  const sGroups = [];           // {type, label, atoms[]} — SRU, MUL, COP, MIX, etc.
  const collections = [];       // STEABS / STEREL / STERAC stereo collections
  let mEndIndex = -1;
  let inAtomBlock = false;
  let inBondBlock = false;
  let inSGroupBlock = false;
  let inCollectionBlock = false;

  // ── Join V3000 continuation lines (lines ending in `-` continue on next `M  V30` line) ──
  // This is required by the CTfile spec for long SGROUP / BOND / ATOM lines.
  const joined = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    // Preserve M  END detection
    if (line.trim().startsWith('M  END')) { joined.push({ raw: line, srcIndex: i }); continue; }
    if (!/^M\s+V30\b/.test(line)) { joined.push({ raw: line, srcIndex: i }); continue; }
    let buf = line.replace(/-\s*$/, '');
    while (/-\s*$/.test(lines[i]) && i + 1 < lines.length && /^M\s+V30\b/.test(lines[i + 1])) {
      i++;
      // Strip the leading "M  V30 " prefix from the continuation
      const cont = lines[i].replace(/^M\s+V30\s*/, '').replace(/-\s*$/, '');
      buf += cont;
    }
    joined.push({ raw: buf, srcIndex: i });
  }
  lines = joined.map(function(j){ return j.raw; });

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line === 'M  END' || line.startsWith('M  END')) {
      mEndIndex = i;
      break;
    }

    if (!line.startsWith('M  V30')) continue;
    const payload = line.substring(6).trim();

    if (payload === 'BEGIN ATOM')        { inAtomBlock = true;  inBondBlock = false; inSGroupBlock = false; inCollectionBlock = false; continue; }
    if (payload === 'END ATOM')          { inAtomBlock = false; continue; }
    if (payload === 'BEGIN BOND')        { inBondBlock = true;  inAtomBlock = false; inSGroupBlock = false; inCollectionBlock = false; continue; }
    if (payload === 'END BOND')          { inBondBlock = false; continue; }
    if (payload === 'BEGIN SGROUP')      { inSGroupBlock = true; inAtomBlock = false; inBondBlock = false; inCollectionBlock = false; continue; }
    if (payload === 'END SGROUP')        { inSGroupBlock = false; continue; }
    if (payload === 'BEGIN COLLECTION')  { inCollectionBlock = true; inAtomBlock = false; inBondBlock = false; inSGroupBlock = false; continue; }
    if (payload === 'END COLLECTION')    { inCollectionBlock = false; continue; }

    if (inAtomBlock) {
      const atom = parseV3000AtomLine(payload, warnings);
      if (atom) atoms.push(atom);
    }
    if (inBondBlock) {
      const bond = parseV3000BondLine(payload, warnings);
      if (bond) bonds.push(bond);
    }
    if (inSGroupBlock) {
      const sg = parseV3000SGroupLine(payload, warnings);
      if (sg) sGroups.push(sg);
    }
    if (inCollectionBlock) {
      // e.g.  MDLV30/STEABS ATOMS=(2 3 7)
      collections.push(payload);
    }
  }

  if (mEndIndex < 0) {
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].trim().startsWith('M  END')) { mEndIndex = i; break; }
    }
  }
  if (mEndIndex < 0) {
    warnings.push('V3000: M  END not found');
    mEndIndex = lines.length - 1;
  }

  return { atoms, bonds, sGroups, collections, mEndIndex };
}

/**
 * V3000 S-Group line. Example:
 *   1 SRU 0 ATOMS=(4 1 2 3 4) XBONDS=(2 5 6) LABEL=n CONNECT=HT
 * We extract: type (SRU/MUL/COP/MIX/SUP), label (if present), atom list.
 */
function parseV3000SGroupLine(payload, warnings) {
  // Skip 'DEFAULT' or counts continuation lines
  const parts = payload.split(/\s+/);
  if (parts.length < 2) return null;
  // Skip header line like "3 0 0" (counts)
  if (!/^[A-Za-z]/.test(parts[1])) return null;

  const sg = {
    index: parseInt(parts[0], 10) || 0,
    type: parts[1],          // SRU, MUL, COP, MIX, SUP, DAT, …
    label: null,
    connect: null,
    atomIndices: []
  };

  // Extract ATOMS=(n a1 a2 …)
  const atomsMatch = payload.match(/ATOMS=\(\s*(\d+)\s+([^)]+)\)/);
  if (atomsMatch) {
    sg.atomIndices = atomsMatch[2].trim().split(/\s+/).map(function(n) { return parseInt(n, 10); }).filter(function(n) { return !isNaN(n); });
  }

  // Extract LABEL=...
  const labelMatch = payload.match(/LABEL=("([^"]+)"|(\S+))/);
  if (labelMatch) sg.label = labelMatch[2] || labelMatch[3] || null;

  // Extract CONNECT=…  (HT = head-to-tail, EU = either, HH = head-to-head)
  const connectMatch = payload.match(/CONNECT=(\S+)/);
  if (connectMatch) sg.connect = connectMatch[1];

  return sg;
}

/**
 * V3000 atom line: index symbol x y z aamap [keyword=value ...]
 * Captures CHG (charge), MASS (isotope), CFG (atom stereo), RAD (radical).
 */
function parseV3000AtomLine(payload, warnings) {
  const parts = payload.split(/\s+/);
  if (parts.length < 6) {
    warnings.push('V3000 atom line too short: ' + payload);
    return null;
  }

  let charge = 0, massDiff = 0, cfg = 0, radical = 0;
  for (let i = 6; i < parts.length; i++) {
    const kv = parts[i].split('=');
    if (kv[0] === 'CHG')  charge   = parseInt(kv[1], 10) || 0;
    if (kv[0] === 'MASS') massDiff = parseInt(kv[1], 10) || 0;
    if (kv[0] === 'CFG')  cfg      = parseInt(kv[1], 10) || 0;
    if (kv[0] === 'RAD')  radical  = parseInt(kv[1], 10) || 0;
  }

  return {
    index: parseInt(parts[0], 10),
    symbol: parts[1],
    x: parseFloat(parts[2]),
    y: parseFloat(parts[3]),
    z: parseFloat(parts[4]),
    charge, massDiff, cfg, radical
  };
}

/**
 * V3000 bond line: index type atom1 atom2 [keyword=value ...]
 * Captures CFG (bond stereo: 1=up, 3=down, 2=either).
 */
function parseV3000BondLine(payload, warnings) {
  const parts = payload.split(/\s+/);
  if (parts.length < 4) {
    warnings.push('V3000 bond line too short: ' + payload);
    return null;
  }

  let stereo = 0;
  for (let i = 4; i < parts.length; i++) {
    const kv = parts[i].split('=');
    if (kv[0] === 'CFG') stereo = parseInt(kv[1], 10) || 0;
  }

  const bondType = parseInt(parts[1], 10);
  return {
    atom1: parseInt(parts[2], 10),
    atom2: parseInt(parts[3], 10),
    type: bondType,
    typeLabel: BOND_TYPES[bondType] || 'Unknown',
    stereo
  };
}

// ---------------------------------------------------------------------------
// Data Items parser (properties after M  END)
// ---------------------------------------------------------------------------

/**
 * Parse associated data items that follow M  END.
 *
 * Format:
 *   >  <FIELD_NAME>          ← field header (variations allowed)
 *   value line 1
 *   value line 2
 *                             ← blank line terminates the value
 */
function parseDataItems(lines, mEndIndex, warnings) {
  const properties = {};
  if (mEndIndex < 0) return properties;

  let currentField = null;
  let currentValue = [];

  for (let i = mEndIndex + 1; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('>')) {
      // Save previous field
      if (currentField) {
        properties[currentField] = currentValue.join('\n').trim();
      }
      // Extract field name between < and >
      const match = line.match(/<\s*(.+?)\s*>/);
      if (match) {
        currentField = match[1].trim();
        currentValue = [];
      } else {
        warnings.push('Data item header without field name: ' + line.trim());
        currentField = '_UNNAMED_' + i;
        currentValue = [];
      }
      continue;
    }

    // Blank line terminates the current data item value
    if (line.trim() === '') {
      if (currentField) {
        properties[currentField] = currentValue.join('\n').trim();
        currentField = null;
        currentValue = [];
      }
      continue;
    }

    // Accumulate value lines
    if (currentField) {
      currentValue.push(line);
    }
  }

  // Save any trailing field
  if (currentField) {
    properties[currentField] = currentValue.join('\n').trim();
  }

  return properties;
}

// ---------------------------------------------------------------------------
// Molecular formula helpers
// ---------------------------------------------------------------------------

function normaliseSymbol(sym) {
  if (!sym) return '';
  const s = sym.trim();
  if (s.length === 0) return '';
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/**
 * Build a Hill-order molecular formula.
 * Hill order: C first, H second, then everything else alphabetically.
 */
function buildHillFormula(atomCounts) {
  if (Object.keys(atomCounts).length === 0) return '';

  const parts = [];
  const hasCarbon = 'C' in atomCounts;

  if (hasCarbon) {
    parts.push('C' + (atomCounts['C'] > 1 ? atomCounts['C'] : ''));
    if ('H' in atomCounts) {
      parts.push('H' + (atomCounts['H'] > 1 ? atomCounts['H'] : ''));
    }
  }

  const remaining = Object.keys(atomCounts)
    .filter(sym => !(hasCarbon && (sym === 'C' || sym === 'H')))
    .sort();

  for (const sym of remaining) {
    parts.push(sym + (atomCounts[sym] > 1 ? atomCounts[sym] : ''));
  }

  return parts.join('');
}

// ---------------------------------------------------------------------------
// Field mapping: SDF property names → Pandora chemical schema
// ---------------------------------------------------------------------------

/**
 * Map parsed SDF data to the Pandora Toolbox chemical schema.
 * Handles many common field name variations found in real-world SDF files
 * (PubChem, EPA CompTox, vendor catalogues, etc.)
 *
 * @param {Object} mol  Parsed molecule from parseSDF()
 * @returns {Object}     Pandora chemical record
 */
function mapMoleculeToChemical(mol) {
  const props = mol.properties || {};

  // Case-insensitive lookup
  const lc = {};
  for (const [key, val] of Object.entries(props)) {
    lc[key.toLowerCase()] = val;
    lc[key.toLowerCase().replace(/_/g, ' ')] = val;
    lc[key.toLowerCase().replace(/ /g, '_')] = val;
  }

  // Helper: find value by any of several candidate keys
  const find = function() {
    const keys = Array.from(arguments);
    for (const k of keys) {
      const v = lc[k.toLowerCase()];
      if (v !== undefined && v !== '') return v;
    }
    return null;
  };

  // ── chemical_id ──
  const chemical_id = find(
    'chemical_id', 'compound_id', 'id', 'dtx_id', 'dtxsid',
    'pubchem_compound_cid', 'chembl_id', 'unique_id',
    'substance_id', 'registry_number', 'catalog_number',
    'nsc_number', 'molecule_id', 'mol_id'
  );

  // ── name ──
  const name = find(
    'compound_name', 'chemical_name', 'name', 'molecule_name',
    'preferred_name', 'common_name', 'iupac_name',
    'pubchem_iupac_name', 'pubchem_iupac_traditional_name',
    'generic_name', 'trade_name', 'systematic_name'
  ) || mol.name || 'Unknown';

  // ── CAS ──
  const cas_number = find(
    'cas_number', 'cas_no', 'cas', 'casrn', 'cas_rn',
    'cas registry number', 'cas_registry_number'
  );

  // ── Molecular formula: prefer property, fall back to computed ──
  const molecular_formula = find(
    'molecular_formula', 'mol_formula', 'mol_for', 'formula',
    'pubchem_molecular_formula', 'molecular formula'
  ) || mol.molecularFormula || null;

  // ── Molecular weight: prefer property, fall back to computed ──
  const mwStr = find(
    'molecular_weight', 'mol_weight', 'mol_weight_orig', 'mw',
    'exact_mass', 'pubchem_molecular_weight', 'pubchem_exact_mass',
    'molecular weight', 'monoisotopic_mass', 'monoisotopic_weight',
    'pubchem_monoisotopic_weight'
  );
  const molecular_weight = mwStr ? parseFloat(mwStr) : (mol.molecularWeight || null);

  // ── SMILES ──
  const smiles = find(
    'smiles', 'canonical_smiles', 'isomeric_smiles',
    'pubchem_openeye_can_smiles', 'pubchem_openeye_iso_smiles',
    'openeye_can_smiles', 'openeye_iso_smiles'
  );

  // ── InChI ──
  const inchi = find(
    'inchi', 'standard_inchi', 'pubchem_iupac_inchi', 'iupac_inchi'
  );

  // ── InChIKey ──
  const inchi_key = find(
    'inchikey', 'inchi_key', 'standard_inchikey',
    'pubchem_iupac_inchikey', 'iupac_inchikey'
  );

  // ── Supplier ──
  const supplier = find(
    'supplier', 'vendor', 'supplier_ref', 'source',
    'manufacturer', 'provider', 'company'
  );

  // ── Nestle ID ──
  const nestle_id = find('nestle_id', 'nestle id');

  // ── Additional fields ──
  const purity = find('purity', 'percent_purity', 'assay_purity');
  const storage_conditions = find(
    'storage_conditions', 'storage', 'storage_temp',
    'storage_temperature', 'storage conditions'
  );
  const hazard_info = find(
    'hazard_info', 'hazard', 'hazard_information', 'safety',
    'safety_data', 'ghs_hazard', 'hazard_classification'
  );
  const description = find('description', 'comment', 'comments', 'notes');

  // Guard: mol.comment might be a V3000 counts line or other non-comment data
  const safeComment = (mol.comment && !/V[23]000/.test(mol.comment) && !/^\s*\d+\s+\d+/.test(mol.comment))
    ? mol.comment : null;

  // ── Metadata (all raw properties) ──
  const metadata = Object.assign({}, props);

  // ── Tier 1 — explicit named identifiers (commonly queried) ──
  const dtxsid            = find('dtxsid', 'dtx_id', 'dtxid');
  const preferred_name    = find('preferred_name', 'preferred name');
  const monoisotopic_mass = parseFloat(find('monoisotopic_mass', 'monoisotopic mass', 'exact_mass', 'exact mass')) || null;
  const ms_ready_smiles   = find('ms_ready_smiles', 'ms-ready smiles', 'ms ready smiles');
  const inchi_string      = find('inchi_string', 'inchi string') || inchi || null;

  // ── Synonyms: split the multi-line "Synonyms / Composition" field into an array ──
  const synonymsRaw = find('synonyms', 'synonyms / composition', 'synonym', 'common_names');
  const synonyms = synonymsRaw
    ? String(synonymsRaw).split(/[;,\n]+/).map(function(s) { return s.trim(); }).filter(function(s) { return s.length > 0; })
    : [];

  // ── Tier 3 — structural intelligence ──
  const sGroups = mol.sGroups || [];
  const collections = mol.collections || [];
  const atomsArr = mol.atoms || [];
  const bondsArr = mol.bonds || [];

  // Aggregate charges from atom block
  let totalCharge = 0;
  let chargedAtomCount = 0;
  let radicalCount = 0;
  let stereoAtomCount = 0;
  for (const a of atomsArr) {
    if (a.charge) { totalCharge += a.charge; chargedAtomCount++; }
    if (a.radical) radicalCount++;
    if (a.cfg) stereoAtomCount++;
  }
  let stereoBondCount = 0;
  for (const b of bondsArr) {
    if (b.stereo && b.stereo !== 0) stereoBondCount++;
  }

  // Polymer detection — SRU/MUL S-Groups indicate polymeric repeating units
  const polymerSGroups = sGroups.filter(function(sg) {
    return sg.type === 'SRU' || sg.type === 'MUL' || sg.type === 'COP' || sg.type === 'CRO';
  });
  const isPolymer = polymerSGroups.length > 0;
  const polymerLabels = polymerSGroups.map(function(sg) { return sg.label; }).filter(Boolean);

  // Mixture detection — multiple disconnected components in SMILES (separated by '.')
  // Note: '.' inside [] brackets is rare but ignore it via simple split safely
  let componentCount = 1;
  if (smiles) {
    const cleaned = String(smiles).replace(/\[[^\]]*\]/g, 'X');  // mask atom brackets
    componentCount = cleaned.split('.').filter(function(s) { return s.trim().length > 0; }).length || 1;
  }
  const isMixture = componentCount > 1;

  // Stereochemistry presence: atom CFG, bond stereo, or STERAC/STEREL/STEABS collections
  const hasStereoCollections = collections.some(function(c) {
    return /STEABS|STEREL|STERAC/.test(c);
  });
  const hasStereochemistry = stereoAtomCount > 0 || stereoBondCount > 0 || hasStereoCollections;

  const structural = {
    isPolymer,
    polymerLabels,
    isMixture,
    componentCount,
    hasStereochemistry,
    stereoAtomCount,
    stereoBondCount,
    totalCharge,
    chargedAtomCount,
    radicalCount,
    sGroupCount: sGroups.length,
    sGroupTypes: Array.from(new Set(sGroups.map(function(sg) { return sg.type; })))
  };

  return {
    chemical_id: chemical_id,
    nestle_id: nestle_id,
    name: name,
    cas_number: cas_number ? String(cas_number) : null,
    molecular_formula: molecular_formula,
    molecular_weight: (molecular_weight && !isNaN(molecular_weight))
      ? Math.round(molecular_weight * 1000) / 1000
      : null,
    smiles: smiles || null,
    inchi: inchi || null,
    inchi_key: inchi_key || null,
    supplier: supplier || null,
    purity: purity || null,
    storage_conditions: storage_conditions || null,
    hazard_info: hazard_info || null,
    description: description || safeComment || null,
    mol_block: mol.molBlock || null,
    metadata: metadata,
    // ── Tier 1: explicit named identifiers ──
    dtxsid: dtxsid || null,
    preferred_name: preferred_name || null,
    monoisotopic_mass: monoisotopic_mass,
    ms_ready_smiles: ms_ready_smiles || null,
    inchi_string: inchi_string || null,
    synonyms: synonyms,
    // ── Tier 3: structural intelligence ──
    structural: structural,
    _computed: {
      formula: mol.molecularFormula,
      weight: mol.molecularWeight,
      atomCount: atomsArr.length,
      bondCount: bondsArr.length,
      version: mol.version,
      hasCoordinates3D: atomsArr.some(function(a) { return a.z !== 0; })
    },
    _warnings: mol.warnings
  };
}

module.exports = { parseSDF, mapMoleculeToChemical };
