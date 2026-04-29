'use strict';

/**
 * mapper.js
  * Transforms a CHT stock_report document into a FHIR R4 SupplyDelivery resource.
   *
    * CHT stock_report fields (from cht-app/forms/stock_report.json):
     *   doc.fields.amoxicillin_stock, doc.fields.ors_stock, doc.fields.zinc_stock,
      *   doc.fields.rdt_stock, doc.fields.fp_pills_stock, doc.fields.fp_injectables_stock
       *   doc.contact._id (CHP id), doc.contact.name, doc.contact.parent._id (CHU id)
        *   doc.reported_date (epoch ms)
         */

         // SNOMED / KEMSA commodity codes
         const COMMODITY_CODES = {
           amoxicillin:    { code: '372687004', display: 'Amoxicillin 250mg tabs (x100)', kemsa: 'KEMSA-AMX-250' },
             ors:            { code: '386982006', display: 'ORS sachets (x10)',              kemsa: 'KEMSA-ORS-010' },
               zinc:           { code: '395742004', display: 'Zinc sulfate 20mg tabs (x60)',   kemsa: 'KEMSA-ZNC-020' },
                 rdt:            { code: '426329006', display: 'Malaria RDT (x25)',               kemsa: 'KEMSA-RDT-MAL' },
                   fp_pills:       { code: '372665008', display: 'Combined OCP (cycle x28)',        kemsa: 'KEMSA-FP-OCP' },
                     fp_injectables: { code: '407153003', display: 'DMPA injectable 150mg/mL',        kemsa: 'KEMSA-FP-INJ' }
                     };

                     // Stockout threshold (units) — configurable per commodity
                     const STOCKOUT_THRESHOLD = {
                       amoxicillin: 10,
                         ors: 5,
                           zinc: 10,
                             rdt: 5,
                               fp_pills: 3,
                                 fp_injectables: 2
                                 };

                                 /**
                                  * Convert a CHT stock_report doc to FHIR R4 SupplyDelivery
                                   * @param {Object} doc  - CouchDB document from CHT
                                    * @returns {Object}    - FHIR R4 SupplyDelivery resource
                                     */
                                     function chtToFhirSupplyDelivery(doc) {
                                       const reportedDate = new Date(doc.reported_date).toISOString();
                                         const chpId = doc.contact?._id || 'unknown-chp';
                                           const chpName = doc.contact?.name || 'Unknown CHP';
                                             const chuId = doc.contact?.parent?._id || 'unknown-chu';

                                               const suppliedItems = Object.entries(COMMODITY_CODES).map(([key, commodity]) => {
                                                   const fieldName = `${key}_stock`;
                                                       const qty = parseInt(doc.fields?.[fieldName] ?? 0, 10);
                                                           return {
                                                                 quantity: { value: qty, unit: 'units', system: 'http://unitsofmeasure.org', code: '{units}' },
                                                                       itemCodeableConcept: {
                                                                               coding: [
                                                                                         { system: 'http://snomed.info/sct', code: commodity.code, display: commodity.display },
                                                                                                   { system: 'https://kemsa.go.ke/commodities', code: commodity.kemsa, display: commodity.display }
                                                                                                           ],
                                                                                                                   text: commodity.display
                                                                                                                         }
                                                                                                                             };
                                                                                                                               });
                                                                                                                               
                                                                                                                                 // Stockout flags as extensions
                                                                                                                                   const stockoutFlags = Object.entries(COMMODITY_CODES)
                                                                                                                                       .filter(([key]) => {
                                                                                                                                             const qty = parseInt(doc.fields?.[`${key}_stock`] ?? 0, 10);
                                                                                                                                                   return qty <= STOCKOUT_THRESHOLD[key];
                                                                                                                                                       })
                                                                                                                                                           .map(([key, commodity]) => ({
                                                                                                                                                                 url: 'https://chp-scis.health.go.ke/fhir/StructureDefinition/stockout-flag',
                                                                                                                                                                       extension: [
                                                                                                                                                                               { url: 'commodity', valueString: commodity.kemsa },
                                                                                                                                                                                       { url: 'quantity', valueInteger: parseInt(doc.fields?.[`${key}_stock`] ?? 0, 10) },
                                                                                                                                                                                               { url: 'threshold', valueInteger: STOCKOUT_THRESHOLD[key] }
                                                                                                                                                                                                     ]
                                                                                                                                                                                                         }));
                                                                                                                                                                                                         
                                                                                                                                                                                                           return {
                                                                                                                                                                                                               resourceType: 'SupplyDelivery',
                                                                                                                                                                                                                   id: doc._id,
                                                                                                                                                                                                                       meta: {
                                                                                                                                                                                                                             profile: ['https://chp-scis.health.go.ke/fhir/StructureDefinition/CHPStockReport'],
                                                                                                                                                                                                                                   lastUpdated: reportedDate
                                                                                                                                                                                                                                       },
                                                                                                                                                                                                                                           extension: stockoutFlags,
                                                                                                                                                                                                                                               status: 'completed',
                                                                                                                                                                                                                                                   type: {
                                                                                                                                                                                                                                                         coding: [{ system: 'http://terminology.hl7.org/CodeSystem/supply-type', code: 'central', display: 'Central Supply' }]
                                                                                                                                                                                                                                                             },
                                                                                                                                                                                                                                                                 suppliedItem: suppliedItems,
                                                                                                                                                                                                                                                                     occurrenceDateTime: reportedDate,
                                                                                                                                                                                                                                                                         supplier: {
                                                                                                                                                                                                                                                                               reference: `Practitioner/${chpId}`,
                                                                                                                                                                                                                                                                                     display: chpName
                                                                                                                                                                                                                                                                                         },
                                                                                                                                                                                                                                                                                             destination: {
                                                                                                                                                                                                                                                                                                   reference: `Location/${chuId}`,
                                                                                                                                                                                                                                                                                                         display: `CHU ${chuId}`
                                                                                                                                                                                                                                                                                                             }
                                                                                                                                                                                                                                                                                                               };
                                                                                                                                                                                                                                                                                                               }
                                                                                                                                                                                                                                                                                                               
                                                                                                                                                                                                                                                                                                               /**
                                                                                                                                                                                                                                                                                                                * Build a FHIR R4 Bundle of SupplyDelivery resources from an array of CHT docs
                                                                                                                                                                                                                                                                                                                 */
                                                                                                                                                                                                                                                                                                                 function buildBundle(docs) {
                                                                                                                                                                                                                                                                                                                   return {
                                                                                                                                                                                                                                                                                                                       resourceType: 'Bundle',
                                                                                                                                                                                                                                                                                                                           type: 'collection',
                                                                                                                                                                                                                                                                                                                               entry: docs.map((doc) => ({
                                                                                                                                                                                                                                                                                                                                     resource: chtToFhirSupplyDelivery(doc)
                                                                                                                                                                                                                                                                                                                                         }))
                                                                                                                                                                                                                                                                                                                                           };
                                                                                                                                                                                                                                                                                                                                           }
                                                                                                                                                                                                                                                                                                                                           
                                                                                                                                                                                                                                                                                                                                           module.exports = { chtToFhirSupplyDelivery, buildBundle, STOCKOUT_THRESHOLD };
