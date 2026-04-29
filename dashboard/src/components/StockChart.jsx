import React from 'react';
import { Paper, Typography } from '@mui/material';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
    ReferenceLine, ResponsiveContainer, Cell
} from 'recharts';

const THRESHOLDS = { Amoxicillin: 10, ORS: 5, Zinc: 10, RDT: 5, OCP: 3, DMPA: 2 };
const COMMODITY_KEYS = {
    Amoxicillin: 'total_amoxicillin',
    ORS: 'total_ors',
    Zinc: 'total_zinc',
    RDT: 'total_rdt',
    OCP: 'total_fp_pills',
    DMPA: 'total_fp_injectables'
};

export default function StockChart({ summary }) {
    if (!summary) {
          return (
                  <Paper sx={{ p: 3, textAlign: 'center' }}>
                            <Typography color="text.secondary">No summary data available.</Typography>Typography>
                  </Paper>Paper>
                );
    }
  
    const data = Object.entries(COMMODITY_KEYS).map(([name, key]) => ({
          name,
          total: parseInt(summary[key] || 0, 10),
          threshold: THRESHOLDS[name]
    }));
  
    return (
          <Paper elevation={2} sx={{ p: 3 }}>
                <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
                        Aggregate Stock Levels - All CHPs
                </Typography>Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
                        Green bars = adequate stock. Red bars = at or below stockout threshold.
                </Typography>Typography>
                <ResponsiveContainer width="100%" height={350}>
                        <BarChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="name" />
                                  <YAxis />
                                  <Tooltip />
                                  <Legend />
                                  <Bar dataKey="total" name="Total Stock" radius={[4, 4, 0, 0]}>
                                    {data.map((entry, index) => (
                          <Cell key={index} fill={entry.total <= entry.threshold ? '#d32f2f' : '#1a6e3c'} />
                        ))}
                                  </Bar>Bar>
                        </BarChart>BarChart>
                </ResponsiveContainer>ResponsiveContainer>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        Total reports: {summary.total_reports || 0} | Last report: {summary.last_report_date ? new Date(summary.last_report_date).toLocaleString() : 'N/A'}
                </Typography>Typography>
          </Paper>Paper>
        );
}</Typography>
