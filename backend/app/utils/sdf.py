"""SDF (Structure Data File) handling — RDKit-backed port of server/src/utils/sdfParser.js.

Strategy (and why it differs internally from the JS version while keeping
the same outputs):

* Records are split on the `$$$$` delimiter and the **original MOL block
  text is preserved verbatim** (the JS parser did the same) — RDKit would
  re-generate a differently formatted block, and the stored `mol_block`
  must not change across backends.
* The `> <FIELD>` data items after `M  END` are parsed textually, exactly
  like the JS `parseDataItems` (every field preserved in `metadata`).
* All *structural* intelligence (formula, molecular weight, S-Groups /
  polymer detection, charges, radicals, stereo) is delegated to **RDKit**
  instead of the hand-rolled V2000/V3000 parser. To stay numerically
  compatible with the JS output, formula and weight are computed from the
  EXPLICIT atoms only (molfiles usually omit hydrogens, and the JS parser
  never added implicit ones).
* A molecule RDKit cannot read still produces a usable record from its
  data items (with a warning) — the JS parser was similarly forgiving.

The public functions mirror the JS module: `parse_sdf(content)` returns a
list of molecule dicts and `map_molecule_to_chemical(mol)` maps one to the
Crucible chemical schema. Field-name mapping tables are copied verbatim
from the JS implementation.
"""

import re
from typing import Any, Optional

from rdkit import Chem, RDLogger
from rdkit.Chem import Descriptors  # noqa: F401  (kept for future use)

from ..compat import parse_float_or_none

# RDKit logs warnings for every imperfect molfile; silence them (the API
# reports warnings per-record instead).
RDLogger.DisableLog("rdApp.*")


# ---------------------------------------------------------------------------
# Record splitting and text-level parsing (same behaviour as the JS parser)
# ---------------------------------------------------------------------------

def _split_records(content: str) -> list[str]:
    """Split an SDF file on `$$$$` record delimiters (JS parseSDF)."""
    normalised = content.replace("\r\n", "\n").replace("\r", "\n")
    records = re.split(r"^\$\$\$\$[^\S\n]*$", normalised, flags=re.MULTILINE)
    return [r for r in records if r.strip()]


def _find_m_end(lines: list[str]) -> int:
    """Index of the `M  END` line, or -1."""
    for i, line in enumerate(lines):
        t = line.strip()
        if t.startswith("M  END") or t == "M END":
            return i
    return -1


def _parse_data_items(lines: list[str], m_end_index: int, warnings: list[str]) -> dict[str, str]:
    """Parse `> <FIELD_NAME>` data items after M END (port of JS parseDataItems)."""
    properties: dict[str, str] = {}
    if m_end_index < 0:
        return properties

    current_field: Optional[str] = None
    current_value: list[str] = []

    for i in range(m_end_index + 1, len(lines)):
        line = lines[i]

        if line.startswith(">"):
            if current_field:
                properties[current_field] = "\n".join(current_value).strip()
            match = re.search(r"<\s*(.+?)\s*>", line)
            if match:
                current_field = match.group(1).strip()
                current_value = []
            else:
                warnings.append("Data item header without field name: " + line.strip())
                current_field = f"_UNNAMED_{i}"
                current_value = []
            continue

        if line.strip() == "":
            if current_field:
                properties[current_field] = "\n".join(current_value).strip()
                current_field = None
                current_value = []
            continue

        if current_field:
            current_value.append(line)

    if current_field:
        properties[current_field] = "\n".join(current_value).strip()

    return properties


def _detect_version(lines: list[str]) -> str:
    """V2000 vs V3000, using the counts line plus a body scan fallback."""
    counts_line = lines[3] if len(lines) > 3 else ""
    if "V3000" in counts_line:
        return "V3000"
    if any(re.match(r"^M\s+V30\s", line) for line in lines):
        return "V3000"
    return "V2000"


def _build_hill_formula(atom_counts: dict[str, int]) -> str:
    """Hill order: C first, H second, then alphabetical (port of JS helper)."""
    if not atom_counts:
        return ""
    parts: list[str] = []
    has_carbon = "C" in atom_counts
    if has_carbon:
        parts.append("C" + (str(atom_counts["C"]) if atom_counts["C"] > 1 else ""))
        if "H" in atom_counts:
            parts.append("H" + (str(atom_counts["H"]) if atom_counts["H"] > 1 else ""))
    remaining = sorted(
        sym for sym in atom_counts if not (has_carbon and sym in ("C", "H"))
    )
    for sym in remaining:
        parts.append(sym + (str(atom_counts[sym]) if atom_counts[sym] > 1 else ""))
    return "".join(parts)


# Dummy/placeholder atom symbols skipped in formula/weight (same as JS).
_SKIP_SYMBOLS = {"R", "*", "A", "Q", "Lp", "R#"}


def _analyse_with_rdkit(mol_block: str, warnings: list[str]) -> dict[str, Any]:
    """Extract structure-derived facts from a MOL block using RDKit.

    Returns a dict with atoms/bonds counts, formula, weight, charges,
    radicals, stereo flags and S-Group info. Falls back to zeros/empty when
    RDKit cannot parse the block.
    """
    result: dict[str, Any] = {
        "atom_count": 0,
        "bond_count": 0,
        "formula": "",
        "weight": 0,
        "total_charge": 0,
        "charged_atom_count": 0,
        "radical_count": 0,
        "stereo_atom_count": 0,
        "stereo_bond_count": 0,
        "has_stereo_collections": False,
        "s_groups": [],  # list of {"type": ..., "label": ...}
        "has_coordinates_3d": False,
    }

    # sanitize=False: accept polymers, exotic valences and fragments that a
    # strict chemistry check would reject — the JS parser was permissive too.
    mol = Chem.MolFromMolBlock(mol_block, sanitize=False, removeHs=False)
    if mol is None:
        warnings.append("RDKit could not parse the MOL block — structural data unavailable")
        return result

    pt = Chem.GetPeriodicTable()
    atom_counts: dict[str, int] = {}
    weight = 0.0
    total_charge = 0
    charged = 0
    radicals = 0
    stereo_atoms = 0

    for atom in mol.GetAtoms():
        sym = atom.GetSymbol()
        if atom.GetAtomicNum() == 0 or sym in _SKIP_SYMBOLS:
            continue  # dummy atoms (R groups etc.) are excluded, like the JS parser
        atom_counts[sym] = atom_counts.get(sym, 0) + 1
        weight += pt.GetAtomicWeight(sym)
        charge = atom.GetFormalCharge()
        if charge:
            total_charge += charge
            charged += 1
        if atom.GetNumRadicalElectrons() > 0:
            radicals += 1
        if atom.GetChiralTag() != Chem.ChiralType.CHI_UNSPECIFIED:
            stereo_atoms += 1

    stereo_bonds = 0
    for bond in mol.GetBonds():
        if bond.GetBondDir() != Chem.BondDir.NONE or (
            bond.GetStereo() != Chem.BondStereo.STEREONONE
        ):
            stereo_bonds += 1

    s_groups = []
    for sg in Chem.GetMolSubstanceGroups(mol):
        sg_type = sg.GetProp("TYPE") if sg.HasProp("TYPE") else ""
        sg_label = sg.GetProp("LABEL") if sg.HasProp("LABEL") else None
        s_groups.append({"type": sg_type, "label": sg_label})

    # V3000 enhanced stereo collections (STEABS / STEREL(or) / STERAC(and))
    has_stereo_collections = len(mol.GetStereoGroups()) > 0

    conf = mol.GetConformer() if mol.GetNumConformers() else None
    has_3d = False
    if conf is not None:
        has_3d = any(conf.GetAtomPosition(i).z != 0 for i in range(mol.GetNumAtoms()))

    result.update(
        atom_count=mol.GetNumAtoms(),
        bond_count=mol.GetNumBonds(),
        formula=_build_hill_formula(atom_counts),
        weight=round(weight * 1000) / 1000,
        total_charge=total_charge,
        charged_atom_count=charged,
        radical_count=radicals,
        stereo_atom_count=stereo_atoms,
        stereo_bond_count=stereo_bonds,
        has_stereo_collections=has_stereo_collections,
        s_groups=s_groups,
        has_coordinates_3d=has_3d,
    )
    return result


def parse_sdf(content: str) -> list[dict[str, Any]]:
    """Parse an SDF file into a list of molecule dicts (port of JS parseSDF).

    Each molecule dict carries: name, version, mol_block, properties (all
    `> <FIELD>` items), warnings, and the RDKit-derived `_structure` facts.
    A record that cannot be processed at all gets `_parse_error: True`.
    """
    if not content or not isinstance(content, str):
        return []

    molecules: list[dict[str, Any]] = []

    for record in _split_records(content):
        try:
            # Strip only leading blank lines / trailing whitespace — the SDF
            # header is positional (3 lines before the counts line).
            text = re.sub(r"^\n+", "", record).rstrip()
            lines = text.split("\n")
            if len(lines) < 4:
                continue

            warnings: list[str] = []
            name = lines[0].strip()
            version = _detect_version(lines)
            m_end = _find_m_end(lines)
            if m_end < 0:
                warnings.append("M  END not found")
                m_end = len(lines) - 1

            mol_block = "\n".join(lines[: m_end + 1])
            properties = _parse_data_items(lines, m_end, warnings)
            structure = _analyse_with_rdkit(mol_block, warnings)

            molecules.append(
                {
                    "name": name
                    or properties.get("COMPOUND_NAME")
                    or properties.get("NAME")
                    or properties.get("name")
                    or "Unknown",
                    "version": version,
                    "mol_block": mol_block,
                    "properties": properties,
                    "warnings": warnings,
                    "_structure": structure,
                }
            )
        except Exception as err:  # pragma: no cover — defensive, like the JS parser
            molecules.append(
                {
                    "name": "Parse Error",
                    "mol_block": "",
                    "properties": {},
                    "warnings": [f"Failed to parse record: {err}"],
                    "_structure": None,
                    "_parse_error": True,
                }
            )

    return molecules


# ---------------------------------------------------------------------------
# Field mapping: SDF property names → Crucible chemical schema
# (mapping tables copied verbatim from sdfParser.js mapMoleculeToChemical)
# ---------------------------------------------------------------------------

def _build_lookup(props: dict[str, str]) -> dict[str, str]:
    """Case/underscore/space-insensitive property lookup (JS `lc` map)."""
    lc: dict[str, str] = {}
    for key, val in props.items():
        base = key.lower()
        lc[base] = val
        lc[base.replace("_", " ")] = val
        lc[base.replace(" ", "_")] = val
    return lc


def _finder(lc: dict[str, str]):
    """Return a find(*keys) helper matching the JS behaviour (skip '' values)."""

    def find(*keys: str) -> Optional[str]:
        for k in keys:
            v = lc.get(k.lower())
            if v is not None and v != "":
                return v
        return None

    return find


def map_molecule_to_chemical(mol: dict[str, Any]) -> dict[str, Any]:
    """Map a parsed molecule to the Crucible chemical schema.

    Port of JS mapMoleculeToChemical — same field candidates, same fallbacks,
    same `structural` / `_computed` output shape.
    """
    props = mol.get("properties") or {}
    structure = mol.get("_structure") or {}
    lc = _build_lookup(props)
    find = _finder(lc)

    chemical_id = find(
        "chemical_id", "compound_id", "id", "dtx_id", "dtxsid",
        "pubchem_compound_cid", "chembl_id", "unique_id",
        "substance_id", "registry_number", "catalog_number",
        "nsc_number", "molecule_id", "mol_id",
    )

    name = find(
        "compound_name", "chemical_name", "name", "molecule_name",
        "preferred_name", "common_name", "iupac_name",
        "pubchem_iupac_name", "pubchem_iupac_traditional_name",
        "generic_name", "trade_name", "systematic_name",
    ) or mol.get("name") or "Unknown"

    cas_number = find(
        "cas_number", "cas_no", "cas", "casrn", "cas_rn",
        "cas registry number", "cas_registry_number",
    )

    molecular_formula = find(
        "molecular_formula", "mol_formula", "mol_for", "formula",
        "pubchem_molecular_formula", "molecular formula",
    ) or structure.get("formula") or None

    mw_str = find(
        "molecular_weight", "mol_weight", "mol_weight_orig", "mw",
        "exact_mass", "pubchem_molecular_weight", "pubchem_exact_mass",
        "molecular weight", "monoisotopic_mass", "monoisotopic_weight",
        "pubchem_monoisotopic_weight",
    )
    molecular_weight = (
        parse_float_or_none(mw_str) if mw_str else (structure.get("weight") or None)
    )

    smiles = find(
        "smiles", "canonical_smiles", "isomeric_smiles",
        "pubchem_openeye_can_smiles", "pubchem_openeye_iso_smiles",
        "openeye_can_smiles", "openeye_iso_smiles",
    )

    inchi = find("inchi", "standard_inchi", "pubchem_iupac_inchi", "iupac_inchi")

    inchi_key = find(
        "inchikey", "inchi_key", "standard_inchikey",
        "pubchem_iupac_inchikey", "iupac_inchikey",
    )

    supplier = find(
        "supplier", "vendor", "supplier_ref", "source",
        "manufacturer", "provider", "company",
    )

    nestle_id = find("nestle_id", "nestle id")
    purity = find("purity", "percent_purity", "assay_purity")
    storage_conditions = find(
        "storage_conditions", "storage", "storage_temp",
        "storage_temperature", "storage conditions",
    )
    hazard_info = find(
        "hazard_info", "hazard", "hazard_information", "safety",
        "safety_data", "ghs_hazard", "hazard_classification",
    )
    description = find("description", "comment", "comments", "notes")

    metadata = dict(props)

    # Tier 1 — explicit named identifiers
    dtxsid = find("dtxsid", "dtx_id", "dtxid")
    preferred_name = find("preferred_name", "preferred name")
    monoisotopic_mass = parse_float_or_none(
        find("monoisotopic_mass", "monoisotopic mass", "exact_mass", "exact mass")
    ) or None  # JS `parseFloat(...) || null`: NaN and 0 both become null
    ms_ready_smiles = find("ms_ready_smiles", "ms-ready smiles", "ms ready smiles")
    inchi_string = find("inchi_string", "inchi string") or inchi or None

    synonyms_raw = find("synonyms", "synonyms / composition", "synonym", "common_names")
    synonyms = (
        [s.strip() for s in re.split(r"[;,\n]+", str(synonyms_raw)) if s.strip()]
        if synonyms_raw
        else []
    )

    # Tier 3 — structural intelligence (RDKit-derived)
    s_groups = structure.get("s_groups") or []
    polymer_sgs = [sg for sg in s_groups if sg["type"] in ("SRU", "MUL", "COP", "CRO")]
    is_polymer = len(polymer_sgs) > 0
    polymer_labels = [sg["label"] for sg in polymer_sgs if sg.get("label")]

    # Mixture detection from SMILES, same masking trick as the JS version:
    # atoms in [brackets] may contain '.', so mask them before splitting.
    component_count = 1
    if smiles:
        cleaned = re.sub(r"\[[^\]]*\]", "X", str(smiles))
        component_count = len([s for s in cleaned.split(".") if s.strip()]) or 1
    is_mixture = component_count > 1

    has_stereochemistry = (
        (structure.get("stereo_atom_count") or 0) > 0
        or (structure.get("stereo_bond_count") or 0) > 0
        or bool(structure.get("has_stereo_collections"))
    )

    structural = {
        "isPolymer": is_polymer,
        "polymerLabels": polymer_labels,
        "isMixture": is_mixture,
        "componentCount": component_count,
        "hasStereochemistry": has_stereochemistry,
        "stereoAtomCount": structure.get("stereo_atom_count") or 0,
        "stereoBondCount": structure.get("stereo_bond_count") or 0,
        "totalCharge": structure.get("total_charge") or 0,
        "chargedAtomCount": structure.get("charged_atom_count") or 0,
        "radicalCount": structure.get("radical_count") or 0,
        "sGroupCount": len(s_groups),
        "sGroupTypes": sorted(set(sg["type"] for sg in s_groups), key=lambda t: [s["type"] for s in s_groups].index(t)),
    }

    mw_rounded = None
    if molecular_weight is not None:
        mw_rounded = round(molecular_weight * 1000) / 1000
        if mw_rounded == 0:  # JS `|| null` on falsy 0
            mw_rounded = None

    return {
        "chemical_id": chemical_id,
        "nestle_id": nestle_id,
        "name": name,
        "cas_number": str(cas_number) if cas_number else None,
        "molecular_formula": molecular_formula,
        "molecular_weight": mw_rounded,
        "smiles": smiles or None,
        "inchi": inchi or None,
        "inchi_key": inchi_key or None,
        "supplier": supplier or None,
        "purity": purity or None,
        "storage_conditions": storage_conditions or None,
        "hazard_info": hazard_info or None,
        "description": description or None,
        "mol_block": mol.get("mol_block") or None,
        "metadata": metadata,
        "dtxsid": dtxsid or None,
        "preferred_name": preferred_name or None,
        "monoisotopic_mass": monoisotopic_mass,
        "ms_ready_smiles": ms_ready_smiles or None,
        "inchi_string": inchi_string,
        "synonyms": synonyms,
        "structural": structural,
        "_computed": {
            "formula": structure.get("formula", ""),
            "weight": structure.get("weight", 0),
            "atomCount": structure.get("atom_count", 0),
            "bondCount": structure.get("bond_count", 0),
            "version": mol.get("version"),
            "hasCoordinates3D": bool(structure.get("has_coordinates_3d")),
        },
        "_warnings": mol.get("warnings") or [],
    }
