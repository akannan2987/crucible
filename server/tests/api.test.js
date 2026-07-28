/**
 * Pandora Toolbox 2.0 — API Integration Tests
 *
 * Run:  cd server && npm test
 *
 * These tests exercise the real Express routes against a temporary
 * in-memory LowDB instance so they are fast and side-effect free.
 */
const request = require('supertest');
const { app, initDB } = require('../src/app');
const { db } = require('../src/database');

beforeAll(async () => {
  await initDB();
  // Clear test data
  db.set('chemicals', []).write();
  db.set('samples', []).write();
  db.set('screening', []).write();
  db.set('toxicology', []).write();
});

afterAll(() => {
  // Clean up
  db.set('chemicals', []).write();
  db.set('samples', []).write();
  db.set('screening', []).write();
  db.set('toxicology', []).write();
});

// ─── STATS ────────────────────────────────────────────────────────────────────

describe('GET /api/stats', () => {
  it('returns health and counts', async () => {
    const res = await request(app).get('/api/stats');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('chemicals');
    expect(res.body.chemicals.max).toBe(15000);
    expect(res.body.capacities.samples.max).toBe(1000);
  });
});

// ─── CHEMICALS CRUD ───────────────────────────────────────────────────────────

describe('Chemicals API', () => {
  const testChemical = {
    chemical_id: 'TEST-JEST-001',
    name: 'Jest Caffeine',
    molecular_formula: 'C8H10N4O2',
    molecular_weight: 194.19,
    cas_number: '58-08-2',
  };

  it('POST /api/chemicals — creates a chemical', async () => {
    const res = await request(app).post('/api/chemicals').send(testChemical);
    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/added/i);
  });

  it('POST /api/chemicals — rejects duplicate chemical_id', async () => {
    const res = await request(app).post('/api/chemicals').send(testChemical);
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/already exists/i);
  });

  it('GET /api/chemicals — lists chemicals with pagination', async () => {
    const res = await request(app).get('/api/chemicals');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
    expect(res.body.pagination).toHaveProperty('total');
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/chemicals?search=jest — searches by name', async () => {
    const res = await request(app).get('/api/chemicals?search=jest');
    expect(res.status).toBe(200);
    expect(res.body.data[0].name).toMatch(/jest/i);
  });

  it('GET /api/chemicals/:id — retrieves by chemical_id', async () => {
    const res = await request(app).get('/api/chemicals/TEST-JEST-001');
    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Jest Caffeine');
  });

  it('GET /api/chemicals/:id — 404 for unknown id', async () => {
    const res = await request(app).get('/api/chemicals/DOES-NOT-EXIST');
    expect(res.status).toBe(404);
  });

  it('PUT /api/chemicals/:id — updates a chemical', async () => {
    const res = await request(app)
      .put('/api/chemicals/TEST-JEST-001')
      .send({ supplier: 'Jest Supplier' });
    expect(res.status).toBe(200);
  });

  it('GET /api/chemicals/list/dropdown — returns dropdown list', async () => {
    const res = await request(app).get('/api/chemicals/list/dropdown');
    expect(res.status).toBe(200);
    expect(res.body[0]).toHaveProperty('chemical_id');
    expect(res.body[0]).toHaveProperty('name');
  });

  it('DELETE /api/chemicals/:id — deletes a chemical', async () => {
    const res = await request(app).delete('/api/chemicals/TEST-JEST-001');
    expect(res.status).toBe(200);
  });
});

// ─── SAMPLES CRUD ─────────────────────────────────────────────────────────────

describe('Samples API', () => {
  const testSample = {
    sample_id: 'SAMP-JEST-001',
    name: 'Jest Sample',
    sample_type: 'Powder',
    source: 'Lab A',
  };

  it('POST /api/samples — creates a sample', async () => {
    const res = await request(app).post('/api/samples').send(testSample);
    expect(res.status).toBe(201);
  });

  it('GET /api/samples — lists samples', async () => {
    const res = await request(app).get('/api/samples');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('DELETE /api/samples/:id — deletes a sample', async () => {
    const res = await request(app).delete('/api/samples/SAMP-JEST-001');
    expect(res.status).toBe(200);
  });
});

// ─── SCREENING ────────────────────────────────────────────────────────────────

describe('Screening API', () => {
  // Need a chemical first
  beforeAll(async () => {
    await request(app).post('/api/chemicals').send({
      chemical_id: 'CHEM-SCREEN-TEST',
      name: 'Screening Test Chemical',
    });
  });

  afterAll(async () => {
    await request(app).delete('/api/chemicals/CHEM-SCREEN-TEST');
  });

  it('POST /api/screening — creates a screening record', async () => {
    const res = await request(app).post('/api/screening').send({
      chemical_id: 'CHEM-SCREEN-TEST',
      assay_name: 'IC50 Binding',
      result: 'Active',
    });
    expect(res.status).toBe(201);
  });

  it('POST /api/screening — rejects invalid chemical_id', async () => {
    const res = await request(app).post('/api/screening').send({
      chemical_id: 'DOES-NOT-EXIST',
      assay_name: 'Test',
      result: 'N/A',
    });
    expect(res.status).toBe(400);
  });

  it('GET /api/screening — lists with pagination', async () => {
    const res = await request(app).get('/api/screening');
    expect(res.status).toBe(200);
    expect(res.body.data).toBeInstanceOf(Array);
  });

  it('GET /api/screening/chemical/:chemicalId — filters by chemical', async () => {
    const res = await request(app).get('/api/screening/chemical/CHEM-SCREEN-TEST');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ─── TOXICOLOGY ───────────────────────────────────────────────────────────────

describe('Toxicology API', () => {
  beforeAll(async () => {
    await request(app).post('/api/chemicals').send({
      chemical_id: 'CHEM-TOX-TEST',
      name: 'Tox Test Chemical',
    });
  });

  afterAll(async () => {
    await request(app).delete('/api/chemicals/CHEM-TOX-TEST');
  });

  it('POST /api/toxicology — creates a tox record', async () => {
    const res = await request(app).post('/api/toxicology').send({
      chemical_id: 'CHEM-TOX-TEST',
      study_type: 'Acute Oral',
      species: 'Rat',
      endpoint: 'LD50',
    });
    expect(res.status).toBe(201);
  });

  it('GET /api/toxicology/chemical/:chemicalId — filters by chemical', async () => {
    const res = await request(app).get('/api/toxicology/chemical/CHEM-TOX-TEST');
    expect(res.status).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });
});

// ─── CAPACITY LIMITS ──────────────────────────────────────────────────────────

describe('Capacity limits', () => {
  it('accepts uploads with no hard cap enforced', async () => {
    // There is no MAX limit — a normal insert always succeeds.
    const res = await request(app).post('/api/chemicals').send({
      chemical_id: 'CAP-TEST-001',
      name: 'Capacity Test',
    });
    expect(res.status).toBe(201);
    // Clean up
    await request(app).delete('/api/chemicals/CAP-TEST-001');
  });
});

// ─── ARCHITECTURE PAGE ────────────────────────────────────────────────────────

describe('GET /architecture', () => {
  it('serves the interactive architecture HTML', async () => {
    const res = await request(app).get('/architecture');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/html/);
  });
});
