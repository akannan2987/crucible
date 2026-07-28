const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

// Ensure data directory exists
const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Default data structure
const defaultData = {
  chemicals: [],
  samples: [],
  screening: [],
  toxicology: []
};

// Create lowdb instance
const adapter = new FileSync(path.join(dataDir, 'pandora.json'));
const db = low(adapter);

// Initialize database
const initDB = async () => {
  db.defaults(defaultData).write();
  return db;
};

module.exports = { db, initDB };
