'use strict';

const { buildSupplyRequest } = require('../fhir/supply-request-builder');
const { postToAfyaKE }       = require('../adapters/afyake-adapter');
const { writeStockoutAlert } = require('../adapters/couchdb-adapter');

/**
 * stockout-detector.js
 *
 * For each commodity code at zero in the InventoryReport:
 *  1. Build a formal FHIR R5 SupplyRequest and POST to AfyaKE (facility LMIS)
 *  2. Write a chp_stockout_alert doc back to CouchDB so the CHA sees an
 *     in-app escalation task inside eCHIS
 *
 * The facility handles upward requisition: sub-county → county pharmacist → KEMSA.
 */

/**
 * @param {Object}   params
 * @param {string[]} params.stockoutCodes     - commodity codes at zero
 * @param {string}   params.chpId
 * @param {string}   params.chpName
 * @param {string}   params.chuId
 * @param {string}   params.facilityId
 * @param {Object}   params.commodityLabels   - { code: displayName }
 * @returns {Promise<Object[]>}
 */
async function detectAndResolveStockouts({
  stockoutCodes,
  chpId,
  chpName,
  chuId,
  facilityId,
  commodityLabels
}) {
  const formal = [];

  for (const commodityCode of stockoutCodes) {
    const commodityName = commodityLabels[commodityCode] || commodityCode;

    // 1. Build formal SupplyRequest → AfyaKE (facility LMIS)
    const supplyReq = buildSupplyRequest({
      requesterChpId:    chpId,
      facilityId,
      commodityCode,
      commodityName,
      quantityRequested: 10,
      chuId
    });

    console.log(`[stockout-detector] FORMAL escalation: CHP=${chpId} commodity=${commodityCode} → Facility=${facilityId}`);

    let afyaKeResponse = null;
    try {
      afyaKeResponse = await postToAfyaKE(supplyReq);
    } catch (err) {
      console.error(`[stockout-detector] AfyaKE POST failed for ${commodityCode}: ${err.message}`);
      afyaKeResponse = { error: err.message };
    }

    // 2. Write chp_stockout_alert back to CouchDB → CHA sees in-app task
    let couchDbResult = null;
    try {
      couchDbResult = await writeStockoutAlert({
        chpId,
        chpName,
        chuId,
        facilityId,
        commodityCode,
        commodityName,
        supplyRequestId: supplyReq.id
      });
    } catch (err) {
      console.error(`[stockout-detector] CouchDB write-back failed for ${commodityCode}: ${err.message}`);
      couchDbResult = { error: err.message };
    }

    formal.push({ commodityCode, supplyRequest: supplyReq, afyaKeResponse, couchDbAlert: couchDbResult });
  }

  return formal;
}

module.exports = { detectAndResolveStockouts };
