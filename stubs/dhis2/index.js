'use strict';

/**
 * stubs/dhis2/index.js
 * Mock DHIS2 Tracker endpoint for CHP-SCIS simulation
 *
 * Simulates DHIS2 Tracker API responses for stock event data.
 * Used by the FHIR mediator to confirm DHIS2 posting works end-to-end.
 *
 * Endpoints:
 *   POST /api/events           — accept Tracker events (stock data)
 *   GET  /api/events           — list all received events
 *   GET  /api/analytics        — mock analytics response for dashboard
 *   GET  /api/organisationUnits — mock org unit list (CHUs)
 *   GET  /health               — health check
 */

const express = require('express');
const app = express();

app.use(express.json());

// Basic auth check middleware (mirrors DHIS2 Basic Auth)
function checkAuth(req, res, next) {
    const auth = req.headers['authorization'];
    if (!auth || !auth.startsWith('Basic ')) {
          return res.status(401).json({ status: 'ERROR', message: 'Unauthorized — Basic Auth required' });
    }
    next();
}

// In-memory event store
const events = [];
let eventCounter = 1;

// ── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'dhis2-stub', version: '2.40.0-sim' });
});

// ── POST /api/events ──────────────────────────────────────────────────────────
app.post('/api/events', checkAuth, (req, res) => {
    const payload = req.body;

           if (!payload || !Array.isArray(payload.events)) {
                 return res.status(400).json({ status: 'ERROR', message: 'Expected { events: [...] }' });
           }

           const importSummary = {
                 responseType: 'ImportSummaries',
                 status: 'SUCCESS',
                 imported: 0,
                 updated: 0,
                 deleted: 0,
                 ignored: 0,
                 importSummaries: []
           };

           payload.events.forEach((event) => {
                 const uid = `dhis2-evt-${String(eventCounter++).padStart(8, '0')}`;
                 const saved = {
                         ...event,
                         event: uid,
                         created: new Date().toISOString(),
                         lastUpdated: new Date().toISOString()
                 };
                 events.push(saved);
                 importSummary.imported++;
                 importSummary.importSummaries.push({
                         responseType: 'ImportSummary',
                         status: 'SUCCESS',
                         reference: uid,
                         href: `http://dhis2-stub:4501/api/events/${uid}`
                 });
                 console.log(`[DHIS2-stub] Saved event uid=${uid} | orgUnit=${event.orgUnit} | date=${event.eventDate}`);
           });

           return res.status(200).json(importSummary);
});

// ── GET /api/events ───────────────────────────────────────────────────────────
app.get('/api/events', checkAuth, (req, res) => {
    const { orgUnit, program } = req.query;
    let filtered = events;
    if (orgUnit) filtered = filtered.filter((e) => e.orgUnit === orgUnit);
    if (program) filtered = filtered.filter((e) => e.program === program);

          return res.json({
                events: filtered,
                pager: { page: 1, pageCount: 1, total: filtered.length, pageSize: 50 }
          });
});

// ── GET /api/analytics (mock) ─────────────────────────────────────────────────
app.get('/api/analytics', checkAuth, (req, res) => {
    // Return mock aggregated commodity totals for dashboard charts
          return res.json({
                headers: [
                  { name: 'commodity', column: 'Commodity', type: 'TEXT' },
                  { name: 'total', column: 'Total Stock', type: 'NUMBER' },
                  { name: 'stockouts', column: 'Stockout Count', type: 'NUMBER' }
                      ],
                rows: [
                        ['Amoxicillin', '450', '2'],
                        ['ORS', '80', '1'],
                        ['Zinc', '320', '0'],
                        ['Malaria RDT', '55', '3'],
                        ['OCP', '25', '1'],
                        ['DMPA', '18', '0']
                      ],
                metaData: { dimensions: {}, items: {} }
          });
});

// ── GET /api/organisationUnits ────────────────────────────────────────────────
app.get('/api/organisationUnits', checkAuth, (req, res) => {
    return res.json({
          organisationUnits: [
            { id: 'CHU-001', displayName: 'Kibera CHU', level: 4 },
            { id: 'CHU-002', displayName: 'Mathare CHU', level: 4 },
            { id: 'CHU-003', displayName: 'Korogocho CHU', level: 4 },
            { id: 'CHU-004', displayName: 'Mukuru CHU', level: 4 },
            { id: 'CHU-005', displayName: 'Kawangware CHU', level: 4 }
                ]
    });
});

const PORT = process.env.PORT || 4501;
app.listen(PORT, () => console.log(`[DHIS2-stub] Listening on port ${PORT}`));
