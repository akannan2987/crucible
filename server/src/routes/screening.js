const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get all screening data with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').toLowerCase();
    const chemicalId = req.query.chemical_id;
    const offset = (page - 1) * limit;

    let screeningData = db.get('screening').value() || [];

    if (chemicalId) {
      screeningData = screeningData.filter(s => s.chemical_id === chemicalId);
    }

    if (search) {
      screeningData = screeningData.filter(s => 
        (s.assay_name && s.assay_name.toLowerCase().includes(search)) ||
        (s.chemical_id && s.chemical_id.toLowerCase().includes(search)) ||
        (s.result && s.result.toLowerCase().includes(search))
      );
    }

    screeningData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = screeningData.length;
    const paginatedData = screeningData.slice(offset, offset + limit);

    // Enrich with chemical names
    const chemicals = db.get('chemicals').value() || [];
    const enrichedData = paginatedData.map(s => {
      const chemical = chemicals.find(c => c.chemical_id === s.chemical_id);
      return { ...s, chemical_name: chemical ? chemical.name : 'Unknown' };
    });

    res.json({
      data: enrichedData,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get screening data by ID
router.get('/:id', (req, res) => {
  try {
    const screening = db.get('screening').find({ id: req.params.id }).value();
    if (!screening) {
      return res.status(404).json({ error: 'Screening data not found' });
    }
    const chemical = db.get('chemicals').find({ chemical_id: screening.chemical_id }).value();
    res.json({ ...screening, chemical_name: chemical ? chemical.name : 'Unknown' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add single screening record
router.post('/', (req, res) => {
  try {
    const chemicalExists = db.get('chemicals').find({ chemical_id: req.body.chemical_id }).value();
    if (!chemicalExists) {
      return res.status(400).json({ error: 'Chemical not found. Screening data must be linked to an existing chemical.' });
    }

    const screening = {
      id: uuidv4(),
      chemical_id: req.body.chemical_id,
      assay_name: req.body.assay_name,
      assay_type: req.body.assay_type || null,
      target: req.body.target || null,
      result: req.body.result,
      result_value: req.body.result_value || null,
      result_unit: req.body.result_unit || null,
      concentration: req.body.concentration || null,
      concentration_unit: req.body.concentration_unit || null,
      timepoint: req.body.timepoint || null,
      replicate: req.body.replicate || null,
      plate_id: req.body.plate_id || null,
      well_position: req.body.well_position || null,
      experiment_date: req.body.experiment_date || null,
      operator: req.body.operator || null,
      notes: req.body.notes || null,
      metadata: req.body.metadata || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('screening').push(screening).write();
    res.status(201).json({ message: 'Screening data added successfully', id: screening.id });
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

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet);

    let inserted = 0;
    let errors = [];
    const chemicals = db.get('chemicals').value() || [];
    const validChemicalIds = new Set(chemicals.map(c => c.chemical_id));

    for (const row of data) {
      try {
        const chemicalId = row.chemical_id || row.Chemical_ID;
        
        if (!chemicalId || !validChemicalIds.has(chemicalId)) {
          errors.push({ row: row.assay_name || row.Assay_Name, error: 'Chemical not found' });
          continue;
        }

        const screening = {
          id: uuidv4(),
          chemical_id: chemicalId,
          assay_name: row.assay_name || row.Assay_Name || 'Unknown Assay',
          assay_type: row.assay_type || row.Assay_Type || null,
          target: row.target || row.Target || null,
          result: row.result || row.Result || null,
          result_value: row.result_value || row.Result_Value || null,
          result_unit: row.result_unit || row.Result_Unit || null,
          concentration: row.concentration || row.Concentration || null,
          concentration_unit: row.concentration_unit || row.Concentration_Unit || null,
          timepoint: row.timepoint || row.Timepoint || null,
          replicate: row.replicate || row.Replicate || null,
          plate_id: row.plate_id || row.Plate_ID || null,
          well_position: row.well_position || row.Well_Position || null,
          experiment_date: row.experiment_date || row.Experiment_Date || null,
          operator: row.operator || row.Operator || null,
          notes: row.notes || row.Notes || null,
          metadata: row,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.get('screening').push(screening).write();
        inserted++;
      } catch (err) {
        errors.push({ row: row.assay_name || row.Assay_Name, error: err.message });
      }
    }

    res.json({ 
      message: `Successfully uploaded ${inserted} screening records`,
      inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update screening record
router.put('/:id', (req, res) => {
  try {
    const screening = db.get('screening').find({ id: req.params.id }).value();
    if (!screening) {
      return res.status(404).json({ error: 'Screening data not found' });
    }

    db.get('screening').find({ id: req.params.id })
      .assign({ ...req.body, updated_at: new Date().toISOString() }).write();
    res.json({ message: 'Screening data updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete screening record
router.delete('/:id', (req, res) => {
  try {
    const screening = db.get('screening').find({ id: req.params.id }).value();
    if (!screening) {
      return res.status(404).json({ error: 'Screening data not found' });
    }

    db.get('screening').remove({ id: req.params.id }).write();
    res.json({ message: 'Screening data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get screening data by chemical
router.get('/chemical/:chemicalId', (req, res) => {
  try {
    const screeningData = db.get('screening').filter({ chemical_id: req.params.chemicalId }).value();
    res.json(screeningData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
