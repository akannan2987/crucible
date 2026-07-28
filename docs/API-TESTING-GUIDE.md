# API Testing Guide - Crucible: Pandora Toolbox Enhancement (v2.0)

## Quick Start

### What does "external API" mean here?

Pandora can fetch chemical data from **PubChem** (a free public database) instead of you typing it manually. You search by CAS number or compound name, and PubChem returns the molecular formula, weight, synonyms, etc.

---

## Method 1: Using `curl` (simplest)

Open a terminal and run:

```bash
# Look up Caffeine by name
curl -s "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/caffeine/property/MolecularFormula,MolecularWeight,IUPACName/JSON"

# Look up by CAS number (e.g., 58-08-2 = Caffeine)
curl -s "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/58-08-2/property/MolecularFormula,MolecularWeight,IUPACName/JSON"

# Look up Aspirin
curl -s "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/aspirin/property/MolecularFormula,MolecularWeight,IUPACName/JSON"
```

You should see JSON output like:
```json
{
  "PropertyTable": {
    "Properties": [{
      "CID": 2519,
      "MolecularFormula": "C8H10N4O2",
      "MolecularWeight": 194.19,
      "IUPACName": "1,3,7-trimethylpurine-2,6-dione"
    }]
  }
}
```

---

## Method 2: Using the demo script

We have a ready-made Node.js script that runs multiple lookups:

```bash
cd /path/to/crucible

# Run the demo (NODE_TLS_REJECT_UNAUTHORIZED=0 is needed on our corporate network)
NODE_TLS_REJECT_UNAUTHORIZED=0 node docs/api-demo.js
```

This will:
1. Look up Caffeine by CAS number (58-08-2)
2. Look up Aspirin by name
3. Look up Vanillin by name
4. Get synonyms for CID 2519
5. Search by SMILES string "CCO" (ethanol)

---

## Method 3: Test from your browser

Paste this URL directly in your browser:

```
https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/caffeine/property/MolecularFormula,MolecularWeight,IUPACName/JSON
```

You'll see the JSON response right in the browser.

---

## Method 4: Using Python (`requests`)

The same PubChem lookup from Python — useful as the starting point for your
own scripts:

```python
import requests

name = "caffeine"   # or a CAS number like "58-08-2"
url = (
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
    f"{name}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey/JSON"
)
response = requests.get(url, timeout=30)
props = response.json()["PropertyTable"]["Properties"][0]

print(props["MolecularFormula"])   # C8H10N4O2
print(props["MolecularWeight"])    # 194.19
print(props["InChIKey"])           # RYYVLZVUVIJVGH-UHFFFAOYSA-N
```

> 📚 **For plain Crucible CRUD from Python** (create/read/update/delete
> chemicals with `requests`, step by step, including error handling, bulk
> operations and file uploads), see
> [API.md → "Python (Requests) — step-by-step guide"](../API.md#python-requests--step-by-step-guide).
> This guide only covers the PubChem-specific workflows.

---

## How this could work inside Pandora (proposed — not yet implemented)

> ⚠️ **Not implemented today.** The Pandora server does **not** expose a PubChem lookup endpoint. The `curl`/script methods above call PubChem **directly**, independently of the Pandora API.

A future enhancement could let a user type a CAS number and have the **backend** (Express today, FastAPI after the Python migration) call PubChem to auto-fill the details. The intended flow would be:

```
User enters CAS → React Frontend → Backend API → PubChem API → Returns data → Auto-fills form
```

That would require a new backend route (e.g., `/api/chemicals/lookup/:cas`), which does not exist in the current codebase (neither in the Express nor the FastAPI implementation).

---

## PubChem API URL Patterns

| What you want | URL |
|---|---|
| Search by name | `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{NAME}/property/MolecularFormula,MolecularWeight,IUPACName/JSON` |
| Search by CAS | Same as above, use CAS as the name |
| Get synonyms | `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/{CID}/synonyms/JSON` |
| Search by SMILES | `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/{SMILES}/property/MolecularFormula,MolecularWeight,IUPACName/JSON` |

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `curl` works but `node` doesn't | Add `NODE_TLS_REJECT_UNAUTHORIZED=0` before the command |
| No response / timeout | Check if you're behind a proxy; try `export https_proxy=http://your-proxy:port` |
| 404 from PubChem | The compound name/CAS wasn't found — check spelling |

---

## Adding Chemicals from PubChem into Pandora (End-to-End)

This is the full workflow: fetch data from PubChem → insert into Pandora's database via API.

### One-command script

```bash
cd /path/to/crucible

# Add by compound name (targets http://localhost:49160 by default;
# override with PANDORA_URL=http://nr-ubp-dev-02.nihs.ch.nestle.com:49160):
./docs/pubchem-to-pandora.sh caffeine

# Add by CAS number:
./docs/pubchem-to-pandora.sh "50-78-2"

# Add by any identifier PubChem recognizes:
./docs/pubchem-to-pandora.sh vanillin
```

### What the script does (step by step)

| Step | Action | Command |
|------|--------|---------|
| 1 | Fetch from PubChem | `curl -s "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/{NAME}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey/JSON"` |
| 2 | Parse JSON response | Extracts formula, MW, SMILES, InChIKey, IUPAC name using `python3` |
| 3 | POST to Pandora | `curl -sk -X POST "https://nr-ubp-dev-02.nihs.ch.nestle.com:49160/api/chemicals" -H "Content-Type: application/json" -d '{...}'` |

### Example: Adding Caffeine

```bash
$ ./docs/pubchem-to-pandora.sh caffeine

Step 1: Fetching 'caffeine' from PubChem...
  ✅ Found: 1,3,7-trimethylpurine-2,6-dione
     Formula: C8H10N4O2
     MW: 194.19
     InChIKey: RYYVLZVUVIJVGH-UHFFFAOYSA-N
     PubChem CID: 2519

Step 2: Posting to Crucible...
  Payload:
    {
      "name": "caffeine",
      "molecular_formula": "C8H10N4O2",
      "molecular_weight": "194.19",
      "inchi_key": "RYYVLZVUVIJVGH-UHFFFAOYSA-N",
      "description": "1,3,7-trimethylpurine-2,6-dione",
      "metadata": { "pubchem_cid": 2519, "source": "PubChem" }
    }

  Response: { "message": "Chemical added successfully" }
  ✅ Chemical 'caffeine' added to Pandora successfully!
```

### Manual curl (without the script)

If you want to do it manually in two steps (use the VM hostname instead of
`localhost` when targeting the deployed instance):

```bash
# Step 1: Get data from PubChem
curl -s "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/caffeine/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey/JSON"

# Step 2: POST to Crucible (fill in the values from step 1)
curl -s -X POST "http://localhost:49160/api/chemicals" \
  -H "Content-Type: application/json" \
  -d '{
    "chemical_id": "PUBCHEM-2519",
    "name": "caffeine",
    "cas_number": "58-08-2",
    "molecular_formula": "C8H10N4O2",
    "molecular_weight": 194.19,
    "inchi_key": "RYYVLZVUVIJVGH-UHFFFAOYSA-N",
    "description": "1,3,7-trimethylpurine-2,6-dione",
    "metadata": {"pubchem_cid": 2519, "source": "PubChem"}
  }'
```

### Python version (requests) — the whole flow in one script

```python
"""Fetch a compound from PubChem and insert it into Crucible."""
import requests

PANDORA = "http://localhost:49160/api"   # or the VM URL
query = "vanillin"                        # name or CAS number

# Step 1: fetch properties from PubChem
pubchem_url = (
    "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/"
    f"{query}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey/JSON"
)
props = requests.get(pubchem_url, timeout=30).json()["PropertyTable"]["Properties"][0]

# Step 2: build the Crucible record.
# Tip: give it an explicit chemical_id (e.g. from the PubChem CID) — that is
# what makes re-runs detectable as duplicates instead of silent extra rows.
chemical = {
    "chemical_id": f"PUBCHEM-{props['CID']}",
    "name": query,
    "molecular_formula": props.get("MolecularFormula"),
    "molecular_weight": float(props.get("MolecularWeight", 0)) or None,
    "smiles": props.get("CanonicalSMILES"),
    "inchi_key": props.get("InChIKey"),
    "description": props.get("IUPACName"),
    "metadata": {"pubchem_cid": props["CID"], "source": "PubChem"},
}

# Step 3: POST it
r = requests.post(f"{PANDORA}/chemicals", json=chemical)
if r.status_code == 201:
    print("Added:", r.json()["chemical_id"])
elif r.status_code == 400:
    print("Skipped:", r.json()["error"])      # e.g. already exists
else:
    r.raise_for_status()

# Step 4: verify
doc = requests.get(f"{PANDORA}/chemicals/PUBCHEM-{props['CID']}").json()
print("In database:", doc["name"], "|", doc["molecular_formula"], "| MW", doc["molecular_weight"])
```

### Verify it was added

```bash
# List chemicals (works the same against localhost or the VM)
curl -s "http://localhost:49160/api/chemicals?search=vanillin" | python3 -m json.tool
```

### Pandora Chemical API Fields

| Field | Description | Example |
|-------|-------------|---------|
| `name` | Display name (required) | `caffeine` |
| `cas_number` | CAS registry number | `58-08-2` |
| `molecular_formula` | Chemical formula | `C8H10N4O2` |
| `molecular_weight` | Molecular weight | `194.19` |
| `smiles` | SMILES notation | `Cn1cnc2c1c(=O)n(c(=O)n2C)C` |
| `inchi_key` | InChI Key | `RYYVLZVUVIJVGH-UHFFFAOYSA-N` |
| `description` | Free text / IUPAC name | `1,3,7-trimethylpurine-2,6-dione` |
| `metadata` | Any extra JSON data | `{"pubchem_cid": 2519}` |

---

## Summary of what we tested

On **May 13, 2026**, we ran `docs/api-demo.js` and confirmed:

| Query | Result |
|---|---|
| CAS 58-08-2 | ✅ Caffeine, CID 2519, C₈H₁₀N₄O₂, MW 194.19 |
| "Aspirin" | ✅ 2-acetyloxybenzoic acid, CID 2244, C₉H₈O₄, MW 180.16 |
| "Vanillin" | ✅ 4-hydroxy-3-methoxybenzaldehyde, CID 1183, C₈H₈O₃, MW 152.15 |
| CID 2519 synonyms | ✅ caffeine, Guaranine, 1,3,7-Trimethylxanthine, Theine... |
| SMILES "CCO" | ✅ Ethanol, CID 702, C₂H₆O, MW 46.07 |

We also confirmed **end-to-end PubChem → Pandora insertion**:

| Compound | Added to Pandora? |
|----------|-------------------|
| caffeine | ✅ Successfully added |
| 50-78-2 (Aspirin) | ⚠️ Already existed in DB |
