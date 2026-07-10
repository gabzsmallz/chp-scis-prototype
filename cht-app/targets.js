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
      // New form layout: single commodity per submission
      if (fields.commodity_code !== undefined) {
        return parseInt(fields.quantity_on_hand !== undefined ? fields.quantity_on_hand : 1, 10) === 0;
      }
      // Repeating group layout: fields.commodities[]
      if (Array.isArray(fields.commodities)) {
        return fields.commodities.some(function(c) {
          return parseInt(c.quantity_on_hand !== undefined ? c.quantity_on_hand : 1, 10) === 0;
        });
      }
      return false;
    }
  }
];
