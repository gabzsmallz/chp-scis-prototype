/**
 * tasks.js — CHP-SCIS CHT Task Definitions
 *
 * Two tasks are defined:
 *  1. monthly_stock_report  — Prompts CHP to submit a stock report on 1st–7th of each month
 *  2. stockout_followup     — Prompts CHP to follow up after any stockout was flagged
 *
 * The new stock_report form uses a commodity picker (commodity_code) + quantity_on_hand.
 * A stockout is quantity_on_hand === 0 in any commodity submitted in the last report.
 *
 * CHT Rules Engine v3 (nools-based)
 * Reference: https://docs.communityhealthtoolkit.org/apps/reference/tasks/
 */

// ── Helpers ──────────────────────────────────────────────────────────────────

function hasReportedThisMonth(reports, now) {
  const year  = now.getFullYear();
  const month = now.getMonth();
  return reports.some((r) => {
    if (r.form !== 'stock_report') return false;
    const d = new Date(r.reported_date);
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

function getLatestReport(reports) {
  return reports
    .filter((r) => r.form === 'stock_report')
    .sort((a, b) => b.reported_date - a.reported_date)[0];
}

/**
 * Returns true if the report has any commodity at quantity_on_hand = 0.
 * Supports both form layouts:
 *  A) fields.commodities[] repeating group  → check each entry
 *  B) fields.commodity_code / quantity_on_hand  → check directly
 */
function reportHasStockout(report) {
  if (!report || !report.fields) return false;

  const fields = report.fields;

  if (Array.isArray(fields.commodities)) {
    return fields.commodities.some((c) => parseInt(c.quantity_on_hand ?? 1, 10) === 0);
  }

  if (fields.commodity_code !== undefined) {
    return parseInt(fields.quantity_on_hand ?? 1, 10) === 0;
  }

  return false;
}

// ── Task 1: Monthly Stock Report ─────────────────────────────────────────────
// Triggers for every contact person on the 1st of each month.
// Due window: 1st–7th. Role filtering is handled by the form context.expression.
const monthlyStockReportTask = {
  name:          'monthly_stock_report',
  icon:          'icon-healthcare-medicine',
  title:         'Monthly Stock Report Due',
  appliesTo:     'contacts',
  appliesToType: ['person'],
  appliesIf: function (contact) {
    return !!contact.contact;
  },
  resolvedIf: function (contact, _report, _event, dueDate) {
    const now = dueDate || new Date();
    return hasReportedThisMonth(contact.reports, now);
  },
  events: [{
    id:    'stock-report-due',
    start: 0,
    end:   6,
    dueDate: function (_event, _contact) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 1);
    }
  }],
  actions: [{
    type:  'report',
    form:  'stock_report',
    label: 'Submit Stock Report'
  }]
};

// ── Task 2: Stockout Follow-up ────────────────────────────────────────────────
// If the latest report flagged a stockout, prompt CHP to confirm resupply.
// Window: 15th–21st of the same month.
const stockoutFollowupTask = {
  name:          'stockout_followup',
  icon:          'icon-warning',
  title:         'Stockout Follow-up — Confirm Resupply Received',
  appliesTo:     'contacts',
  appliesToType: ['person'],
  appliesIf: function (contact) {
    if (!contact.contact) return false;
    const latest = getLatestReport(contact.reports);
    return reportHasStockout(latest);
  },
  resolvedIf: function (contact) {
    const latest = getLatestReport(contact.reports);
    return !reportHasStockout(latest);
  },
  events: [{
    id:    'stockout-followup',
    start: 0,
    end:   6,
    dueDate: function (_event, _contact) {
      const now = new Date();
      return new Date(now.getFullYear(), now.getMonth(), 15);
    }
  }],
  actions: [{
    type:  'report',
    form:  'stock_report',
    label: 'Update Stock Report'
  }]
};

module.exports = [monthlyStockReportTask, stockoutFollowupTask];
