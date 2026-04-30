'use strict';

const express = require('express');
const mediatorUtils = require('openhim-mediator-utils');
const winston = require('winston');
const stockRoutes = require('./routes/stock');
const reportsRoutes = require('./routes/reports');

// ── Logger ──────────────────────────────────────────────────────────────────
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
            winston.format.json()
              ),
                transports: [new winston.transports.Console()]
                });

                // ── OpenHIM mediator config ──────────────────────────────────────────────────
                const mediatorConfig = {
                  urn: 'urn:mediator:chp-scis-fhir-mediator',
                    version: '1.0.0',
                      name: 'CHP-SCIS FHIR Mediator',
                        description: 'Bridges CHT stock reports to iLMIS (FHIR R4) and DHIS2 Tracker',
                          defaultChannelConfig: [
                              {
                                    name: 'CHP Stock Report Channel',
                                          urlPattern: '^/stock-report$',
                                                routes: [{ name: 'FHIR Mediator Route', host: 'fhir-mediator', port: 3000, path: '/stock-report', primary: true }],
                                                      allow: ['chp-role'],
                                                            methods: ['POST'],
                                                                  type: 'http'
                                                                      }
                                                                        ],
                                                                          endpoints: [
                                                                              { name: 'Stock Report', host: 'fhir-mediator', path: '/stock-report', port: 3000, primary: true, type: 'http' }
                                                                                ]
                                                                                };

                                                                                const openhimConfig = {
                                                                                  apiURL: process.env.OPENHIM_API_URL || 'https://openhim-core:8080',
                                                                                    username: process.env.OPENHIM_USER || 'root@openhim.org',
                                                                                      password: process.env.OPENHIM_PASS || 'openhim-password',
                                                                                        trustSelfSigned: true
                                                                                        };

                                                                                        // ── Express app ──────────────────────────────────────────────────────────────
                                                                                        const app = express();
                                                                                        app.use(express.json());

                                                                                        // Health check
                                                                                        app.get('/health', (_req, res) => res.json({ status: 'ok', mediator: 'chp-scis-fhir-mediator' }));

                                                                                        // Routes
                                                                                        app.use('/stock-report', stockRoutes);
                                                                                        app.use('/reports', reportsRoutes);

                                                                                        // ── Start ────────────────────────────────────────────────────────────────────
                                                                                        const PORT = process.env.PORT || 3000;

                                                                                        app.listen(PORT, () => {
                                                                                          logger.info(`FHIR Mediator listening on port ${PORT}`);

                                                                                            // Register with OpenHIM (non-blocking — simulation env may start before OpenHIM is ready)
                                                                                              mediatorUtils.registerMediator(openhimConfig, mediatorConfig, (err) => {
                                                                                                  if (err) {
                                                                                                        logger.warn('OpenHIM registration failed (will retry on next restart)', { error: err.message });
                                                                                                            } else {
                                                                                                                  logger.info('Registered with OpenHIM successfully');
                                                                                                                        mediatorUtils.activateHeartbeat(openhimConfig);
                                                                                                                            }
                                                                                                                              });
                                                                                                                              });
