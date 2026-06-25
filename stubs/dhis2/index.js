'use strict';

/**
 * stubs/dhis2/index.js
 * Mock DHIS2 Tracker endpoint for CHP-SCIS simulation.
 *
 * Accepts CHP stock events with these data elements:
 *   DE_STOCK_ON_HAND   — quantity on hand
 *   DE_COMMODITY_CODE  — KEMSA commodity code
 *   DE_QTY_DISPENSED   — quantity dispensed since last report
 *   DE_QTY_RECEIVED    — quantity received since last report
 *   DE_REPORT_DATE     — reporting date (YYYY-MM-DD)
 *
 * Program: CHP_STOCK_PROGRAM — "Community CHP Commodity Stock Reporting"
 *
 * Endpoints:
 *   POST /api/events               — accept Tracker events (stock data)
 *   GET  /api/events               — list received events
 *   GET  /api/analytics            — mock aggregated stock totals
 *   GET  /api/organisationUnits    — mock CHU list
 *   GET  /health
 */

const express = require('express');
const app = express();

app.use(express.json());

function checkAuth(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Basic ')) {
    return res.status(401).json({ status: 'ERROR', message: 'Basic Auth required' });
  }
  next();
}

const events = [];
let eventCounter = 1;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'dhis2-stub', version: '2.40.0-sim' });
});

// POST /api/events — CHP stock reporting events
app.post('/api/events', checkAuth, (req, res) => {
  const payload = req.body;

  if (!payload || !Array.isArray(payload.events)) {
    return res.status(400).json({ status: 'ERROR', message: 'Expected { events: [...] }' });
  }

  const importSummary = {
    responseType:    'ImportSummaries',
    status:          'SUCCESS',
    imported:        0,
    updated:         0,
    deleted:         0,
    ignored:         0,
    importSummaries: []
  };

  payload.events.forEach((event) => {
    const uid = `dhis2-evt-${String(eventCounter++).padStart(8, '0')}`;
    const saved = {
      ...event,
      event:       uid,
      created:     new Date().toISOString(),
      lastUpdated: new Date().toISOString()
    };
    events.push(saved);
    importSummary.imported++;
    importSummary.importSummaries.push({
      responseType: 'ImportSummary',
      status:       'SUCCESS',
      reference:    uid,
      href:         `http://dhis2-stub:4501/api/events/${uid}`
    });

    // Log key stock data elements for visibility
    const dv      = Object.fromEntries((event.dataValues || []).map((d) => [d.dataElement, d.value]));
    const code    = dv['DE_COMMODITY_CODE'] || 'unknown';
    const onHand  = dv['DE_STOCK_ON_HAND']  ?? '?';
    console.log(`[DHIS2-stub] event=${uid} program=${event.program} orgUnit=${event.orgUnit} commodity=${code} onHand=${onHand}`);
  });

  return res.status(200).json(importSummary);
});

// GET /api/events
app.get('/api/events', checkAuth, (req, res) => {
  const { orgUnit, program } = req.query;
  let filtered = events;
  if (orgUnit) filtered = filtered.filter((e) => e.orgUnit === orgUnit);
  if (program) filtered = filtered.filter((e) => e.program === program);

  return res.json({
    events: filtered,
    pager:  { page: 1, pageCount: 1, total: filtered.length, pageSize: 50 }
  });
});

// GET /api/analytics — mock aggregated commodity stock totals
app.get('/api/analytics', checkAuth, (_req, res) => {
  // Build live totals from received events if possible, otherwise return fixture data
  const totals = {};
  events.forEach((ev) => {
    const dv   = Object.fromEntries((ev.dataValues || []).map((d) => [d.dataElement, d.value]));
    const code = dv['DE_COMMODITY_CODE'];
    if (!code) return;
    if (!totals[code]) totals[code] = { onHand: 0, count: 0 };
    totals[code].onHand += parseInt(dv['DE_STOCK_ON_HAND'] || 0, 10);
    totals[code].count++;
  });

  const rows = Object.keys(totals).length > 0
    ? Object.entries(totals).map(([code, v]) => [code, String(v.onHand), String(v.count)])
    : [
        ['KE-AMOX-250-001',  '450', '2'],
        ['KE-ORS-001',       '80',  '1'],
        ['KE-ZINC-20MG-001', '320', '0'],
        ['KE-RDT-MAL-001',   '55',  '3'],
        ['KE-FP-COND-001',   '25',  '1'],
        ['KE-ACT-AL-001',    '18',  '0']
      ];

  return res.json({
    headers: [
      { name: 'commodity_code', column: 'Commodity Code', type: 'TEXT'   },
      { name: 'stock_on_hand',  column: 'Stock on Hand',  type: 'NUMBER' },
      { name: 'report_count',   column: 'Report Count',   type: 'NUMBER' }
    ],
    rows,
    metaData: {
      program:    'CHP_STOCK_PROGRAM',
      programName: 'Community CHP Commodity Stock Reporting'
    }
  });
});

// GET /api/organisationUnits
app.get('/api/organisationUnits', checkAuth, (_req, res) => {
  return res.json({
    organisationUnits: [
      { id: 'CHU-001', displayName: 'Kibera CHU',      level: 4 },
      { id: 'CHU-002', displayName: 'Mathare CHU',     level: 4 },
      { id: 'CHU-003', displayName: 'Korogocho CHU',   level: 4 },
      { id: 'CHU-004', displayName: 'Mukuru CHU',      level: 4 },
      { id: 'CHU-005', displayName: 'Kawangware CHU',  level: 4 }
    ]
  });
});

const PORT = process.env.PORT || 4501;
app.listen(PORT, () => console.log(`[DHIS2-stub] Listening on port ${PORT}`));
