'use strict';

const axios = require('axios');

/**
 * afyake-adapter.js
 *
 * Sends a formal FHIR R4 SupplyRequest to AfyaKE — the facility-level EMR/LMIS.
 *
 * In the Kenya supply chain, CHPs get stock FROM their attached facility.
 * When a CHP has a stockout and no lateral neighbour can help, this adapter
 * posts a SupplyRequest to the facility so that the facility's supply officer
 * can fulfil the request.  The facility then manages its own upward requisition
 * chain: facility → sub-county commodity coordinator → county pharmacist → KEMSA.
 */

const AFYAKE_URL = process.env.AFYAKE_URL || 'http://afyake-stub:4502';

/**
 * POST a SupplyRequest to AfyaKE.
 * @param {Object} supplyRequest - FHIR R4 SupplyRequest
 * @returns {Promise<Object>}    - AfyaKE response body
 */
async function postToAfyaKE(supplyRequest) {
  const response = await axios.post(
    `${AFYAKE_URL}/fhir/SupplyRequest`,
    supplyRequest,
    {
      headers: { 'Content-Type': 'application/fhir+json' },
      timeout: 6000
    }
  );
  return response.data;
}

module.exports = { postToAfyaKE };
