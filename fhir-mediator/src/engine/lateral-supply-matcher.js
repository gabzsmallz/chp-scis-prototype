'use strict';

/**
 * lateral-supply-matcher.js
 *
 * Queries the chp_stock_latest view to find a neighbouring CHP in the same CHU
 * who has surplus stock of a given commodity.
 *
 * "Surplus" is defined as quantity_on_hand > LATERAL_SURPLUS_THRESHOLD (default 2)
 * so a CHP only donates if they have meaningful stock above their own buffer.
 */

const LATERAL_SURPLUS_THRESHOLD = 2;

/**
 * @param {import('pg').Pool} pool
 * @param {string} chuId          - CHU the stockout CHP belongs to
 * @param {string} excludeChpId   - the CHP who has the stockout (exclude from results)
 * @param {string} commodityCode  - KEMSA commodity code that is at zero
 * @returns {Promise<{chpId: string, availableQty: number}|null>}
 */
async function queryNeighbourCHPs(pool, chuId, excludeChpId, commodityCode) {
  const result = await pool.query(
    `SELECT chp_id, quantity_on_hand
     FROM chp_stock_latest
     WHERE chu_id        = $1
       AND chp_id        != $2
       AND commodity_code = $3
       AND quantity_on_hand > $4
     ORDER BY quantity_on_hand DESC
     LIMIT 1`,
    [chuId, excludeChpId, commodityCode, LATERAL_SURPLUS_THRESHOLD]
  );

  if (result.rows.length === 0) return null;
  return {
    chpId:        result.rows[0].chp_id,
    availableQty: parseInt(result.rows[0].quantity_on_hand, 10)
  };
}

module.exports = { queryNeighbourCHPs };
