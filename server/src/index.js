const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { initDB } = require('./database');
const chemicalsRouter = require('./routes/chemicals');
const samplesRouter = require('./routes/samples');
const screeningRouter = require('./routes/screening');
const toxicologyRouter = require('./routes/toxicology');
const statsRouter = require('./routes/stats');

const app = express();
const PORT = process.env.PORT || 5942;
const HTTPS_PORT = process.env.HTTPS_PORT || 5943;
const USE_HTTPS = process.env.USE_HTTPS === 'true';

// SSL Certificate paths
const SSL_CERT_PATH = process.env.SSL_CERT_PATH || '/app/certs/server.crt';
const SSL_KEY_PATH = process.env.SSL_KEY_PATH || '/app/certs/server.key';
const CA_BUNDLE_PATH = process.env.CA_BUNDLE_PATH || '/etc/ssl/certs/ca-certificates.crt';

// Process monitoring and error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Don't exit - keep server running
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Don't exit - keep server running
});

// Log memory usage every 5 minutes
setInterval(() => {
  const used = process.memoryUsage();
  console.log(`Memory: RSS=${Math.round(used.rss / 1024 / 1024)}MB, Heap=${Math.round(used.heapUsed / 1024 / 1024)}MB`);
}, 5 * 60 * 1000);

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

// Serve static files from React build in production
const clientBuildPath = path.join(__dirname, '../../client/dist');
app.use(express.static(clientBuildPath));

// Serve architecture documentation page
app.get('/architecture', (req, res) => {
  res.sendFile(path.join(__dirname, '../../docs/architecture-interactive.html'));
});

// Handle React routing, return all requests to React app
app.get('*', (req, res) => {
  res.sendFile(path.join(clientBuildPath, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Initialize database and start server
async function startServer() {
  try {
    await initDB();
    console.log('Database initialized successfully');

    // Check if HTTPS should be enabled
    if (USE_HTTPS) {
      // Check if SSL certificates exist
      if (fs.existsSync(SSL_CERT_PATH) && fs.existsSync(SSL_KEY_PATH)) {
        const httpsOptions = {
          key: fs.readFileSync(SSL_KEY_PATH),
          cert: fs.readFileSync(SSL_CERT_PATH),
          // Keep connections alive
          keepAlive: true,
          keepAliveTimeout: 65000,
          headersTimeout: 66000
        };

        // Add CA bundle if available
        if (fs.existsSync(CA_BUNDLE_PATH)) {
          httpsOptions.ca = fs.readFileSync(CA_BUNDLE_PATH);
        }

        // Start HTTPS server
        const server = https.createServer(httpsOptions, app);

        // Set server timeouts
        server.keepAliveTimeout = 65000;
        server.headersTimeout = 66000;
        server.timeout = 120000;

        server.listen(PORT, '0.0.0.0', () => {
          console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🧪 Pandora Toolbox 2.0 - Chemical & Sample Management   ║
  ║                                                           ║
  ║   🔒 HTTPS Server running on port ${PORT}                  ║
  ║   https://nr-ubp-dev-02.nihs.ch.nestle.com:${PORT}          ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
          `);
        });

      } else {
        console.error('SSL certificates not found. Starting HTTP server instead.');
        console.error(`Expected: ${SSL_CERT_PATH} and ${SSL_KEY_PATH}`);
        startHttpServer();
      }
    } else {
      startHttpServer();
    }
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

function startHttpServer() {
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ╔═══════════════════════════════════════════════════════════╗
  ║                                                           ║
  ║   🧪 Pandora Toolbox 2.0 - Chemical & Sample Management   ║
  ║                                                           ║
  ║   Server running on port ${PORT}                           ║
  ║   http://nr-ubp-dev-02.nihs.ch.nestle.com:${PORT}           ║
  ║                                                           ║
  ║   💡 To enable HTTPS, set USE_HTTPS=true                  ║
  ║                                                           ║
  ╚═══════════════════════════════════════════════════════════╝
    `);
  });

  // Set server timeouts
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 66000;
  server.timeout = 120000;
}

startServer();
