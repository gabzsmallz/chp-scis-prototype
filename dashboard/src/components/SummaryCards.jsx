import React from 'react';
import { Grid, Paper, Typography, Box } from '@mui/material';
import AssignmentIcon from '@mui/icons-material/Assignment';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

function KpiCard({ icon, label, value, color, subtitle }) {
  return (
    <Paper elevation={2} sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2, borderLeft: `5px solid ${color}` }}>
      <Box sx={{ color, fontSize: 40 }}>{icon}</Box>
      <Box>
        <Typography variant="h4" fontWeight="bold" color={color}>{value}</Typography>
        <Typography variant="body2" fontWeight="bold">{label}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </Box>
    </Paper>
  );
}

export default function SummaryCards({ summary, alertCount }) {
  const total = parseInt(summary?.total_reports ?? 0, 10);
  const withStockout = parseInt(summary?.reports_with_stockout ?? 0, 10);
  const ok = total - withStockout;
  const lastDate = summary?.last_report_date
    ? new Date(summary.last_report_date).toLocaleDateString()
    : 'N/A';

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          icon={<AssignmentIcon fontSize="inherit" />}
          label="Total Reports"
          value={total}
          color="#1a6e3c"
          subtitle="Stock reports received"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          icon={<WarningAmberIcon fontSize="inherit" />}
          label="Active Stockout Alerts"
          value={alertCount ?? withStockout}
          color="#e65100"
          subtitle="CHPs below threshold"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          icon={<CheckCircleOutlineIcon fontSize="inherit" />}
          label="Reports - Adequate Stock"
          value={ok}
          color="#2e7d32"
          subtitle="All commodities above threshold"
        />
      </Grid>
      <Grid item xs={12} sm={6} md={3}>
        <KpiCard
          icon={<AccessTimeIcon fontSize="inherit" />}
          label="Last Report Date"
          value={lastDate}
          color="#1565c0"
          subtitle="Most recent CHP submission"
        />
      </Grid>
    </Grid>
  );
}
