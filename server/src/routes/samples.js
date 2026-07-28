const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');
const { parseSamplesSheet, mapRowToSample } = require('../utils/samplesParser');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// Absolute path to the SLIMS sample template that ships with the app.
const SAMPLE_TEMPLATE_PATH = path.join(
  __dirname,
  '../../../docs/excel-templates/samples/Upload_Sample template_PIPM00617.xlsx'
);

// Get all samples with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').toLowerCase();
    const offset = (page - 1) * limit;

    let samples = db.get('samples').value() || [];

    if (search) {
      samples = samples.filter(s =>
        (s.name && s.name.toLowerCase().includes(search)) ||
        (s.sample_id && s.sample_id.toLowerCase().includes(search)) ||
        (s.identification && s.identification.toLowerCase().includes(search)) ||
        (s.project_number && s.project_number.toLowerCase().includes(search)) ||
        (s.content_type && s.content_type.toLowerCase().includes(search)) ||
        (s.material_type && s.material_type.toLowerCase().includes(search))
      );
    }

    samples.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = samples.length;
    const paginatedSamples = samples.slice(offset, offset + limit);

    res.json({
      data: paginatedSamples,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download the SLIMS sample upload template (.xlsx)
router.get('/template/download', (req, res) => {
  try {
    if (!fs.existsSync(SAMPLE_TEMPLATE_PATH)) {
      return res.status(404).json({ error: 'Sample template file not found on server' });
    }
    res.download(SAMPLE_TEMPLATE_PATH, 'Upload_Sample_Template.xlsx', (err) => {
      if (err && !res.headersSent) {
        res.status(500).json({ error: 'Failed to send template file' });
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sample by ID
router.get('/:id', (req, res) => {
  try {
    const sample = db.get('samples').find({ sample_id: req.params.id }).value();
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }
    res.json(sample);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add single sample
router.post('/', (req, res) => {
  try {
    const existing = db.get('samples').find({ sample_id: req.body.sample_id }).value();
    if (existing) {
      return res.status(400).json({ error: 'Sample ID already exists' });
    }

    const sample = {
      id: uuidv4(),
      ...req.body,
      status: req.body.status || 'active',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('samples').push(sample).write();
    res.status(201).json({ message: 'Sample added successfully', sample_id: sample.sample_id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload Excel file (SLIMS sample template)
router.post('/upload/excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Parse the SLIMS workbook (handles the 3-row header automatically).
    const { records, sheetName, warnings } = parseSamplesSheet(req.file.buffer);

    if (!records || records.length === 0) {
      return res.status(400).json({
        error: 'No sample rows found in the file. Ensure it is the SLIMS sample template ' +
          'with the machine-key header row (cntn_barCode, cntn_id, …).'
      });
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (const rawRow of records) {
      try {
        const mapped = mapRowToSample(rawRow);

        // Skip rows we cannot uniquely identify (no Barcode/sample_id).
        if (!mapped.sample_id) {
          skipped++;
          errors.push({ row: rawRow._rowNumber || null, error: 'Missing Barcode (sample_id) — row skipped' });
          continue;
        }

        const existing = db.get('samples').find({ sample_id: mapped.sample_id }).value();

        const sample = {
          id: existing ? existing.id : uuidv4(),
          ...mapped,
          // Preserve manual chemical links made in the app on re-upload.
          chemical_ids: existing && Array.isArray(existing.chemical_ids)
            ? existing.chemical_ids
            : (mapped.chemical_ids || []),
          created_at: existing ? existing.created_at : new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (existing) {
          db.get('samples').find({ sample_id: mapped.sample_id }).assign(sample).write();
          updated++;
        } else {
          db.get('samples').push(sample).write();
          inserted++;
        }
      } catch (err) {
        errors.push({ row: rawRow._rowNumber || null, error: err.message });
      }
    }

    res.json({
      message: `Successfully processed ${inserted + updated} samples (${inserted} new, ${updated} updated)` +
        (skipped ? `, ${skipped} skipped` : ''),
      inserted,
      updated,
      total: inserted + updated,
      summary: {
        rowsInFile: records.length,
        successfullyProcessed: inserted + updated,
        skipped,
        parseWarnings: warnings,
        sheet: sheetName
      },
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manually link a sample to one or more chemicals.
// Body: { chemical_ids: string[] }  (replaces the full list)
router.put('/:id/chemicals', (req, res) => {
  try {
    const sample = db.get('samples').find({ sample_id: req.params.id }).value();
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    let ids = req.body.chemical_ids;
    if (!Array.isArray(ids)) {
      return res.status(400).json({ error: 'chemical_ids must be an array' });
    }
    // De-duplicate and drop blanks.
    ids = Array.from(new Set(ids.map(x => String(x).trim()).filter(Boolean)));

    // Validate against existing chemicals; warn (do not reject) for unknown ids.
    const chemicals = db.get('chemicals').value() || [];
    const known = new Set(chemicals.map(c => c.chemical_id));
    const unknown = ids.filter(id => !known.has(id));

    db.get('samples').find({ sample_id: req.params.id })
      .assign({ chemical_ids: ids, updated_at: new Date().toISOString() }).write();

    res.json({
      message: `Linked ${ids.length} chemical(s) to sample ${req.params.id}`,
      sample_id: req.params.id,
      chemical_ids: ids,
      unknownChemicalIds: unknown.length > 0 ? unknown : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Bulk delete samples (must be declared before '/:id')
router.post('/bulk/delete', (req, res) => {
  try {
    const { sample_ids } = req.body;
    if (!sample_ids || !Array.isArray(sample_ids) || sample_ids.length === 0) {
      return res.status(400).json({ error: 'No sample IDs provided' });
    }

    let deleted = 0;
    for (const id of sample_ids) {
      const sample = db.get('samples').find({ sample_id: id }).value();
      if (sample) {
        db.get('samples').remove({ sample_id: id }).write();
        deleted++;
      }
    }

    res.json({
      message: `Successfully deleted ${deleted} samples`,
      deleted,
      requested: sample_ids.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete all samples
router.delete('/all/clear', (req, res) => {
  try {
    const count = db.get('samples').value().length;
    db.set('samples', []).write();
    res.json({ message: `Successfully deleted all ${count} samples`, deleted: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update sample
router.put('/:id', (req, res) => {
  try {
    const sample = db.get('samples').find({ sample_id: req.params.id }).value();
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    db.get('samples').find({ sample_id: req.params.id })
      .assign({ ...req.body, updated_at: new Date().toISOString() }).write();
    res.json({ message: 'Sample updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete sample
router.delete('/:id', (req, res) => {
  try {
    const sample = db.get('samples').find({ sample_id: req.params.id }).value();
    if (!sample) {
      return res.status(404).json({ error: 'Sample not found' });
    }

    db.get('samples').remove({ sample_id: req.params.id }).write();
    res.json({ message: 'Sample deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
