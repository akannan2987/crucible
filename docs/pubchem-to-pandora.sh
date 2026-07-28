#!/bin/bash
# ============================================================
# PubChem → Crucible: Add chemicals via API
# ============================================================
# Usage:
#   ./docs/pubchem-to-pandora.sh caffeine
#   ./docs/pubchem-to-pandora.sh "58-08-2"
#   ./docs/pubchem-to-pandora.sh aspirin
# ============================================================

# Target Crucible instance; override for a remote deployment, e.g.
#   PANDORA_URL=http://nr-ubp-dev-02.nihs.ch.nestle.com:49160 ./docs/pubchem-to-pandora.sh caffeine
PANDORA_URL="${PANDORA_URL:-http://localhost:49160}"
COMPOUND="${1:?Usage: $0 <compound-name-or-CAS>}"

echo "═══════════════════════════════════════════════════"
echo "  Step 1: Fetching '$COMPOUND' from PubChem..."
echo "═══════════════════════════════════════════════════"

# Fetch from PubChem
PUBCHEM_DATA=$(curl -sk "https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${COMPOUND}/property/IUPACName,MolecularFormula,MolecularWeight,CanonicalSMILES,InChIKey/JSON")

# Check if we got a result
if echo "$PUBCHEM_DATA" | grep -q '"Fault"'; then
    echo "❌ PubChem did not find '$COMPOUND'"
    echo "$PUBCHEM_DATA" | python3 -m json.tool 2>/dev/null
    exit 1
fi

# Parse fields
IUPAC=$(echo "$PUBCHEM_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['PropertyTable']['Properties'][0]; print(d.get('IUPACName',''))")
FORMULA=$(echo "$PUBCHEM_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['PropertyTable']['Properties'][0]; print(d.get('MolecularFormula',''))")
MW=$(echo "$PUBCHEM_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['PropertyTable']['Properties'][0]; print(d.get('MolecularWeight',''))")
SMILES=$(echo "$PUBCHEM_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['PropertyTable']['Properties'][0]; print(d.get('CanonicalSMILES',''))")
INCHIKEY=$(echo "$PUBCHEM_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['PropertyTable']['Properties'][0]; print(d.get('InChIKey',''))")
CID=$(echo "$PUBCHEM_DATA" | python3 -c "import sys,json; d=json.load(sys.stdin)['PropertyTable']['Properties'][0]; print(d.get('CID',''))")

echo "  ✅ Found: $IUPAC"
echo "     Formula: $FORMULA"
echo "     MW: $MW"
echo "     SMILES: $SMILES"
echo "     InChIKey: $INCHIKEY"
echo "     PubChem CID: $CID"
echo ""

echo "═══════════════════════════════════════════════════"
echo "  Step 2: Posting to Crucible..."
echo "═══════════════════════════════════════════════════"

# Use the search term as the display name, IUPAC as description
DISPLAY_NAME="${COMPOUND}"

# Build the JSON payload for Pandora
PAYLOAD=$(python3 -c "
import json
data = {
    'name': '${DISPLAY_NAME}',
    'cas_number': '${COMPOUND}' if '-' in '${COMPOUND}' and len('${COMPOUND}') < 15 else '',
    'molecular_formula': '${FORMULA}',
    'molecular_weight': '${MW}',
    'smiles': '${SMILES}',
    'inchi_key': '${INCHIKEY}',
    'description': '${IUPAC}',
    'metadata': {
        'pubchem_cid': ${CID},
        'source': 'PubChem',
        'iupac_name': '${IUPAC}'
    }
}
# Remove empty fields
data = {k:v for k,v in data.items() if v != '' and v is not None}
print(json.dumps(data, indent=2))
")

echo "  Payload:"
echo "$PAYLOAD" | sed 's/^/    /'
echo ""

# POST to Pandora
RESPONSE=$(curl -sk -X POST "${PANDORA_URL}/api/chemicals" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD")

echo "  Response from Pandora:"
echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"
echo ""

# Check success
if echo "$RESPONSE" | grep -q '"id"'; then
    echo "  ✅ Chemical '$DISPLAY_NAME' added to Pandora successfully!"
else
    echo "  ⚠️  Check the response above for errors."
fi
