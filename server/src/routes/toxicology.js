const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { db } = require('../database');

const storage = multer.memoryStorage();
const upload = multer({ storage });

// Get all toxicology data with pagination
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const search = (req.query.search || '').toLowerCase();
    const chemicalId = req.query.chemical_id;
    const offset = (page - 1) * limit;

    let toxData = db.get('toxicology').value() || [];

    if (chemicalId) {
      toxData = toxData.filter(t => t.chemical_id === chemicalId);
    }

    if (search) {
      toxData = toxData.filter(t => 
        (t.study_type && t.study_type.toLowerCase().includes(search)) ||
        (t.chemical_id && t.chemical_id.toLowerCase().includes(search)) ||
        (t.endpoint && t.endpoint.toLowerCase().includes(search)) ||
        (t.species && t.species.toLowerCase().includes(search))
      );
    }

    toxData.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const total = toxData.length;
    const paginatedData = toxData.slice(offset, offset + limit);

    // Enrich with chemical names
    const chemicals = db.get('chemicals').value() || [];
    const enrichedData = paginatedData.map(t => {
      const chemical = chemicals.find(c => c.chemical_id === t.chemical_id);
      return { ...t, chemical_name: chemical ? chemical.name : 'Unknown' };
    });

    res.json({
      data: enrichedData,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get toxicology data by ID
router.get('/:id', (req, res) => {
  try {
    const toxData = db.get('toxicology').find({ id: req.params.id }).value();
    if (!toxData) {
      return res.status(404).json({ error: 'Toxicology data not found' });
    }
    const chemical = db.get('chemicals').find({ chemical_id: toxData.chemical_id }).value();
    res.json({ ...toxData, chemical_name: chemical ? chemical.name : 'Unknown' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add single toxicology record
router.post('/', (req, res) => {
  try {
    const chemicalExists = db.get('chemicals').find({ chemical_id: req.body.chemical_id }).value();
    if (!chemicalExists) {
      return res.status(400).json({ error: 'Chemical not found. Toxicology data must be linked to an existing chemical.' });
    }

    const toxData = {
      id: uuidv4(),
      chemical_id: req.body.chemical_id,
      study_type: req.body.study_type,
      species: req.body.species || null,
      strain: req.body.strain || null,
      sex: req.body.sex || null,
      route_of_administration: req.body.route_of_administration || null,
      duration: req.body.duration || null,
      duration_unit: req.body.duration_unit || null,
      dose: req.body.dose || null,
      dose_unit: req.body.dose_unit || null,
      endpoint: req.body.endpoint || null,
      endpoint_value: req.body.endpoint_value || null,
      endpoint_unit: req.body.endpoint_unit || null,
      noael: req.body.noael || null,
      loael: req.body.loael || null,
      ld50: req.body.ld50 || null,
      study_reference: req.body.study_reference || null,
      study_date: req.body.study_date || null,
      source: req.body.source || null,
      notes: req.body.notes || null,
      metadata: req.body.metadata || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    db.get('toxicology').push(toxData).write();
    res.status(201).json({ message: 'Toxicology data added successfully', id: toxData.id });
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
          errors.push({ row: row.study_type || row.Study_Type, error: 'Chemical not found' });
          continue;
        }

        const toxData = {
          id: uuidv4(),
          chemical_id: chemicalId,
          study_type: row.study_type || row.Study_Type || 'Unknown Study',
          species: row.species || row.Species || null,
          strain: row.strain || row.Strain || null,
          sex: row.sex || row.Sex || null,
          route_of_administration: row.route_of_administration || row.Route_Of_Administration || null,
          duration: row.duration || row.Duration || null,
          duration_unit: row.duration_unit || row.Duration_Unit || null,
          dose: row.dose || row.Dose || null,
          dose_unit: row.dose_unit || row.Dose_Unit || null,
          endpoint: row.endpoint || row.Endpoint || null,
          endpoint_value: row.endpoint_value || row.Endpoint_Value || null,
          endpoint_unit: row.endpoint_unit || row.Endpoint_Unit || null,
          noael: row.noael || row.NOAEL || null,
          loael: row.loael || row.LOAEL || null,
          ld50: row.ld50 || row.LD50 || null,
          study_reference: row.study_reference || row.Study_Reference || null,
          study_date: row.study_date || row.Study_Date || null,
          source: row.source || row.Source || null,
          notes: row.notes || row.Notes || null,
          metadata: row,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        db.get('toxicology').push(toxData).write();
        inserted++;
      } catch (err) {
        errors.push({ row: row.study_type || row.Study_Type, error: err.message });
      }
    }

    res.json({ 
      message: `Successfully uploaded ${inserted} toxicology records`,
      inserted,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update toxicology record
router.put('/:id', (req, res) => {
  try {
    const toxData = db.get('toxicology').find({ id: req.params.id }).value();
    if (!toxData) {
      return res.status(404).json({ error: 'Toxicology data not found' });
    }

    db.get('toxicology').find({ id: req.params.id })
      .assign({ ...req.body, updated_at: new Date().toISOString() }).write();
    res.json({ message: 'Toxicology data updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete toxicology record
router.delete('/:id', (req, res) => {
  try {
    const toxData = db.get('toxicology').find({ id: req.params.id }).value();
    if (!toxData) {
      return res.status(404).json({ error: 'Toxicology data not found' });
    }

    db.get('toxicology').remove({ id: req.params.id }).write();
    res.json({ message: 'Toxicology data deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get toxicology data by chemical
router.get('/chemical/:chemicalId', (req, res) => {
  try {
    const toxData = db.get('toxicology').filter({ chemical_id: req.params.chemicalId }).value();
    res.json(toxData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
