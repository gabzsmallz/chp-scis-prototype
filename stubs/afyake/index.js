'use strict';

/**
 * stubs/afyake/index.js
 * Mock AfyaKE facility EMR/LMIS endpoint for CHP-SCIS simulation.
 *
 * AfyaKE is the facility-level electronic medical record and LMIS used by
 * health facilities in Kenya. When a CHP has a stockout, the FHIR mediator
 * posts a formal FHIR R5 SupplyRequest here so the facility's supply officer
 * can see and fulfil the request.
 *
 * The facility then manages its own upward requisition chain:
 *   facility → sub-county commodity coordinator → county pharmacist → KEMSA/MEDS
 *
 * Endpoints:
 *   POST /fhir/SupplyRequest          — receive formal resupply request from CHP
 *   GET  /fhir/SupplyRequest          — list all received requests
 *   GET  /fhir/SupplyRequest/:id      — get single request
 *   GET  /health
 */

const express = require('express');
const app = express();

app.use(express.json({ type: ['application/json', 'application/fhir+json'] }));

const store = [];
let idCounter = 3000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'afyake-stub', version: '1.0.0-sim' });
});

// POST /fhir/SupplyRequest — formal CHP resupply request
app.post('/fhir/SupplyRequest', (req, res) => {
  const resource = req.body;

  if (!resource || resource.resourceType !== 'SupplyRequest') {
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'invalid', diagnostics: 'Expected SupplyRequest resource' }]
    });
  }

  const afyaKeId = `AFYAKE-SR-${String(idCounter++).padStart(6, '0')}`;
  const saved = {
    ...resource,
    id: afyaKeId,
    meta: {
      ...resource.meta,
      versionId:   '1',
      lastUpdated: new Date().toISOString(),
      source:      'https://afyake.health.go.ke/fhir'
    }
  };

  store.push(saved);

  const requester    = resource.requester?.display   || resource.requester?.reference || 'unknown CHP';
  const facility     = resource.deliverFrom?.reference || 'unknown facility';
  const commodityExt = resource.item?.itemCodeableConcept?.coding?.[0];
  const commodity    = commodityExt ? `${commodityExt.code} (${commodityExt.display})` : 'unknown';
  const qty          = resource.quantity?.value || '?';

  console.log(`[AfyaKE-stub] SupplyRequest id=${afyaKeId} | CHP=${requester} → Facility=${facility} | ${commodity} qty=${qty}`);
  console.log(`[AfyaKE-stub] *** Facility supply officer notified — will process requisition ***`);

  return res.status(201).json(saved);
});

// GET /fhir/SupplyRequest
app.get('/fhir/SupplyRequest', (_req, res) => {
  res.setHeader('Content-Type', 'application/fhir+json');
  return res.json({
    resourceType: 'Bundle',
    type:  'searchset',
    total: store.length,
    entry: store.map((r) => ({ resource: r }))
  });
});

// GET /fhir/SupplyRequest/:id
app.get('/fhir/SupplyRequest/:id', (req, res) => {
  const resource = store.find((r) => r.id === req.params.id);
  if (!resource) {
    return res.status(404).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'not-found', diagnostics: `SupplyRequest/${req.params.id} not found` }]
    });
  }
  res.setHeader('Content-Type', 'application/fhir+json');
  return res.json(resource);
});

const PORT = process.env.PORT || 4502;
app.listen(PORT, () => console.log(`[AfyaKE-stub] Listening on port ${PORT}`));
