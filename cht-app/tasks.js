/**
 * tasks.js — CHP-SCIS CHT Task Definitions
 *
 * Two tasks are defined:
 *  1. monthly_stock_report  — Prompts CHP to submit stock report on 1st–7th of each month
 *  2. stockout_followup     — Prompts CHP to follow up if a stockout was flagged last month
 *
 * CHT Rules Engine v3 (nools-based)
 * Reference: https://docs.communityhealthtoolkit.org/apps/reference/tasks/
 */

const { STOCKOUT_THRESHOLD } = require('./tasks_config'); // optional; thresholds can be inline

const COMMODITIES = ['amoxicillin', 'ors', 'zinc', 'rdt', 'fp_pills', 'fp_injectables'];
const THRESHOLDS = { amoxicillin: 10, ors: 5, zinc: 10, rdt: 5, fp_pills: 3, fp_injectables: 2 };

// ── Helper: check if a stock_report was submitted this month ────────────────
function hasReportedThisMonth(reports, now) {
    return reports.some((r) => {
          if (r.form !== 'stock_report') return false;
          const d = new Date(r.reported_date);
          return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
}

// ── Helper: get most recent stock_report ───────────────────────────────────
function getLatestReport(reports) {
    return reports
      .filter((r) => r.form === 'stock_report')
      .sort((a, b) => b.reported_date - a.reported_date)[0];
}

// ── Helper: check if any commodity is below threshold in a report ───────────
function hasStockout(report) {
    if (!report || !report.fields) return false;
    return COMMODITIES.some((c) => {
          const val = parseInt(report.fields[`${c}_stock`] ?? 999, 10);
          return val <= THRESHOLDS[c];
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Task 1: Monthly Stock Report
// Triggers on the contact (person with role CHP) on the 1st of the month.
// Due window: day 1–7 of month. Overdue after day 7.
// ─────────────────────────────────────────────────────────────────────────────
const monthlyStockReportTask = {
    name: 'monthly_stock_report',
    icon: 'icon-healthcare-medicine',
    title: 'Monthly Stock Report Due',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: function (contact) {
          // Only trigger for users with chp role
      return contact.contact && contact.contact.role === 'chp';
    },
    resolvedIf: function (contact, report, event, dueDate) {
          const now = dueDate || new Date();
          return hasReportedThisMonth(contact.reports, now);
    },
    events: [
      {
              id: 'stock-report-due',
              days: 0,
              start: 0,
              end: 6,
              dueDate: function (event, contact) {
                        // Due on the 1st of the current month
                const now = new Date();
                        return new Date(now.getFullYear(), now.getMonth(), 1);
              }
      }
        ],
    actions: [
      {
              type: 'report',
              form: 'stock_report',
              label: 'Submit Stock Report'
      }
        ]
};

// ─────────────────────────────────────────────────────────────────────────────
// Task 2: Stockout Follow-up
// If last month's report had a stockout, prompt CHP to confirm resupply
// received. Window: 15th–21st of the month following the stockout report.
// ─────────────────────────────────────────────────────────────────────────────
const stockoutFollowupTask = {
    name: 'stockout_followup',
    icon: 'icon-warning',
    title: 'Stockout Follow-up — Confirm Resupply',
    appliesTo: 'contacts',
    appliesToType: ['person'],
    appliesIf: function (contact) {
          if (!contact.contact || contact.contact.role !== 'chp') return false;
          const latest = getLatestReport(contact.reports);
          return hasStockout(latest);
    },
    resolvedIf: function (contact, report, event, dueDate) {
          // Resolved when CHP submits a new stock report with all values above threshold
      const latest = getLatestReport(contact.reports);
          return !hasStockout(latest);
    },
    events: [
      {
              id: 'stockout-followup',
              days: 0,
              start: 0,
              end: 6,
              dueDate: function (event, contact) {
                        const now = new Date();
                        return new Date(now.getFullYear(), now.getMonth(), 15);
              }
      }
        ],
    actions: [
      {
              type: 'report',
              form: 'stock_report',
              label: 'Update Stock Report'
      }
        ]
};

module.exports = [monthlyStockReportTask, stockoutFollowupTask];
