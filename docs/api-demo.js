/**
 * =============================================================
 * Pandora Toolbox — PubChem API Integration Demo
 * =============================================================
 * 
 * This script demonstrates how to connect Pandora's Express API
 * to PubChem for chemical compound lookups.
 * 
 * RUN:  node docs/api-demo.js
 * 
 * All calls work immediately (public API, no auth needed).
 * =============================================================
 */

const https = require('https');
const http = require('http');

// ─────────────────────────────────────────────────────────────
// HELPER: Simple GET request (no external dependencies needed)
// ─────────────────────────────────────────────────────────────
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = new URL(url);
    const reqOptions = {
      hostname: options.hostname,
      port: options.port || 443,
      path: options.pathname + options.search,
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'PandoraToolbox/2.0' },
      rejectUnauthorized: false,
    };
    client.get(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(data)); }
          catch (e) { resolve(data); }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
        }
      });
    }).on('error', reject);
  });
}

// ═════════════════════════════════════════════════════════════
// 1. PUBCHEM API — Public, free, no authentication needed
// Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
// ═════════════════════════════════════════════════════════════

async function pubchem_lookupByCAS(cas) {
  console.log(`\n🔬 PubChem: Looking up CAS number "${cas}"...`);
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${cas}/property/MolecularFormula,MolecularWeight,IUPACName,InChI,InChIKey,CanonicalSMILES/JSON`;
  const result = await httpGet(url);
  const props = result.PropertyTable.Properties[0];
  console.log('  ✅ Found:');
  console.log(`     CID:              ${props.CID}`);
  console.log(`     IUPAC Name:       ${props.IUPACName}`);
  console.log(`     Molecular Formula: ${props.MolecularFormula}`);
  console.log(`     Molecular Weight:  ${props.MolecularWeight}`);
  console.log(`     SMILES:           ${props.CanonicalSMILES}`);
  console.log(`     InChIKey:         ${props.InChIKey}`);
  return props;
}

async function pubchem_lookupByName(name) {
  console.log(`\n🔬 PubChem: Looking up compound name "${name}"...`);
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(name)}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChIKey/JSON`;
  const result = await httpGet(url);
  const props = result.PropertyTable.Properties[0];
  console.log('  ✅ Found:');
  console.log(`     CID:              ${props.CID}`);
  console.log(`     IUPAC Name:       ${props.IUPACName}`);
  console.log(`     Molecular Formula: ${props.MolecularFormula}`);
  console.log(`     Molecular Weight:  ${props.MolecularWeight}`);
  console.log(`     SMILES:           ${props.CanonicalSMILES}`);
  return props;
}

async function pubchem_getSynonyms(cid) {
  console.log(`\n🔬 PubChem: Getting synonyms for CID ${cid}...`);
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/synonyms/JSON`;
  const result = await httpGet(url);
  const synonyms = result.InformationList.Information[0].Synonym.slice(0, 10);
  console.log(`  ✅ First 10 synonyms:`);
  synonyms.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));
  return synonyms;
}

async function pubchem_searchBySmiles(smiles) {
  console.log(`\n🔬 PubChem: Searching by SMILES "${smiles}"...`);
  const url = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/smiles/${encodeURIComponent(smiles)}/property/MolecularFormula,MolecularWeight,IUPACName/JSON`;
  const result = await httpGet(url);
  const props = result.PropertyTable.Properties[0];
  console.log('  ✅ Found:');
  console.log(`     CID:              ${props.CID}`);
  console.log(`     IUPAC Name:       ${props.IUPACName}`);
  console.log(`     Molecular Formula: ${props.MolecularFormula}`);
  console.log(`     Molecular Weight:  ${props.MolecularWeight}`);
  return props;
}

// ═════════════════════════════════════════════════════════════
// 2. HOW TO INTEGRATE INTO PANDORA'S EXPRESS API
// ═════════════════════════════════════════════════════════════

function showIntegrationExample() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  📋 How to add PubChem lookup to Pandora's Express server    ║
╚═══════════════════════════════════════════════════════════════╝

Create a new file: server/src/routes/external.js

───────────────────────────────────────────────────────────────
const express = require('express');
const router = express.Router();
const https = require('https');

// Helper for external API calls
function fetchJSON(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { Accept: 'application/json' } }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

// ── PubChem lookup by CAS or name ──
router.get('/api/external/pubchem/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    const url = \`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/\${encodeURIComponent(identifier)}/property/MolecularFormula,MolecularWeight,IUPACName,CanonicalSMILES,InChIKey/JSON\`;
    const result = await fetchJSON(url);
    res.json(result.PropertyTable.Properties[0]);
  } catch (err) {
    res.status(404).json({ error: 'Compound not found in PubChem' });
  }
});

module.exports = router;
───────────────────────────────────────────────────────────────

Then in server/src/index.js, add:
  const externalRoutes = require('./routes/external');
  app.use(externalRoutes);

`);
}

// ═════════════════════════════════════════════════════════════
// MAIN — Run the demos
// ═════════════════════════════════════════════════════════════

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║  🧪 Pandora Toolbox — PubChem API Integration Demo            ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  console.log('\n' + '═'.repeat(60));
  console.log('  PUBCHEM API DEMOS (live calls — no auth needed)');
  console.log('═'.repeat(60));

  try {
    // 1. Look up Caffeine by CAS number
    await pubchem_lookupByCAS('58-08-2');  // Caffeine
  } catch (err) {
    console.log(`  ❌ PubChem CAS lookup error: ${err.message || err}`);
  }

  try {
    // 2. Look up by common name
    await pubchem_lookupByName('Aspirin');
  } catch (err) {
    console.log(`  ❌ PubChem name lookup error: ${err.message || err}`);
  }

  try {
    // 3. Look up by name — food-related chemical
    await pubchem_lookupByName('Vanillin');
  } catch (err) {
    console.log(`  ❌ PubChem name lookup error: ${err.message || err}`);
  }

  try {
    // 4. Get synonyms for Caffeine (CID 2519)
    await pubchem_getSynonyms(2519);
  } catch (err) {
    console.log(`  ❌ PubChem synonyms error: ${err.message || err}`);
  }

  try {
    // 5. Search by SMILES string (Ethanol)
    await pubchem_searchBySmiles('CCO');
  } catch (err) {
    console.log(`  ❌ PubChem SMILES error: ${err.message || err}`);
  }

  // ── Show how to integrate into Express ──
  showIntegrationExample();

  console.log('═'.repeat(60));
  console.log('  ✅ Demo complete!');
  console.log('═'.repeat(60));
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
