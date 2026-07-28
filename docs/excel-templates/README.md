# Excel Templates - Crucible: Pandora Toolbox Enhancement (v2.0)

Sample Excel/CSV templates for bulk data import into Crucible.

---

## Available Templates

| Template | File | Description |
|----------|------|-------------|
| **Chemicals** | [chemicals_template.csv](./chemicals_template.csv) | Import chemical compounds |
| **Samples** | [samples_template.csv](./samples_template.csv) | Import physical samples |
| **Screening** | [screening_template.csv](./screening_template.csv) | Import screening results |
| **Toxicology** | [toxicology_template.csv](./toxicology_template.csv) | Import toxicology studies |

---

## How to Use Templates

### 1. Download Template

Download the appropriate CSV template file for your data type.

### 2. Open in Excel/Google Sheets

- **Excel**: File → Open → Select CSV file
- **Google Sheets**: File → Import → Upload CSV

### 3. Fill in Your Data

Replace the example rows with your actual data. Keep the header row exactly as is.

### 4. Save as Excel/CSV

- **Excel**: Save as `.xlsx` or `.csv`
- **Google Sheets**: Download as `.xlsx` or `.csv`

### 5. Upload to Pandora

1. Go to the relevant module (Chemicals, Samples, etc.)
2. Click **"Upload Excel"** button
3. Select your file
4. Review the preview
5. Click **"Import"**

---

## Template Details

### Chemicals Template

**File**: `chemicals_template.csv`

**Required Columns:**
- `DTX_ID` - Chemical identifier (will become `chemical_id`)
- `CHEMICAL_NAME` - Chemical name

**Optional Columns:**
- `NESTLE_ID` - Nestle internal ID
- `CAS_NO` - CAS Registry Number
- `MOL_WEIGHT_ORIG` - Molecular weight (g/mol)
- `MOL_FORMULA` - Molecular formula
- `Supplier_ref` - Supplier reference

**Example:**
```csv
DTX_ID,NESTLE_ID,CHEMICAL_NAME,CAS_NO,MOL_WEIGHT_ORIG,MOL_FORMULA,Supplier_ref
CHEM-001,NST-12345,Caffeine,58-08-2,194.19,C8H10N4O2,Sigma-Aldrich Cat# C0750
```

**Field Mapping:**
- `DTX_ID` → `chemical_id`
- `NESTLE_ID` → `nestle_id`
- `CHEMICAL_NAME` → `name`
- `CAS_NO` → `cas_number`
- `MOL_WEIGHT_ORIG` → `molecular_weight`
- `MOL_FORMULA` → `molecular_formula`
- `Supplier_ref` → `supplier`

---

### Samples Template

**File**: `samples_template.csv`

**Required Columns:**
- `SAMPLE_ID` - Sample identifier
- `SAMPLE_NAME` - Sample name
- `CHEMICAL_ID` - Reference to chemical (must exist)

**Optional Columns:**
- `QUANTITY` - Amount (numeric)
- `UNIT` - Unit of measurement (mg, mL, μg, etc.)
- `CONCENTRATION` - Concentration value
- `CONCENTRATION_UNIT` - Concentration unit (mM, mg/mL, etc.)
- `BATCH_NUMBER` - Batch/lot number
- `STORAGE_LOCATION` - Physical location
- `STORAGE_TEMPERATURE` - Storage temp (-20°C, 4°C, RT)
- `EXPIRY_DATE` - Expiration date (YYYY-MM-DD)

**Example:**
```csv
SAMPLE_ID,SAMPLE_NAME,CHEMICAL_ID,QUANTITY,UNIT,STORAGE_LOCATION
SAMPLE-001,Caffeine Stock,CHEM-001,100,mg,Freezer A1
```

**Important**: The `CHEMICAL_ID` must match an existing chemical in the database.

---

### Screening Template

**File**: `screening_template.csv`

**Required Columns:**
- `CHEMICAL_ID` - Reference to chemical
- `ASSAY_NAME` - Name of the assay

**Optional Columns:**
- `ASSAY_TYPE` - Type/category of assay
- `RESULT` - Qualitative result (Positive/Negative)
- `IC50` - IC50 value (numeric)
- `EC50` - EC50 value (numeric)
- `UNIT` - Concentration unit (μM, nM, etc.)
- `CELL_LINE` - Cell line used
- `ASSAY_DATE` - Date performed (YYYY-MM-DD)
- `OPERATOR` - Person who ran the assay
- `NOTES` - Additional notes

**Example:**
```csv
CHEMICAL_ID,ASSAY_NAME,RESULT,IC50,UNIT,CELL_LINE
CHEM-001,Cytotoxicity (MTT),Positive,10.5,μM,HeLa
```

---

### Toxicology Template

**File**: `toxicology_template.csv`

**Required Columns:**
- `CHEMICAL_ID` - Reference to chemical
- `STUDY_TYPE` - Type of toxicology study

**Optional Columns:**
- `SPECIES` - Test species (Rat, Mouse, Rabbit, etc.)
- `STRAIN` - Animal strain
- `ROUTE` - Administration route (Oral, Dermal, Inhalation)
- `LD50` - LD50 value (numeric)
- `LD50_UNIT` - LD50 unit (mg/kg, etc.)
- `NOAEL` - NOAEL value (numeric)
- `NOAEL_UNIT` - NOAEL unit (mg/kg/day, etc.)
- `DURATION` - Study duration (14 days, 90 days, etc.)
- `STUDY_DATE` - Completion date (YYYY-MM-DD)
- `LAB` - Testing laboratory name
- `GLP_COMPLIANT` - GLP compliance (TRUE/FALSE)
- `FINDINGS` - Key findings text

**Example:**
```csv
CHEMICAL_ID,STUDY_TYPE,SPECIES,ROUTE,LD50,LD50_UNIT
CHEM-001,Acute Toxicity,Rat,Oral,192,mg/kg
```

---

## Data Validation Rules

### Chemical IDs

- Must be unique
- Recommended format: `CHEM-001`, `CHEM-002`, etc.
- Alternative: `DTX12345`, `NST-98765`

### Dates

- Format: `YYYY-MM-DD`
- Example: `2026-02-08`

### Numeric Values

- Use numbers only (no commas)
- Decimals allowed: `194.19`, `10.5`

### Boolean Values

- Use: `TRUE` or `FALSE` (all caps)
- Or: `true` or `false` (lowercase)

### Empty Values

- Leave cell blank for optional fields
- Do NOT use: "N/A", "null", "-"

---

## Common Issues

### Issue: "Chemical ID not found"

**Cause**: Referencing a chemical that doesn't exist in Samples/Screening/Toxicology.

**Solution**: Import chemicals first, then samples/screening/toxicology.

---

### Issue: "Duplicate Chemical ID"

**Cause**: Same chemical ID appears multiple times in upload.

**Solution**: Ensure each `DTX_ID` is unique in the chemicals template.

---

### Issue: "Invalid date format"

**Cause**: Date not in YYYY-MM-DD format.

**Solution**: Use format `2026-02-08`, not `2/8/2026` or `08-Feb-2026`.

---

### Issue: "Column not recognized"

**Cause**: Header row was modified or misspelled.

**Solution**: Keep header row exactly as provided in template.

---

## Tips for Large Imports

### Batch Processing

For >1000 records, split into smaller files (500 records each).

### Validation First

Import a small test file (5-10 rows) first to verify format.

### Backup Database

Before large imports, backup `data/pandora.json`.

### Check Logs

Watch browser console for detailed error messages during import.

---

## Converting from Other Formats

### From SDF Files

Use RDKit or Open Babel to extract:
- SMILES notation
- InChI/InChIKey
- Molecular properties

### From ChEMBL/PubChem

Export as CSV with custom fields, then map columns to template format.

### From Legacy Databases

Export to CSV, use Python/R to transform column names to match template.

---

## Support

For issues with templates or imports:

1. Check [API.md](../API.md) for upload endpoint details
2. See [CONTRIBUTING.md](../CONTRIBUTING.md) for reporting bugs
3. Review browser console for error messages
4. Contact system administrator

---

**Last Updated:** February 8, 2026  
**Template Version:** 2.0
