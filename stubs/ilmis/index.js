'use strict';

/**
 * stubs/ilmis/index.js
 * Mock iLMIS FHIR R4 endpoint — represents the facility-level LMIS.
 *
 * Receives FHIR InventoryReport resources posted by the FHIR mediator
 * to give the facility visibility of its attached CHPs' stock levels.
 *
 * Endpoints:
 *   POST /fhir/InventoryReport          — receive CHP stock snapshot
 *   GET  /fhir/InventoryReport          — list all received reports
 *   GET  /fhir/InventoryReport/:id      — get single report
 *   GET  /health
 */

const express = require('express');
const app = express();

app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

const store = [];
let idCounter = 1000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'iLMIS-stub', version: '2.0.0-sim' });
});

app.post('/fhir/InventoryReport', (req, res) => {
  const resource = req.body;

  if (!resource || resource.resourceType !== 'InventoryReport') {
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Expected InventoryReport resource' }]
    });
  }

  const ilmisId = `ILMIS-IR-${String(idCounter++).padStart(6, '0')}`;
  const saved = {
    ...resource,
    id: ilmisId,
    meta: {
      ...resource.meta,
      versionId:   '1',
      lastUpdated: new Date().toISOString(),
      source:      'https://ilmis.facility.health.go.ke/fhir'
    }
  };

  store.push(saved);

  const reporterRef = resource.reporter?.display || resource.reporter?.reference || 'unknown CHP';
  const items       = resource.inventoryListing?.[0]?.items || [];
  const stockoutExt = resource.extension?.find((e) => e.url.endsWith('stockout-codes'));
  const stockouts   = stockoutExt ? stockoutExt.valueString : 'none';

  console.log(`[iLMIS-stub] InventoryReport from ${reporterRef} | ${items.length} commodities | stockouts: ${stockouts} | id=${ilmisId}`);

  return res.status(201).json(saved);
});

app.get('/fhir/InventoryReport', (_req, res) => {
  res.setHeader('Content-Type', 'application/fhir+json');
  return res.json({
    resourceType: 'Bundle',
    type:  'searchset',
    total: store.length,
    entry: store.map((r) => ({ resource: r }))
  });
});

app.get('/fhir/InventoryReport/:id', (req, res) => {
  const resource = store.find((r) => r.id === req.params.id);
  if (!resource) {
    return res.status(404).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', diagnostics: `InventoryReport/${req.params.id} not found` }]
    });
  }
  res.setHeader('Content-Type', 'application/fhir+json');
  return res.json(resource);
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => console.log(`[iLMIS-stub] Listening on port ${PORT}`));
