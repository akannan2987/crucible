const express = require('express');
const router = express.Router();
const { db } = require('../database');

// Get dashboard statistics
router.get('/', (req, res) => {
  try {
    const chemicals = db.get('chemicals').value() || [];
    const samples = db.get('samples').value() || [];
    const screening = db.get('screening').value() || [];
    const toxicology = db.get('toxicology').value() || [];

    const chemicalsCount = chemicals.length;
    const samplesCount = samples.length;
    const screeningCount = screening.length;
    const toxicologyCount = toxicology.length;

    const stats = {
      // Original format (for backwards compatibility).
      // NOTE: `max` is a soft reference target for the dashboard gauge only — uploads are NOT capped.
      chemicals: { total: chemicalsCount, max: 15000 },
      samples: { total: samplesCount, max: 1000 },
      screening: { total: screeningCount },
      toxicology: { total: toxicologyCount },
      // Counts format (used by Dashboard cards)
      counts: {
        chemicals: chemicalsCount,
        samples: samplesCount,
        screening: screeningCount,
        toxicology: toxicologyCount
      },
      // Capacities format (used by Dashboard capacity overview).
      // Soft reference targets for the progress bars only — not enforced limits.
      capacities: {
        chemicals: {
          current: chemicalsCount,
          max: 15000,
          percentage: ((chemicalsCount / 15000) * 100).toFixed(1)
        },
        samples: {
          current: samplesCount,
          max: 1000,
          percentage: ((samplesCount / 1000) * 100).toFixed(1)
        }
      },
      // Last updated timestamp
      lastUpdated: new Date().toISOString()
    };

    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get recent activity
router.get('/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const chemicals = db.get('chemicals').value() || [];
    const samples = db.get('samples').value() || [];
    const screening = db.get('screening').value() || [];
    const toxicology = db.get('toxicology').value() || [];

    const recentChemicals = chemicals
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(c => ({ type: 'chemical', id: c.chemical_id, name: c.name, created_at: c.created_at }));

    const recentSamples = samples
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(s => ({ type: 'sample', id: s.sample_id, name: s.name, created_at: s.created_at }));

    const recentScreening = screening
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(s => ({ type: 'screening', id: s.id, name: s.assay_name, chemical_id: s.chemical_id, created_at: s.created_at }));

    const recentToxicology = toxicology
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit)
      .map(t => ({ type: 'toxicology', id: t.id, name: t.study_type, chemical_id: t.chemical_id, created_at: t.created_at }));

    const allRecent = [...recentChemicals, ...recentSamples, ...recentScreening, ...recentToxicology]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    res.json(allRecent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get chemicals with related data counts
router.get('/chemicals-summary', (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const chemicals = db.get('chemicals').value() || [];
    const screening = db.get('screening').value() || [];
    const toxicology = db.get('toxicology').value() || [];

    const chemicalsSummary = chemicals.slice(0, limit).map(c => {
      const screeningCount = screening.filter(s => s.chemical_id === c.chemical_id).length;
      const toxicologyCount = toxicology.filter(t => t.chemical_id === c.chemical_id).length;

      return {
        chemical_id: c.chemical_id,
        name: c.name,
        cas_number: c.cas_number,
        molecular_formula: c.molecular_formula,
        screening_count: screeningCount,
        toxicology_count: toxicologyCount,
        created_at: c.created_at
      };
    });

    res.json(chemicalsSummary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sample types distribution
router.get('/sample-types', (req, res) => {
  try {
    const samples = db.get('samples').value() || [];
    const typeCount = {};

    samples.forEach(s => {
      const type = s.sample_type || 'Unknown';
      typeCount[type] = (typeCount[type] || 0) + 1;
    });

    const distribution = Object.entries(typeCount).map(([type, count]) => ({ type, count }));
    res.json(distribution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get assay types distribution
router.get('/assay-types', (req, res) => {
  try {
    const screening = db.get('screening').value() || [];
    const assayCount = {};

    screening.forEach(s => {
      const assay = s.assay_type || s.assay_name || 'Unknown';
      assayCount[assay] = (assayCount[assay] || 0) + 1;
    });

    const distribution = Object.entries(assayCount).map(([assay, count]) => ({ assay, count }));
    res.json(distribution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get toxicology study types distribution
router.get('/study-types', (req, res) => {
  try {
    const toxicology = db.get('toxicology').value() || [];
    const studyCount = {};

    toxicology.forEach(t => {
      const study = t.study_type || 'Unknown';
      studyCount[study] = (studyCount[study] || 0) + 1;
    });

    const distribution = Object.entries(studyCount).map(([study, count]) => ({ study, count }));
    res.json(distribution);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
