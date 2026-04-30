import React from 'react';
import {
  Paper, Typography, Box, Chip, Divider, List, ListItem,
  ListItemIcon, ListItemText
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';

const THRESHOLDS = { amoxicillin_stock: 10, ors_stock: 5, zinc_stock: 10, rdt_stock: 5, fp_pills_stock: 3, fp_injectables_stock: 2 };
const LABELS = {
  amoxicillin_stock: 'Amoxicillin', ors_stock: 'ORS', zinc_stock: 'Zinc',
  rdt_stock: 'RDT', fp_pills_stock: 'OCP', fp_injectables_stock: 'DMPA'
};

export default function StockoutAlerts({ alerts }) {
  if (!alerts || alerts.length === 0) {
    return (
      <Paper sx={{ p: 4, textAlign: 'center', bgcolor: '#f0faf4' }}>
        <Typography variant="h6" color="success.main">No active stockout alerts</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          All CHPs have reported adequate stock levels.
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningAmberIcon color="warning" />
        <Typography variant="h6" fontWeight="bold">Active Stockout Alerts</Typography>
        <Chip label={`${alerts.length} CHPs`} color="warning" size="small" />
      </Box>
      <Divider sx={{ mb: 2 }} />
      <List dense>
        {alerts.map((alert, i) => {
          const lowItems = Object.entries(THRESHOLDS)
            .filter(([key, threshold]) => parseInt(alert.fields?.[key] ?? 999, 10) <= threshold)
            .map(([key]) => ({
              label: LABELS[key],
              value: alert.fields?.[key] ?? 0,
              threshold: THRESHOLDS[key]
            }));

          return (
            <ListItem key={i} alignItems="flex-start" sx={{
              mb: 1, border: '1px solid #ff9800', borderRadius: 1, bgcolor: '#fff8e1'
            }}>
              <ListItemIcon><PersonIcon color="warning" /></ListItemIcon>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography fontWeight="bold">{alert.chp_name || alert.chp_id}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      CHU: {alert.chu_id} · Reported: {new Date(alert.reported_date).toLocaleDateString()}
                    </Typography>
                  </Box>
                }
                secondary={
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                    {lowItems.map((item) => (
                      <Chip
                        key={item.label}
                        label={`${item.label}: ${item.value} (threshold: ${item.threshold})`}
                        color="warning"
                        size="small"
                        variant="outlined"
                      />
                    ))}
                  </Box>
                }
              />
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
}
