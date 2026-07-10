'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * supply-request-builder.js
 *
 * Builds a FHIR R4 SupplyRequest for formal CHP-to-facility resupply.
 * The CHP requests stock from their attached facility; the facility handles
 * the upward chain: sub-county coordinator → county pharmacist → KEMSA/MEDS.
 */

/**
 * @param {Object} params
 * @param {string} params.requesterChpId   - CHP who needs stock
 * @param {string} params.facilityId       - facility the CHP is attached to
 * @param {string} params.commodityCode    - KEMSA commodity code
 * @param {string} params.commodityName    - human-readable name
 * @param {number} params.quantityRequested
 * @param {string} params.chuId
 * @returns {Object} FHIR R4 SupplyRequest
 */
function buildSupplyRequest({
  requesterChpId,
  facilityId,
  commodityCode,
  commodityName,
  quantityRequested,
  chuId
}) {
  return {
    resourceType: 'SupplyRequest',
    id:     uuidv4(),
    status: 'active',
    category: {
      coding: [{
        system:  'http://terminology.hl7.org/CodeSystem/supply-kind',
        code:    'nonstock',
        display: 'Formal Replenishment'
      }],
      text: 'Formal Replenishment'
    },
    item: {
      itemCodeableConcept: {
        coding: [{
          system:  'https://kemsa.go.ke/commodity-codes',
          code:    commodityCode,
          display: commodityName || commodityCode
        }]
      }
    },
    quantity: {
      value:  quantityRequested || 1,
      unit:   'units',
      system: 'http://unitsofmeasure.org',
      code:   '{each}'
    },
    requester: {
      reference: `Practitioner/${requesterChpId}`,
      display:   `CHP ${requesterChpId}`
    },
    deliverTo: {
      reference: `Location/${chuId}`,
      display:   `CHU ${chuId}`
    },
    deliverFrom: {
      reference: `Organization/${facilityId}`
    },
    authoredOn: new Date().toISOString(),
    extension: [{
      url:            'https://chp-scis.health.go.ke/fhir/StructureDefinition/supplying-facility',
      valueReference: { reference: `Organization/${facilityId}` }
    }]
  };
}

module.exports = { buildSupplyRequest };
