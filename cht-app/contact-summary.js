const COMMODITIES = [
  { key: 'amoxicillin_stock', label: 'Amoxicillin', threshold: 10 },
  { key: 'ors_stock',         label: 'ORS',          threshold: 5  },
  { key: 'zinc_stock',        label: 'Zinc',         threshold: 10 },
  { key: 'rdt_stock',         label: 'RDT',          threshold: 5  },
  { key: 'fp_pills_stock',    label: 'OCP',          threshold: 3  },
  { key: 'fp_injectables_stock', label: 'DMPA',      threshold: 2  }
];

function getLatestStockReport(reports) {
  return (reports || [])
    .filter(function(r) { return r.form === 'stock_report'; })
    .sort(function(a, b) { return b.reported_date - a.reported_date; })[0];
}

var latest = getLatestStockReport(reports);
var fields = latest ? latest.fields : {};

var cards = [];
var stockLines = [];
var hasStockout = false;

COMMODITIES.forEach(function(c) {
  var val = parseInt(fields[c.key] !== null && fields[c.key] !== undefined ? fields[c.key] : -1, 10);
  var low = val >= 0 && val <= c.threshold;
  if (low) hasStockout = true;
  stockLines.push({
    label: c.label,
    value: val >= 0 ? String(val) : '—',
    icon:  low ? 'icon-warning' : null
  });
});

if (latest) {
  cards.push({
    label: 'Latest Stock Report',
    fields: [{ label: 'Date', value: new Date(latest.reported_date).toLocaleDateString() }]
      .concat(stockLines)
  });
}

var context = {
  is_chp: contact.role === 'chp',
  has_stockout: hasStockout
};

return {
  fields: [
    { label: 'Role',   value: contact.role   || '—' },
    { label: 'CHU',    value: contact.parent  ? contact.parent.name : '—' },
    { label: 'Phone',  value: contact.phone   || '—' },
    { label: 'Stockout', value: hasStockout ? 'YES' : 'No', icon: hasStockout ? 'icon-warning' : null }
  ],
  cards: cards,
  context: context
};
