import React, { useState } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, Typography, Tooltip
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const LOW_STOCK_THRESHOLD = 5;

export default function StockTable({ reports }) {
  const [order, setOrder]   = useState('desc');
  const [orderBy, setOrderBy] = useState('reported_date');

  if (!reports || reports.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No stock reports received yet.</Typography>
        <Typography variant="caption">CHPs submit stock reports via the CHT app.</Typography>
      </Paper>
    );
  }

  const sorted = [...reports].sort((a, b) => {
    const av = a[orderBy] ?? '';
    const bv = b[orderBy] ?? '';
    return order === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const toggleSort = (col) => {
    setOrder(orderBy === col && order === 'desc' ? 'asc' : 'desc');
    setOrderBy(col);
  };

  const head = (key, label) => (
    <TableCell key={key} sx={{ color: 'white', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
      <TableSortLabel
        active={orderBy === key}
        direction={orderBy === key ? order : 'asc'}
        onClick={() => toggleSort(key)}
        sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
      >
        {label}
      </TableSortLabel>
    </TableCell>
  );

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table size="small">
        <TableHead sx={{ bgcolor: '#1a6e3c' }}>
          <TableRow>
            {head('chp_name',       'CHP')}
            {head('chu_id',         'CHU')}
            {head('commodity_name', 'Commodity')}
            {head('quantity_on_hand',   'On Hand')}
            {head('quantity_dispensed', 'Dispensed')}
            {head('quantity_received',  'Received')}
            {head('expiry_date',    'Nearest Expiry')}
            {head('reported_date',  'Report Date')}
            <TableCell sx={{ color: 'white', fontWeight: 'bold' }}>Status</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row, i) => {
            const qty       = parseInt(row.quantity_on_hand ?? 0, 10);
            const isOut     = row.has_stockout || qty === 0;
            const isLow     = !isOut && qty <= LOW_STOCK_THRESHOLD;
            const expiry    = row.expiry_date  ? new Date(row.expiry_date).toLocaleDateString()  : '—';
            const reportDt  = row.reported_date ? new Date(row.reported_date).toLocaleDateString() : '—';

            return (
              <TableRow key={i} hover sx={{ '&:nth-of-type(odd)': { bgcolor: '#f9f9f9' } }}>
                <TableCell>{row.chp_name || row.chp_id || '—'}</TableCell>
                <TableCell>{row.chu_id || '—'}</TableCell>
                <TableCell>{row.commodity_name || row.commodity_code}</TableCell>
                <TableCell align="center" sx={{ color: isOut ? '#c62828' : isLow ? '#e65100' : 'inherit', fontWeight: isOut || isLow ? 700 : 400 }}>
                  {qty}
                </TableCell>
                <TableCell align="center">{row.quantity_dispensed ?? '—'}</TableCell>
                <TableCell align="center">{row.quantity_received  ?? '—'}</TableCell>
                <TableCell>{expiry}</TableCell>
                <TableCell>{reportDt}</TableCell>
                <TableCell align="center">
                  {isOut
                    ? <Tooltip title="Zero stock"><Chip icon={<WarningIcon />} label="STOCKOUT" color="error"   size="small" /></Tooltip>
                    : isLow
                      ? <Tooltip title={`≤${LOW_STOCK_THRESHOLD} units`}><Chip icon={<WarningIcon />} label="Low Stock" color="warning" size="small" /></Tooltip>
                      : <Chip icon={<CheckCircleIcon />} label="OK" color="success" size="small" />
                  }
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
