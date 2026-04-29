'use strict';

/**
 * stubs/ilmis/index.js
 * Mock KEMSA iLMIS FHIR R4 endpoint for CHP-SCIS simulation
 *
 * Accepts FHIR SupplyDelivery resources and returns plausible iLMIS responses.
 * Stores received resources in-memory so the dashboard can display confirmed submissions.
 *
 * Endpoints:
 *   POST /fhir/SupplyDelivery   — accept a supply delivery report
 *   GET  /fhir/SupplyDelivery   — list all received reports
 *   GET  /health                — health check
 */

const express = require('express');
const app = express();

app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

// In-memory store (sufficient for simulation — no persistence needed)
const store = [];
let idCounter = 1000;

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'iLMIS-stub', version: '1.0.0-sim' });
});

// ── POST /fhir/SupplyDelivery ─────────────────────────────────────────────────
app.post('/fhir/SupplyDelivery', (req, res) => {
    const resource = req.body;

           if (!resource || resource.resourceType !== 'SupplyDelivery') {
                 return res.status(400).json({
                         resourceType: 'OperationOutcome',
                         issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Expected SupplyDelivery resource' }]
                 });
           }

           // Assign iLMIS server ID
           const ilmisId = `ILMIS-SD-${String(idCounter++).padStart(6, '0')}`;
    const savedResource = {
          ...resource,
          id: ilmisId,
          meta: {
                  ...resource.meta,
                  versionId: '1',
                  lastUpdated: new Date().toISOString(),
                  source: 'https://ilmis.kemsa.go.ke/fhir'
          }
    };

           store.push(savedResource);

           console.log(`[iLMIS-stub] Received SupplyDelivery from CHP: ${resource.supplier?.display ?? 'unknown'} | id=${ilmisId}`);

           // Stockout alert log
           if (savedResource.extension?.length > 0) {
                 const flags = savedResource.extension.map((e) => {
                         const commodity = e.extension?.find((x) => x.url === 'commodity')?.valueString;
                         const qty = e.extension?.find((x) => x.url === 'quantity')?.valueInteger;
                         return `${commodity}(${qty})`;
                 });
                 console.warn(`[iLMIS-stub] STOCKOUT FLAGS: ${flags.join(', ')}`);
           }

           return res.status(201).json(savedResource);
});

// ── GET /fhir/SupplyDelivery ──────────────────────────────────────────────────
app.get('/fhir/SupplyDelivery', (_req, res) => {
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json({
          resourceType: 'Bundle',
          type: 'searchset',
          total: store.length,
          entry: store.map((r) => ({ resource: r }))
    });
});

// ── GET /fhir/SupplyDelivery/:id ──────────────────────────────────────────────
app.get('/fhir/SupplyDelivery/:id', (req, res) => {
    const resource = store.find((r) => r.id === req.params.id);
    if (!resource) {
          return res.status(404).json({
                  resourceType: 'OperationOutcome',
                  issue: [{ severity: 'error', code: 'not-found', diagnostics: `SupplyDelivery/${req.params.id} not found` }]
          });
    }
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.json(resource);
});

const PORT = process.env.PORT || 4500;
app.listen(PORT, () => console.log(`[iLMIS-stub] Listening on port ${PORT}`));
