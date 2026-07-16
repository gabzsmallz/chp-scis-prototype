'use strict';

const express = require('express');
const axios   = require('axios');
const { Pool } = require('pg');

const { chtToFhirInventoryReport, getStockoutCodes } = require('../mapper');
const { detectAndResolveStockouts }                  = require('../engine/stockout-detector');

const router = express.Router();

const pool = new Pool({
  host:     process.env.PG_HOST     || 'postgres',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DB       || 'cht_sync',
  user:     process.env.PG_USER     || 'cht',
  password: process.env.PG_PASSWORD || 'cht-password'
});

const ILMIS_URL  = process.env.ILMIS_URL  || 'http://ilmis-stub:4500';
const DHIS2_URL  = process.env.DHIS2_URL  || 'http://dhis2-stub:4501';
const DHIS2_AUTH = {
  username: process.env.DHIS2_USER || 'admin',
  password: process.env.DHIS2_PASS || 'district'
};

// Commodity code → human-readable label (for SupplyRequest descriptions)
const COMMODITY_LABELS = {
  'KE-RDT-MAL-001':       'Malaria RDT',
  'KE-ACT-AL-001':        'Artemether-Lumefantrine ACT',
  'KE-ORS-001':           'ORS Sachets',
  'KE-ZINC-20MG-001':     'Zinc Sulphate 20mg',
  'KE-VITA-200K-001':     'Vitamin A 200,000 IU',
  'KE-ITN-001':           'Insecticide-Treated Net',
  'KE-AMOX-250-001':      'Amoxicillin 250mg',
  'KE-CHLORHEX-001':      'Chlorhexidine gel',
  'KE-DEWORMING-ALB-001': 'Albendazole 400mg',
  'KE-FANSIDAR-001':      'SP/Fansidar (IPTp)',
  'KE-IRON-FOLATE-001':   'Ferrous Sulphate + Folic Acid',
  'KE-FP-COND-001':       'Male Condoms',
  'KE-BP-STRIPS-001':     'Blood Glucose Test Strips'
};

/**
 * POST /stock-report
 * Body: CHT stock_report document (JSON)
 *
 * Pipeline:
 *  1. Map CHT doc → FHIR R5 InventoryReport
 *  2. POST InventoryReport to iLMIS stub  (facility-level CHP stock visibility)
 *  3. POST stock event to DHIS2 stub      (aggregate reporting)
 *  4. Persist to PostgreSQL               (dashboard + lateral matcher)
 *  5. Detect stockouts → lateral or formal SupplyRequest
 */
router.post('/', async (req, res) => {
  try {
    const doc = req.body;

    if (!doc || !doc._id) {
      return res.status(400).json({ error: 'Invalid CHT document — missing _id' });
    }

    const chpId      = doc.contact?._id         || 'unknown-chp';
    const chpName    = doc.contact?.name         || 'Unknown CHP';
    const chuId      = doc.contact?.parent?._id  || 'unknown-chu';
    const facilityId = doc.fields?.facility_id   || chuId;

    // 1. Map to FHIR R5 InventoryReport
    const inventoryReport = chtToFhirInventoryReport(doc);
    const stockoutCodes   = getStockoutCodes(inventoryReport);
    const hasStockout     = stockoutCodes.length > 0;

    console.log(`[stock-route] CHP=${chpId} CHU=${chuId} stockouts=[${stockoutCodes.join(',')}]`);

    // 2. POST InventoryReport to iLMIS stub (facility visibility of CHP stock levels)
    let ilmisResponse = null;
    try {
      const r = await axios.post(`${ILMIS_URL}/fhir/InventoryReport`, inventoryReport, {
        headers: { 'Content-Type': 'application/fhir+json' },
        timeout: 5000
      });
      ilmisResponse = { status: r.status, id: r.data?.id };
    } catch (err) {
      ilmisResponse = { error: err.message };
    }

    // 3. POST stock events to DHIS2 stub (one event per commodity line)
    const commodities = normaliseCommodities(doc.fields);
    const dhis2Payload = {
      events: commodities.map((c) => ({
        program:   'CHP_STOCK_PROGRAM',
        orgUnit:   chuId,
        eventDate: new Date(doc.reported_date).toISOString().split('T')[0],
        status:    'COMPLETED',
        dataValues: [
          { dataElement: 'DE_STOCK_ON_HAND',  value: c.quantity_on_hand   ?? 0 },
          { dataElement: 'DE_COMMODITY_CODE', value: c.commodity_code          },
          { dataElement: 'DE_QTY_DISPENSED',  value: c.quantity_dispensed ?? 0 },
          { dataElement: 'DE_QTY_RECEIVED',   value: c.quantity_received  ?? 0 },
          { dataElement: 'DE_REPORT_DATE',    value: new Date(doc.reported_date).toISOString().split('T')[0] }
        ]
      }))
    };

    let dhis2Response = null;
    try {
      const r = await axios.post(`${DHIS2_URL}/api/events`, dhis2Payload, {
        auth:    DHIS2_AUTH,
        timeout: 5000
      });
      dhis2Response = { status: r.status };
    } catch (err) {
      dhis2Response = { error: err.message };
    }

    // 4. Persist to PostgreSQL (upsert per doc._id + commodity_code)
    let pgError = null;
    try {
      for (const c of commodities) {
        await pool.query(
          `INSERT INTO stock_reports
             (doc_id, chp_id, chp_name, chu_id, commodity_code, commodity_name,
              quantity_on_hand, quantity_dispensed, quantity_received,
              expiry_date, reported_date, has_stockout, fhir_resource)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           ON CONFLICT (doc_id, commodity_code) DO UPDATE SET
             quantity_on_hand   = EXCLUDED.quantity_on_hand,
             quantity_dispensed = EXCLUDED.quantity_dispensed,
             quantity_received  = EXCLUDED.quantity_received,
             expiry_date        = EXCLUDED.expiry_date,
             reported_date      = EXCLUDED.reported_date,
             has_stockout       = EXCLUDED.has_stockout,
             fhir_resource      = EXCLUDED.fhir_resource`,
          [
            doc._id,
            chpId,
            chpName,
            chuId,
            c.commodity_code,
            c.commodity_name || COMMODITY_LABELS[c.commodity_code] || c.commodity_code,
            parseInt(c.quantity_on_hand   ?? 0, 10),
            parseInt(c.quantity_dispensed ?? 0, 10),
            parseInt(c.quantity_received  ?? 0, 10),
            c.expiry_date || null,
            new Date(doc.reported_date),
            parseInt(c.quantity_on_hand ?? 1, 10) === 0,
            JSON.stringify(inventoryReport)
          ]
        );
      }
    } catch (err) {
      pgError = err.message;
      console.error('[stock-route] PostgreSQL error:', err.message);
    }

    // 5. Detect stockouts → always escalate formally to facility
    let formalRequests = [];
    if (hasStockout) {
      try {
        formalRequests = await detectAndResolveStockouts({
          stockoutCodes,
          chpId,
          chpName,
          chuId,
          facilityId,
          commodityLabels: COMMODITY_LABELS
        });

        // Persist formal SupplyRequests to supply_requests table
        for (const entry of formalRequests) {
          await pool.query(
            `INSERT INTO supply_requests
               (request_id, type, requester_chp_id, supplier_chp_id,
                facility_id, chu_id, commodity_code, quantity_requested,
                status, fhir_resource)
             VALUES ($1,'formal',$2,$3,$4,$5,$6,$7,'active',$8)
             ON CONFLICT (request_id) DO NOTHING`,
            [
              entry.supplyRequest.id,
              chpId, null,
              facilityId, chuId,
              entry.commodityCode,
              entry.supplyRequest.quantity?.value || 1,
              JSON.stringify(entry.supplyRequest)
            ]
          );
        }
      } catch (err) {
        console.error('[stock-route] stockout-detector error:', err.message);
        formalRequests = [{ error: err.message }];
      }
    }

    return res.status(201).json({
      message:           'Stock report processed',
      inventoryReportId: inventoryReport.id,
      hasStockout,
      stockoutCodes,
      ilmis:     ilmisResponse,
      dhis2:     dhis2Response,
      postgres:  pgError ? { error: pgError } : { ok: true },
      resupply:  { formal: formalRequests }
    });

  } catch (err) {
    console.error('[stock-route] Unhandled error:', err);
    return res.status(500).json({ error: err.message });
  }
});

function normaliseCommodities(fields) {
  if (!fields) return [];
  if (Array.isArray(fields.commodities)) return fields.commodities;
  if (fields.commodity_code) {
    return [{
      commodity_code:     fields.commodity_code,
      commodity_name:     fields.commodity_name,
      quantity_on_hand:   fields.quantity_on_hand,
      quantity_dispensed: fields.quantity_dispensed,
      quantity_received:  fields.quantity_received,
      expiry_date:        fields.expiry_date
    }];
  }
  return [];
}

module.exports = router;
