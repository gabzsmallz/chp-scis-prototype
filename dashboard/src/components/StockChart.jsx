import React from 'react';
import { Paper, Typography } from '@mui/material';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, Cell
} from 'recharts';

export default function StockChart({ reports }) {
  if (!reports || reports.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No stock data available yet.</Typography>
      </Paper>
    );
  }

  // Aggregate total quantity_on_hand across all CHPs per commodity
  const agg = {};
  reports.forEach((r) => {
    const key  = r.commodity_code;
    const name = r.commodity_name || key;
    if (!agg[key]) agg[key] = { name: shorten(name), total: 0, stockouts: 0 };
    agg[key].total    += parseInt(r.quantity_on_hand ?? 0, 10);
    agg[key].stockouts += r.has_stockout ? 1 : 0;
  });

  const data = Object.values(agg).sort((a, b) => a.name.localeCompare(b.name));

  return (
    <Paper elevation={2} sx={{ p: 3 }}>
      <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
        Aggregate Stock Levels by Commodity — All CHPs
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
        Green = stock available · Red bar = commodity has ≥1 CHP with zero stock
      </Typography>
      <ResponsiveContainer width="100%" height={380}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" angle={-35} textAnchor="end" interval={0} tick={{ fontSize: 11 }} />
          <YAxis label={{ value: 'Total units on hand', angle: -90, position: 'insideLeft', offset: -5 }} />
          <Tooltip
            formatter={(value, name) => [value, name === 'total' ? 'Total units' : 'CHPs with stockout']}
          />
          <Legend />
          <Bar dataKey="total" name="Total units on hand" radius={[4, 4, 0, 0]}>
            {data.map((entry, i) => (
              <Cell key={i} fill={entry.stockouts > 0 ? '#d32f2f' : '#1a6e3c'} />
            ))}
          </Bar>
          <Bar dataKey="stockouts" name="CHPs at zero stock" fill="#ff9800" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </Paper>
  );
}

function shorten(name) {
  // Trim long commodity names for X-axis readability
  const SHORT = {
    'Artemether-Lumefantrine ACT': 'AL ACT',
    'Insecticide-Treated Net':     'ITN',
    'Ferrous Sulphate + Folic Acid': 'Fe/Folate',
    'Chlorhexidine gel':           'Chlorhex',
    'Vitamin A 200,000 IU':        'Vit A',
    'Albendazole 400mg':           'Albendazole'
  };
  for (const [long, abbr] of Object.entries(SHORT)) {
    if (name.includes(long)) return abbr;
  }
  return name.length > 16 ? name.slice(0, 14) + '…' : name;
}
