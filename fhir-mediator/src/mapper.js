'use strict';

const { v4: uuidv4 } = require('uuid');

/**
 * mapper.js
 * Transforms a CHT stock_report document into a FHIR R4 InventoryReport resource.
 *
 * CHT stock_report form fields:
 *   doc.fields.commodities[]            - repeating group, one entry per commodity
 *     .commodity_code                   - KEMSA commodity code
 *     .commodity_name                   - human-readable name
 *     .quantity_on_hand                 - current stock count (≥ 0)
 *     .quantity_dispensed               - units dispensed since last report
 *     .quantity_received                - units received since last report
 *     .expiry_date                      - nearest expiry (YYYY-MM-DD)
 *   doc.contact._id                     - CHP practitioner ID
 *   doc.contact.name                    - CHP name
 *   doc.contact.parent._id             - CHU (Community Health Unit) / facility ID
 *   doc.reported_date                   - epoch ms
 */

const STOCKOUT_THRESHOLD = 0; // quantity_on_hand = 0 → stockout

/**
 * Convert a CHT stock_report doc to a FHIR R4 InventoryReport.
 * @param {Object} doc  - CouchDB document from CHT
 * @returns {Object}    - FHIR R4 InventoryReport resource
 */
function chtToFhirInventoryReport(doc) {
  const reportedDate = new Date(doc.reported_date).toISOString();
  const chpId  = doc.contact?._id         || 'unknown-chp';
  const chuId  = doc.contact?.parent?._id || 'unknown-chu';

  const commodities = normaliseCommodities(doc.fields);

  const items = commodities.map((c) => ({
    category: {
      coding: [{
        system:  'https://kemsa.go.ke/commodity-codes',
        code:    c.commodity_code,
        display: c.commodity_name || c.commodity_code
      }]
    },
    quantity: {
      value:  parseInt(c.quantity_on_hand ?? 0, 10),
      unit:   'units',
      system: 'http://unitsofmeasure.org',
      code:   '{each}'
    },
    extension: [
      {
        url:          'https://chp-scis.health.go.ke/fhir/StructureDefinition/quantity-dispensed',
        valueInteger: parseInt(c.quantity_dispensed ?? 0, 10)
      },
      {
        url:          'https://chp-scis.health.go.ke/fhir/StructureDefinition/quantity-received',
        valueInteger: parseInt(c.quantity_received ?? 0, 10)
      },
      ...(c.expiry_date ? [{
        url:       'https://chp-scis.health.go.ke/fhir/StructureDefinition/expiry-date',
        valueDate: c.expiry_date
      }] : [])
    ]
  }));

  // Stockout flags — commodities where quantity_on_hand = 0
  const stockoutCodes = commodities
    .filter((c) => parseInt(c.quantity_on_hand ?? 1, 10) <= STOCKOUT_THRESHOLD)
    .map((c) => c.commodity_code);

  return {
    resourceType: 'InventoryReport',
    id:           doc._id || uuidv4(),
    meta: {
      profile:     ['https://chp-scis.health.go.ke/fhir/StructureDefinition/CHPStockReport'],
      lastUpdated: reportedDate
    },
    status:    'final',
    countType: 'snapshot',
    reportedDateTime: reportedDate,
    reporter: {
      reference: `Practitioner/${chpId}`,
      display:   doc.contact?.name || 'Unknown CHP'
    },
    reportingPeriod: {
      start: reportedDate,
      end:   reportedDate
    },
    inventoryListing: [{
      location: {
        reference: `Location/${chuId}`,
        display:   `CHU ${chuId}`
      },
      items
    }],
    extension: stockoutCodes.length > 0 ? [{
      url:         'https://chp-scis.health.go.ke/fhir/StructureDefinition/stockout-codes',
      valueString: stockoutCodes.join(',')
    }] : []
  };
}

/**
 * Support two form layouts:
 *  A) doc.fields.commodities = [ { commodity_code, quantity_on_hand, ... }, ... ]
 *  B) doc.fields.commodity_code / quantity_on_hand (single-commodity submission)
 */
function normaliseCommodities(fields) {
  if (!fields) return [];
  if (Array.isArray(fields.commodities)) return fields.commodities;
  if (fields.commodity_code) {
    return [{
      commodity_code:    fields.commodity_code,
      commodity_name:    fields.commodity_name,
      quantity_on_hand:  fields.quantity_on_hand,
      quantity_dispensed: fields.quantity_dispensed,
      quantity_received:  fields.quantity_received,
      expiry_date:        fields.expiry_date
    }];
  }
  return [];
}

/**
 * Returns the list of commodity codes with zero stock from an InventoryReport.
 * Used by the stockout detector.
 * @param {Object} inventoryReport - FHIR R4 InventoryReport
 * @returns {string[]} commodity codes at zero
 */
function getStockoutCodes(inventoryReport) {
  const ext = inventoryReport.extension?.find(
    (e) => e.url.endsWith('stockout-codes')
  );
  if (!ext || !ext.valueString) return [];
  return ext.valueString.split(',').filter(Boolean);
}

/**
 * Build a FHIR R4 Bundle of InventoryReport resources from an array of docs.
 */
function buildBundle(docs) {
  return {
    resourceType: 'Bundle',
    type:  'collection',
    entry: docs.map((doc) => ({ resource: chtToFhirInventoryReport(doc) }))
  };
}

module.exports = { chtToFhirInventoryReport, buildBundle, getStockoutCodes };
