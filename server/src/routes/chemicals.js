const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { parseSDF, mapMoleculeToChemical } = require('../utils/sdfParser');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Get all chemicals with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').toLowerCase();
    const offset = (page - 1) * limit;

    let chemicals = db.get('chemicals').value() || [];

    if (search) {
      chemicals = chemicals.filter(c =>
        (c.name && c.name.toLowerCase().includes(search)) ||
        (c.chemical_id && c.chemical_id.toLowerCase().includes(search)) ||
        (c.cas_number && c.cas_number.toLowerCase().includes(search))
      );
    }

    chemicals.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = chemicals.length;
    const paginatedChemicals = chemicals.slice(offset, offset + limit);

    res.json({
      data: paginatedChemicals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chemicals list for dropdown
router.get('/list/dropdown', (req, res) => {
  try {
    const chemicals = db.get('chemicals').value() || [];
    const list = chemicals.map(c => ({ chemical_id: c.chemical_id, name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chemical by ID
router.get('/:id', (req, res) => {
  try {
    const chemical = db.get('chemicals').find({ chemical_id: req.params.id }).value();
    if (!chemical) {
      return res.status(404).json({ error: 'Chemical not found' });
    }
    res.json(chemical);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add single chemical
router.post('/', (req, res) => {
  try {
    const existing = db.get('chemicals').find({ chemical_id: req.body.chemical_id }).value();
    if (existing) {
      return res.status(400).json({ error: 'Chemical ID already exists' });
    }

    const chemical = {
      id: uuidv4(),
      chemical_id: req.body.chemical_id,
      nestle_id: req.body.nestle_id || null,
      name: req.body.name,
      cas_number: req.body.cas_number || null,
      molecular_formula: req.body.molecular_formula || null,
      molecular_weight: req.body.molecular_weight || null,
      smiles: req.body.smiles || null,
      inchi: req.body.inchi || null,
      inchi_key: req.body.inchi_key || null,
      supplier: req.body.supplier || null,
      description: req.body.description || null,
      metadata: req.body.metadata || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('chemicals').push(chemical).write();
    res.status(201).json({ message: 'Chemical added successfully', chemical_id: chemical.chemical_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload SDF file
router.post('/upload/sdf', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sdfContent = req.file.buffer.toString('utf-8');

    // Parse the SDF file using the spec-compliant parser
    const molecules = parseSDF(sdfContent);

    if (molecules.length === 0) {
      return res.status(400).json({
        error: 'No valid molecules found in the SDF file. Ensure the file follows the V2000/V3000 SDF format with $$$$ record delimiters.'
      });
    }

    let inserted = 0;
    let updated = 0;
    let parseErrors = [];
    let errors = [];

    for (let idx = 0; idx < molecules.length; idx++) {
      const mol = molecules[idx];

      // Skip molecules that failed to parse
      if (mol._parseError) {
        parseErrors.push({
          molecule: `Record #${idx + 1}`,
          error: (mol.warnings || []).join('; ') || 'Failed to parse'
        });
        continue;
      }

      try {
        // Use the intelligent field mapper to convert SDF data → Pandora schema
        const mapped = mapMoleculeToChemical(mol);

        // Generate a chemical_id if not found in the SDF properties
        const chemicalId = mapped.chemical_id || `SDF-${Date.now()}-${idx}`;

        const existing = db.get('chemicals').find({ chemical_id: chemicalId }).value();

        const chemical = {
          id: existing ? existing.id : uuidv4(),
          chemical_id: chemicalId,
          nestle_id: mapped.nestle_id || null,
          name: mapped.name || 'Unknown',
          cas_number: mapped.cas_number || null,
          molecular_formula: mapped.molecular_formula || null,
          molecular_weight: mapped.molecular_weight || null,
          smiles: mapped.smiles || null,
          inchi: mapped.inchi || null,
          inchi_key: mapped.inchi_key || null,
          supplier: mapped.supplier || null,
          purity: mapped.purity || null,
          storage_conditions: mapped.storage_conditions || null,
          hazard_info: mapped.hazard_info || null,
          description: mapped.description || null,
          mol_block: mapped.mol_block || null,
          metadata: mapped.metadata || {},
          // Tier 1 — explicit named identifiers
          dtxsid: mapped.dtxsid || null,
          preferred_name: mapped.preferred_name || null,
          monoisotopic_mass: mapped.monoisotopic_mass || null,
          ms_ready_smiles: mapped.ms_ready_smiles || null,
          inchi_string: mapped.inchi_string || null,
          synonyms: mapped.synonyms || [],
          // Tier 3 — structural intelligence
          structural: mapped.structural || null,
          created_at: existing ? existing.created_at : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existing) {
          db.get('chemicals').find({ chemical_id: chemicalId }).assign(chemical).write();
          updated++;
        } else {
          db.get('chemicals').push(chemical).write();
          inserted++;
        }
      } catch (err) {
        errors.push({
          molecule: mol.name || `Record #${idx + 1}`,
          error: err.message
        });
      }
    }

    const allErrors = [...parseErrors, ...errors];

    res.json({
      message: `Successfully processed ${inserted + updated} chemicals from SDF (${inserted} new, ${updated} updated)`,
      inserted,
      updated,
      total: inserted + updated,
      totalRecords: molecules.length,
      errors: allErrors.length > 0 ? allErrors : undefined,
      summary: {
        recordsInFile: molecules.length,
        successfullyProcessed: inserted + updated,
        parseErrors: parseErrors.length,
        insertErrors: errors.length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Excel file
router.post('/upload/excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Detect file type — CSV files are parsed manually to prevent the xlsx
    // library from auto-detecting date-like strings (e.g. CAS "58-08-2" → date serial 21399)
    const fileName = (req.file.originalname || '').toLowerCase();
    const isCSV = fileName.endsWith('.csv') || fileName.endsWith('.tsv');

    let data;
    if (isCSV) {
      const text = req.file.buffer.toString('utf-8');
      const lines = text.split(/\r?\n/).filter(l => l.trim());
      if (lines.length < 2) {
        return res.status(400).json({ error: 'CSV file is empty or has no data rows' });
      }
      // Simple RFC-4180 CSV line parser (handles quoted fields)
      const parseLine = (line) => {
        const result = [];
        let cur = '', inQ = false;
        for (let i = 0; i < line.length; i++) {
          const ch = line[i];
          if (inQ) {
            if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
            else if (ch === '"') { inQ = false; }
            else { cur += ch; }
          } else {
            if (ch === '"') { inQ = true; }
            else if (ch === ',') { result.push(cur.trim()); cur = ''; }
            else { cur += ch; }
          }
        }
        result.push(cur.trim());
        return result;
      };
      const headers = parseLine(lines[0]);
      data = [];
      for (let i = 1; i < lines.length; i++) {
        const values = parseLine(lines[i]);
        const row = {};
        headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
        data.push(row);
      }
    } else {
      // Excel (.xlsx / .xls) — use xlsx with raw:false for formatted strings
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      data = XLSX.utils.sheet_to_json(worksheet, { raw: false, defval: '' });
    }

    let inserted = 0;
    let updated = 0;
    let errors = [];

    for (const row of data) {
      try {
        // Map Excel columns to database fields (supporting your template format)
        // DTX_ID maps to chemical_id, NESTLE_ID is kept as separate field
        const chemicalId = row['DTX_ID'] || row['dtx_id'] || row['Dtx_ID'] ||
          row['chemical_id'] || row['Chemical_ID'] || row['ID'] ||
          `CHEM-${Date.now()}-${inserted}`;

        const nestleId = row['NESTLE_ID'] || row['Nestle_ID'] || row['nestle_id'] || null;

        const casNumber = row['CAS_NO'] || row['CAS_Number'] || row['cas_no'] ||
          row['cas_number'] || row['CAS'] || null;

        const name = row['CHEMICAL_NAME'] || row['Chemical_Name'] || row['chemical_name'] ||
          row['Name'] || row['name'] || 'Unknown';

        const molWeight = row['MOL_WEIGHT_ORIG'] || row['MOL_WEIGHT'] || row['Mol_Weight'] || row['mol_weight'] ||
          row['MW'] || row['molecular_weight'] || row['Molecular_Weight'] || null;

        const molFormula = row['MOL_FORMULA'] || row['MOL_FOR'] || row['Mol_For'] || row['mol_for'] ||
          row['molecular_formula'] || row['Molecular_Formula'] || row['Formula'] || null;

        const supplierRef = row['Supplier_ref'] || row['SUPPLIER_REF'] || row['supplier_ref'] ||
          row['Supplier'] || row['supplier'] || null;

        const existing = db.get('chemicals').find({ chemical_id: chemicalId }).value();

        const chemical = {
          id: existing ? existing.id : uuidv4(),
          chemical_id: chemicalId,
          nestle_id: nestleId,
          name: name,
          cas_number: casNumber ? String(casNumber) : null,
          molecular_formula: molFormula,
          molecular_weight: molWeight ? parseFloat(molWeight) : null,
          smiles: row['SMILES'] || row['smiles'] || null,
          inchi: row['InChI'] || row['inchi'] || null,
          inchi_key: row['InChIKey'] || row['inchi_key'] || null,
          supplier: supplierRef,
          description: row['Description'] || row['description'] || null,
          metadata: row,
          created_at: existing ? existing.created_at : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existing) {
          db.get('chemicals').find({ chemical_id: chemicalId }).assign(chemical).write();
          updated++;
        } else {
          db.get('chemicals').push(chemical).write();
          inserted++;
        }
      } catch (err) {
        errors.push({ row: row['CHEMICAL_NAME'] || row['Name'] || 'Unknown', error: err.message });
      }
    }

    res.json({
      message: `Successfully processed ${inserted + updated} chemicals (${inserted} new, ${updated} updated)`,
      inserted,
      updated,
      total: inserted + updated,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete chemicals
router.post('/bulk/delete', (req, res) => {
  try {
    const { chemical_ids } = req.body;
    if (!chemical_ids || !Array.isArray(chemical_ids) || chemical_ids.length === 0) {
      return res.status(400).json({ error: 'No chemical IDs provided' });
    }

    let deleted = 0;
    for (const id of chemical_ids) {
      const chemical = db.get('chemicals').find({ chemical_id: id }).value();
      if (chemical) {
        db.get('chemicals').remove({ chemical_id: id }).write();
        deleted++;
      }
    }

    res.json({
      message: `Successfully deleted ${deleted} chemicals`,
      deleted,
      requested: chemical_ids.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk update chemicals
router.post('/bulk/update', (req, res) => {
  try {
    const { chemical_ids, updates } = req.body;
    if (!chemical_ids || !Array.isArray(chemical_ids) || chemical_ids.length === 0) {
      return res.status(400).json({ error: 'No chemical IDs provided' });
    }
    if (!updates || Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    // Don't allow updating chemical_id
    delete updates.chemical_id;
    delete updates.id;
    delete updates.created_at;

    let updated = 0;
    for (const id of chemical_ids) {
      const chemical = db.get('chemicals').find({ chemical_id: id }).value();
      if (chemical) {
        db.get('chemicals').find({ chemical_id: id })
          .assign({ ...updates, updated_at: new Date().toISOString() }).write();
        updated++;
      }
    }

    res.json({
      message: `Successfully updated ${updated} chemicals`,
      updated,
      requested: chemical_ids.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all chemicals
router.delete('/all/clear', (req, res) => {
  try {
    const count = db.get('chemicals').value().length;
    db.set('chemicals', []).write();
    res.json({ message: `Successfully deleted all ${count} chemicals`, deleted: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update chemical
router.put('/:id', (req, res) => {
  try {
    const chemical = db.get('chemicals').find({ chemical_id: req.params.id }).value();
    if (!chemical) {
      return res.status(404).json({ error: 'Chemical not found' });
    }

    db.get('chemicals').find({ chemical_id: req.params.id })
      .assign({ ...req.body, updated_at: new Date().toISOString() }).write();
    res.json({ message: 'Chemical updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete chemical
router.delete('/:id', (req, res) => {
  try {
    const chemical = db.get('chemicals').find({ chemical_id: req.params.id }).value();
    if (!chemical) {
      return res.status(404).json({ error: 'Chemical not found' });
    }

    db.get('chemicals').remove({ chemical_id: req.params.id }).write();
    res.json({ message: 'Chemical deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
