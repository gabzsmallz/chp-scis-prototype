module.exports = [
  {
    id: 'stock-reports-this-month',
    type: 'count',
    icon: 'icon-healthcare-medicine',
    goal: 1,
    translation_key: 'targets.stock_reports.title',
    subtitle_translation_key: 'targets.stock_reports.subtitle',
    appliesTo: 'reports',
    appliesIf: function(contact, report) {
      if (report.form !== 'stock_report') return false;
      var d = new Date(report.reported_date);
      var now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }
  },
  {
    id: 'active-stockouts',
    type: 'count',
    icon: 'icon-warning',
    goal: 0,
    translation_key: 'targets.stockouts.title',
    subtitle_translation_key: 'targets.stockouts.subtitle',
    appliesTo: 'reports',
    appliesIf: function(contact, report) {
      if (report.form !== 'stock_report') return false;
      var fields = report.fields || {};
      var THRESHOLDS = { amoxicillin_stock: 10, ors_stock: 5, zinc_stock: 10, rdt_stock: 5, fp_pills_stock: 3, fp_injectables_stock: 2 };
      return Object.keys(THRESHOLDS).some(function(key) {
        return parseInt(fields[key] !== null && fields[key] !== undefined ? fields[key] : 999, 10) <= THRESHOLDS[key];
      });
    }
  }
];
