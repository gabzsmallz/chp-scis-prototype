'use strict';

const { queryNeighbourCHPs } = require('./lateral-supply-matcher');
const { buildSupplyRequest }  = require('../fhir/supply-request-builder');
const { postToAfyaKE }        = require('../adapters/afyake-adapter');

/**
 * stockout-detector.js
 *
 * For each commodity code that is at zero in the InventoryReport:
 *  1. Query chp_stock_latest for a neighbour CHP in the same CHU with surplus
 *  2. If found → build a lateral SupplyRequest (CHP-to-CHP)
 *  3. If not found → build a formal SupplyRequest and POST to AfyaKE (facility LMIS)
 *
 * Returns a summary object for logging / OpenHIM audit trail.
 */

/**
 * @param {Object}   params
 * @param {Object}   params.inventoryReport   - FHIR R4 InventoryReport already built
 * @param {string[]} params.stockoutCodes      - commodity codes at zero
 * @param {string}   params.chpId
 * @param {string}   params.chuId
 * @param {string}   params.facilityId         - facility the CHP is attached to
 * @param {Object}   params.commodityLabels    - { code: displayName } lookup
 * @param {import('pg').Pool} params.pool      - postgres pool for lateral query
 * @returns {Promise<{lateral: Object[], formal: Object[]}>}
 */
async function detectAndResolveStockouts({
  inventoryReport,
  stockoutCodes,
  chpId,
  chuId,
  facilityId,
  commodityLabels,
  pool
}) {
  const lateral = [];
  const formal  = [];

  for (const commodityCode of stockoutCodes) {
    const commodityName = commodityLabels[commodityCode] || commodityCode;

    // 1. Try to find a lateral supplier in the same CHU
    let neighbour = null;
    try {
      neighbour = await queryNeighbourCHPs(pool, chuId, chpId, commodityCode);
    } catch (err) {
      console.warn(`[stockout-detector] lateral query failed for ${commodityCode}: ${err.message}`);
    }

    if (neighbour) {
      // 2. Lateral SupplyRequest (CHP-to-CHP)
      const supplyReq = buildSupplyRequest({
        type:              'lateral',
        requesterChpId:    chpId,
        supplierChpId:     neighbour.chpId,
        commodityCode,
        commodityName,
        quantityRequested: Math.min(neighbour.availableQty, 5), // ask for at most 5 units
        chuId
      });

      console.log(`[stockout-detector] LATERAL match for ${commodityCode}: supplier CHP=${neighbour.chpId} (has ${neighbour.availableQty} units)`);
      lateral.push({ commodityCode, supplyRequest: supplyReq, supplierChpId: neighbour.chpId });

    } else {
      // 3. Formal SupplyRequest → facility LMIS (AfyaKE)
      const supplyReq = buildSupplyRequest({
        type:              'formal',
        requesterChpId:    chpId,
        facilityId,
        commodityCode,
        commodityName,
        quantityRequested: 10, // default resupply quantity
        chuId
      });

      console.log(`[stockout-detector] FORMAL request for ${commodityCode}: CHP=${chpId} → Facility=${facilityId}`);

      let afyaKeResponse = null;
      try {
        afyaKeResponse = await postToAfyaKE(supplyReq);
      } catch (err) {
        console.error(`[stockout-detector] AfyaKE POST failed for ${commodityCode}: ${err.message}`);
        afyaKeResponse = { error: err.message };
      }

      formal.push({ commodityCode, supplyRequest: supplyReq, afyaKeResponse });
    }
  }

  return { lateral, formal };
}

module.exports = { detectAndResolveStockouts };
