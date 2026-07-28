/**
 * SDF Parser — Unit Tests
 *
 * Verifies that all tiers of metadata extraction work on a realistic
 * V3000 SDF record modelled after the EPA DSSTox + Nestlé regulatory
 * database format (multiple components, polymer SRU, stereochemistry,
 * charged atoms, and 40+ regulatory property fields).
 */
const { parseSDF, mapMoleculeToChemical } = require('../src/utils/sdfParser');

// ─── Fixture: a single SDF record covering all parser capabilities ──────────
const SDF_FIXTURE = `Thiram
  Pandora2.0   06012506012D

  0  0  0  0  0  0            999 V3000
M  V30 BEGIN CTAB
M  V30 COUNTS 8 7 1 0 0
M  V30 BEGIN ATOM
M  V30 1 S 0.000 0.000 0.000 0 CFG=1
M  V30 2 C 1.000 0.000 0.000 0
M  V30 3 S 2.000 0.000 0.000 0 CHG=-1
M  V30 4 N 1.000 1.000 0.000 0
M  V30 5 C 3.000 0.000 0.000 0
M  V30 6 S 4.000 0.000 0.000 0
M  V30 7 S 5.000 0.000 0.000 0 CFG=2
M  V30 8 N 3.000 1.000 0.000 0
M  V30 END ATOM
M  V30 BEGIN BOND
M  V30 1 1 1 2
M  V30 2 2 2 3 CFG=1
M  V30 3 1 2 4
M  V30 4 1 1 5
M  V30 5 1 5 6
M  V30 6 2 5 7
M  V30 7 1 5 8
M  V30 END BOND
M  V30 BEGIN SGROUP
M  V30 1 SRU 0 ATOMS=(2 1 2) LABEL=n CONNECT=HT
M  V30 END SGROUP
M  V30 BEGIN COLLECTION
M  V30 MDLV30/STEABS ATOMS=(2 1 7)
M  V30 END COLLECTION
M  V30 END CTAB
M  END
>  <DTXSID>
DTXSID5021297

>  <PREFERRED_NAME>
Thiram

>  <CAS Number>
137-26-8

>  <Chemical name>
Tetramethylthiuram disulfide

>  <Synonyms / Composition>
Thiram; TMTD; Thioperoxydicarbonic diamide; Tetramethylthiuram disulfide

>  <SMILES>
CN(C)C(=S)SSC(=S)N(C)C.[Na+].[Cl-]

>  <MS_READY_SMILES>
CN(C)C(=S)SSC(=S)N(C)C

>  <INCHI_STRING>
InChI=1S/C6H12N2S4/c1-7(2)5(9)11-12-6(10)8(3)4/h1-4H3

>  <Molecular Formula>
C6H12N2S4

>  <Exact Molecular Weight>
240.43

>  <MONOISOTOPIC_MASS>
239.9883

>  <Present in PLASTIC>
Yes

>  <Present in COATING>
Yes

>  <Present in INK>
No

>  <EU FCM substance code>
FCM 123

>  <Restrictions and Specifications (SML in mg/kg)>
SML = 0.05

>  <Nestle policy (St-80.008 and ink guidance note)>
Restricted use — see policy ST-80.008

>  <Nestle safety-based level SBL (mg/kg food)>
0.01

>  <log P(o/w) (25\u00b0C)>
1.73

$$$$
`;

describe('SDF Parser — Core parsing', () => {
  const molecules = parseSDF(SDF_FIXTURE);

  it('parses exactly one molecule record', () => {
    expect(molecules).toHaveLength(1);
  });

  it('extracts molecule name from header line 1', () => {
    expect(molecules[0].name).toBe('Thiram');
  });

  it('detects V3000 version', () => {
    expect(molecules[0].version).toBe('V3000');
  });

  it('parses all 8 atoms', () => {
    expect(molecules[0].atoms).toHaveLength(8);
  });

  it('parses all 7 bonds', () => {
    expect(molecules[0].bonds).toHaveLength(7);
  });
});

describe('SDF Parser — Tier 3 structural intelligence', () => {
  const molecules = parseSDF(SDF_FIXTURE);
  const mol = molecules[0];

  it('captures S-Groups (polymer SRU detection)', () => {
    expect(mol.sGroups).toHaveLength(1);
    expect(mol.sGroups[0].type).toBe('SRU');
    expect(mol.sGroups[0].label).toBe('n');
    expect(mol.sGroups[0].connect).toBe('HT');
    expect(mol.sGroups[0].atomIndices).toEqual([1, 2]);
  });

  it('captures stereo collections (STEABS/STEREL/STERAC)', () => {
    expect(mol.collections.length).toBeGreaterThan(0);
    expect(mol.collections.join(' ')).toMatch(/STEABS/);
  });

  it('captures atom CFG (stereo) flags', () => {
    const stereoAtoms = mol.atoms.filter(a => a.cfg && a.cfg !== 0);
    expect(stereoAtoms.length).toBeGreaterThanOrEqual(2);
  });

  it('captures atom CHG (charge) values', () => {
    const negAtom = mol.atoms.find(a => a.charge === -1);
    expect(negAtom).toBeDefined();
    expect(negAtom.symbol).toBe('S');
  });

  it('captures bond CFG (stereo wedge) on V3000', () => {
    const stereoBond = mol.bonds.find(b => b.stereo === 1);
    expect(stereoBond).toBeDefined();
  });
});

describe('SDF Parser — Tier 1 explicit named identifiers', () => {
  const molecules = parseSDF(SDF_FIXTURE);
  const mapped = mapMoleculeToChemical(molecules[0]);

  it('extracts DTXSID', () => {
    expect(mapped.dtxsid).toBe('DTXSID5021297');
  });

  it('extracts PREFERRED_NAME', () => {
    expect(mapped.preferred_name).toBe('Thiram');
  });

  it('extracts MS_READY_SMILES', () => {
    expect(mapped.ms_ready_smiles).toBe('CN(C)C(=S)SSC(=S)N(C)C');
  });

  it('extracts MONOISOTOPIC_MASS as a number', () => {
    expect(mapped.monoisotopic_mass).toBeCloseTo(239.9883, 3);
  });

  it('extracts INCHI_STRING', () => {
    expect(mapped.inchi_string).toContain('InChI=1S/');
  });

  it('splits synonyms into an array', () => {
    expect(Array.isArray(mapped.synonyms)).toBe(true);
    expect(mapped.synonyms.length).toBeGreaterThanOrEqual(3);
    expect(mapped.synonyms).toContain('Thiram');
    expect(mapped.synonyms).toContain('TMTD');
  });
});

describe('SDF Parser — Structural intelligence aggregation', () => {
  const molecules = parseSDF(SDF_FIXTURE);
  const mapped = mapMoleculeToChemical(molecules[0]);

  it('flags is_polymer when SRU S-Group is present', () => {
    expect(mapped.structural.isPolymer).toBe(true);
    expect(mapped.structural.polymerLabels).toContain('n');
  });

  it('detects mixture from SMILES (multi-component .)', () => {
    expect(mapped.structural.isMixture).toBe(true);
    expect(mapped.structural.componentCount).toBe(3);   // Thiram . Na+ . Cl-
  });

  it('flags has_stereochemistry when atom CFG or collections present', () => {
    expect(mapped.structural.hasStereochemistry).toBe(true);
  });

  it('aggregates total atomic charge', () => {
    expect(mapped.structural.totalCharge).toBe(-1);
    expect(mapped.structural.chargedAtomCount).toBe(1);
  });

  it('exposes sGroupCount and sGroupTypes', () => {
    expect(mapped.structural.sGroupCount).toBe(1);
    expect(mapped.structural.sGroupTypes).toContain('SRU');
  });
});

describe('SDF Parser — Catch-all metadata preservation', () => {
  const molecules = parseSDF(SDF_FIXTURE);
  const mapped = mapMoleculeToChemical(molecules[0]);

  it('preserves ALL raw SDF properties in metadata', () => {
    expect(mapped.metadata['DTXSID']).toBe('DTXSID5021297');
    expect(mapped.metadata['Present in PLASTIC']).toBe('Yes');
    expect(mapped.metadata['EU FCM substance code']).toBe('FCM 123');
    expect(mapped.metadata['Nestle policy (St-80.008 and ink guidance note)']).toMatch(/ST-80\.008/);
    expect(mapped.metadata['Nestle safety-based level SBL (mg/kg food)']).toBe('0.01');
  });

  it('preserves multi-line synonyms in raw metadata', () => {
    expect(mapped.metadata['Synonyms / Composition']).toContain('TMTD');
  });

  it('extracts the SML restriction', () => {
    expect(mapped.metadata['Restrictions and Specifications (SML in mg/kg)']).toBe('SML = 0.05');
  });
});
