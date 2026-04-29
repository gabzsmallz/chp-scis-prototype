'use strict';

const express = require('express');
const { Pool } = require('pg');
const { buildBundle } = require('../mapper');

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
 * Returns all stock reports as FHIR R4 Bundle (for dashboard and iLMIS queries)
 * Query params:
 *   ?chu_id=<id>        - filter by CHU
 *   ?stockout_only=true - return only reports with stockout flags
 *   ?limit=50           - max records (default 100)
 */
router.get('/stock', async (req, res) => {
    try {
          const { chu_id, stockout_only, limit = 100 } = req.query;

      let sql = 'SELECT fhir_resource FROM stock_reports WHERE 1=1';
          const params = [];

      if (chu_id) {
              params.push(chu_id);
              sql += ` AND chu_id = $${params.length}`;
      }
          if (stockout_only === 'true') {
                  sql += ' AND has_stockout = true';
          }

      params.push(parseInt(limit, 10));
          sql += ` ORDER BY reported_date DESC LIMIT $${params.length}`;

      const { rows } = await pool.query(sql, params);
          const docs = rows.map((r) => r.fhir_resource);

      res.setHeader('Content-Type', 'application/fhir+json');
          return res.json(buildBundle(docs));

    } catch (err) {
          console.error('reports/stock error:', err);
          return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /reports/summary
 * Returns aggregated stockout summary per commodity (for dashboard cards)
 */
router.get('/summary', async (req, res) => {
    try {
          const { rows } = await pool.query(`
                SELECT
                        COUNT(*) FILTER (WHERE has_stockout = true) AS reports_with_stockout,
                                COUNT(*) AS total_reports,
                                        MAX(reported_date) AS last_report_date,
                                                SUM((fields->>'amoxicillin_stock')::int) AS total_amoxicillin,
                                                        SUM((fields->>'ors_stock')::int)          AS total_ors,
                                                                SUM((fields->>'zinc_stock')::int)          AS total_zinc,
                                                                        SUM((fields->>'rdt_stock')::int)           AS total_rdt,
                                                                                SUM((fields->>'fp_pills_stock')::int)      AS total_fp_pills,
                                                                                        SUM((fields->>'fp_injectables_stock')::int) AS total_fp_injectables
                                                                                              FROM stock_reports
                                                                                                  `);

      return res.json(rows[0]);

    } catch (err) {
          console.error('reports/summary error:', err);
          return res.status(500).json({ error: err.message });
    }
});

/**
 * GET /reports/alerts
 * Returns list of CHPs with current stockouts for alert banner in dashboard
 */
router.get('/alerts', async (req, res) => {
    try {
          const { rows } = await pool.query(`
                SELECT chp_id, chp_name, chu_id, reported_date, fields
                      FROM stock_reports
                            WHERE has_stockout = true
                                  ORDER BY reported_date DESC
                                        LIMIT 50
                                            `);
          return res.json(rows);
    } catch (err) {
          console.error('reports/alerts error:', err);
          return res.status(500).json({ error: err.message });
    }
});

module.exports = router;
