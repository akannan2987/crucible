/**
 * Express app instance — exported for testing with supertest.
 * The actual server startup (listen) remains in index.js.
 */
const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB } = require('./database');
const chemicalsRouter = require('./routes/chemicals');
const samplesRouter = require('./routes/samples');
const screeningRouter = require('./routes/screening');
const toxicologyRouter = require('./routes/toxicology');
const statsRouter = require('./routes/stats');

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/chemicals', chemicalsRouter);
app.use('/api/samples', samplesRouter);
app.use('/api/screening', screeningRouter);
app.use('/api/toxicology', toxicologyRouter);
app.use('/api/stats', statsRouter);

// Serve architecture documentation page
app.get('/architecture', (req, res) => {
  res.sendFile(path.join(__dirname, '../../docs/architecture-interactive.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

module.exports = { app, initDB };
