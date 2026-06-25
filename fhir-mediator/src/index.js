'use strict';

const express       = require('express');
const mediatorUtils = require('openhim-mediator-utils');
const winston       = require('winston');

const stockRoutes   = require('./routes/stock');
const reportsRoutes = require('./routes/reports');

// ── Logger ────────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level:      process.env.LOG_LEVEL || 'info',
  format:     winston.format.combine(winston.format.timestamp(), winston.format.json()),
  transports: [new winston.transports.Console()]
});

// ── OpenHIM mediator config ───────────────────────────────────────────────────
const mediatorConfig = {
  urn:         'urn:mediator:chp-scis-fhir-mediator',
  version:     '2.0.0',
  name:        'CHP-SCIS FHIR Stock Mediator',
  description: 'Transforms CHT stock reports to FHIR InventoryReport, detects stockouts, triggers lateral CHP-to-CHP or formal facility SupplyRequests, and forwards to iLMIS, AfyaKE, DHIS2 and PostgreSQL.',
  defaultChannelConfig: [
    {
      name:       'CHP Stock Report Channel',
      urlPattern: '^/stock-report$',
      routes: [{
        name:    'FHIR Mediator Route',
        host:    'fhir-mediator',
        port:    3000,
        path:    '/stock-report',
        primary: true
      }],
      allow:   ['chp-role'],
      methods: ['POST'],
      type:    'http'
    }
  ],
  endpoints: [
    { name: 'Stock Report', host: 'fhir-mediator', path: '/stock-report', port: 3000, primary: true, type: 'http' }
  ]
};

const openhimConfig = {
  apiURL:          process.env.OPENHIM_API_URL || process.env.OPENHIM_URL || 'https://openhim-core:8080',
  username:        process.env.OPENHIM_USER    || 'root@openhim.org',
  password:        process.env.OPENHIM_PASS    || process.env.OPENHIM_PASSWORD || 'openhim1',
  trustSelfSigned: true
};

// ── Express app ───────────────────────────────────────────────────────────────
const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({
  status:   'ok',
  mediator: 'chp-scis-fhir-mediator',
  version:  mediatorConfig.version
}));

app.use('/stock-report', stockRoutes);
app.use('/reports',      reportsRoutes);

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '3000', 10);

app.listen(PORT, () => {
  logger.info(`[fhir-mediator] Listening on port ${PORT}`);

  mediatorUtils.registerMediator(openhimConfig, mediatorConfig, (err) => {
    if (err) {
      logger.warn('[fhir-mediator] OpenHIM registration failed — will continue without it', { error: err.message });
    } else {
      logger.info('[fhir-mediator] Registered with OpenHIM');
      mediatorUtils.activateHeartbeat(openhimConfig);
    }
  });
});
