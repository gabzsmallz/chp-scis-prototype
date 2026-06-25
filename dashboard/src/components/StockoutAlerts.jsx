import React from 'react';
import {
  Paper, Typography, Box, Chip, Divider, List, ListItem,
  ListItemIcon, ListItemText
} from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PersonIcon from '@mui/icons-material/Person';

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

  // Group alerts by CHP (each alert row is one commodity line at zero)
  const byChp = {};
  alerts.forEach((a) => {
    const key = a.chp_id;
    if (!byChp[key]) {
      byChp[key] = { chp_name: a.chp_name, chp_id: a.chp_id, chu_id: a.chu_id, reported_date: a.reported_date, commodities: [] };
    }
    byChp[key].commodities.push({ code: a.commodity_code, name: a.commodity_name || a.commodity_code, qty: a.quantity_on_hand });
    // Keep most recent date
    if (a.reported_date > byChp[key].reported_date) byChp[key].reported_date = a.reported_date;
  });

  const chps = Object.values(byChp);

  return (
    <Paper elevation={2} sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <WarningAmberIcon color="warning" />
        <Typography variant="h6" fontWeight="bold">Active Stockout Alerts</Typography>
        <Chip label={`${chps.length} CHP${chps.length !== 1 ? 's' : ''}`} color="warning" size="small" />
      </Box>
      <Divider sx={{ mb: 2 }} />
      <List dense>
        {chps.map((chp, i) => (
          <ListItem key={i} alignItems="flex-start" sx={{
            mb: 1, border: '1px solid #ff9800', borderRadius: 1, bgcolor: '#fff8e1'
          }}>
            <ListItemIcon><PersonIcon color="warning" /></ListItemIcon>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography fontWeight="bold">{chp.chp_name || chp.chp_id}</Typography>
                  <Typography variant="caption" color="text.secondary">
                    CHU: {chp.chu_id} · Reported: {chp.reported_date ? new Date(chp.reported_date).toLocaleDateString() : '—'}
                  </Typography>
                </Box>
              }
              secondary={
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                  {chp.commodities.map((c) => (
                    <Chip
                      key={c.code}
                      label={`${c.name}: ${c.qty} units`}
                      color="error"
                      size="small"
                      variant="outlined"
                    />
                  ))}
                </Box>
              }
            />
          </ListItem>
        ))}
      </List>
    </Paper>
  );
}
