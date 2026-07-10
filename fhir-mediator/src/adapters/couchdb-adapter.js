'use strict';

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * couchdb-adapter.js
 *
 * Writes a chp_stockout_alert document back into CHT's CouchDB/medic database
 * so that tasks.js can surface a stockout escalation task to the CHA inside eCHIS.
 *
 * Without this write-back, the mediator detects stockouts and escalates to AfyaKE
 * but nothing ever appears in the CHT app — CHPs and CHAs see no in-app alert.
 */

const COUCHDB_URL = process.env.COUCHDB_URL || 'http://admin:medic@couchdb:5984';
const DB          = `${COUCHDB_URL}/medic`;

/**
 * Write a chp_stockout_alert data_record to CouchDB.
 * CHT sentinel will pick it up; tasks.js surfaces it to the CHA.
 *
 * @param {Object} params
 * @param {string} params.chpId
 * @param {string} params.chpName
 * @param {string} params.chuId
 * @param {string} params.facilityId
 * @param {string} params.commodityCode
 * @param {string} params.commodityName
 * @param {string} params.supplyRequestId  - FHIR SupplyRequest UUID
 * @returns {Promise<{id: string}>}
 */
async function writeStockoutAlert({
  chpId,
  chpName,
  chuId,
  facilityId,
  commodityCode,
  commodityName,
  supplyRequestId
}) {
  const docId = `chp_stockout_alert-${chpId}-${commodityCode}-${Date.now()}`;

  const doc = {
    _id:           docId,
    type:          'data_record',
    form:          'chp_stockout_alert',
    reported_date: Date.now(),
    contact: {
      _id:    chpId,
      name:   chpName,
      parent: { _id: chuId }
    },
    fields: {
      chp_id:            chpId,
      chp_name:          chpName,
      chu_id:            chuId,
      facility_id:       facilityId,
      commodity_code:    commodityCode,
      commodity_name:    commodityName,
      supply_request_id: supplyRequestId,
      status:            'escalated'
    }
  };

  const response = await axios.put(`${DB}/${encodeURIComponent(docId)}`, doc, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000
  });

  console.log(`[couchdb-adapter] Wrote stockout alert doc: ${docId}`);
  return { id: docId, rev: response.data.rev };
}

module.exports = { writeStockoutAlert };
