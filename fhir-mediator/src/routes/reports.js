'use strict';

const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

const pool = new Pool({
  host:     process.env.PG_HOST     || 'postgres',
  port:     parseInt(process.env.PG_PORT || '5432'),
  database: process.env.PG_DB       || 'cht_sync',
  user:     process.env.PG_USER     || 'cht',
  password: process.env.PG_PASSWORD || 'cht-password'
});

/**
 * GET /reports/stock
 * Returns latest stock rows per CHP + commodity (for table in dashboard).
 * Query params:
 *   ?chu_id=<id>        - filter by CHU
 *   ?stockout_only=true - only rows where has_stockout = true
 *   ?limit=100
 */
router.get('/stock', async (req, res) => {
  try {
    const { chu_id, stockout_only, limit = 100 } = req.query;

    let sql = `
      SELECT chp_id, chp_name, chu_id,
             commodity_code, commodity_name,
             quantity_on_hand, quantity_dispensed, quantity_received,
             expiry_date, reported_date, has_stockout
      FROM   chp_stock_latest
      WHERE  1=1`;
    const params = [];

    if (chu_id) {
      params.push(chu_id);
      sql += ` AND chu_id = $${params.length}`;
    }
    if (stockout_only === 'true') {
      sql += ' AND has_stockout = true';
    }

    params.push(parseInt(limit, 10));
    sql += ` ORDER BY reported_date DESC, chp_id, commodity_code LIMIT $${params.length}`;

    const { rows } = await pool.query(sql, params);
    return res.json(rows);

  } catch (err) {
    console.error('[reports/stock]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /reports/summary
 * Aggregated counts for dashboard SummaryCards.
 */
router.get('/summary', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COUNT(DISTINCT doc_id)                           AS total_reports,
        COUNT(*) FILTER (WHERE has_stockout = true)      AS stockout_commodity_lines,
        COUNT(DISTINCT chp_id) FILTER (WHERE has_stockout = true) AS chps_with_stockout,
        MAX(reported_date)                               AS last_report_date
      FROM stock_reports
    `);
    return res.json(rows[0]);
  } catch (err) {
    console.error('[reports/summary]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /reports/alerts
 * All commodity lines currently at zero — grouped by CHP.
 */
router.get('/alerts', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT chp_id, chp_name, chu_id,
             commodity_code, commodity_name,
             quantity_on_hand, reported_date
      FROM   chp_stock_latest
      WHERE  has_stockout = true
      ORDER  BY reported_date DESC, chp_id
      LIMIT  100
    `);
    return res.json(rows);
  } catch (err) {
    console.error('[reports/alerts]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /reports/supply-requests
 * Recent SupplyRequests (lateral + formal) for audit display.
 */
router.get('/supply-requests', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT request_id, type, requester_chp_id, supplier_chp_id,
             facility_id, chu_id, commodity_code, quantity_requested,
             status, created_at
      FROM   supply_requests
      ORDER  BY created_at DESC
      LIMIT  100
    `);
    return res.json(rows);
  } catch (err) {
    console.error('[reports/supply-requests]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
