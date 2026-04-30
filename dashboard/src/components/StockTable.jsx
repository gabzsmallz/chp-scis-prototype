import React, { useState } from 'react';
import {
  Paper, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TableSortLabel, Chip, Typography, Box
} from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const COMMODITIES = [
  { key: 'amoxicillin', label: 'Amoxicillin', threshold: 10 },
  { key: 'ors', label: 'ORS', threshold: 5 },
  { key: 'zinc', label: 'Zinc', threshold: 10 },
  { key: 'rdt', label: 'RDT', threshold: 5 },
  { key: 'fp_pills', label: 'OCP', threshold: 3 },
  { key: 'fp_injectables', label: 'DMPA', threshold: 2 }
];

function StockCell({ value, threshold }) {
  const qty = parseInt(value ?? '-1', 10);
  if (qty < 0) return <TableCell>—</TableCell>;
  const low = qty <= threshold;
  return (
    <TableCell align="center">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
        {low && <WarningIcon fontSize="small" color="warning" />}
        <Typography variant="body2" color={low ? 'warning.dark' : 'text.primary'} fontWeight={low ? 700 : 400}>
          {qty}
        </Typography>
      </Box>
    </TableCell>
  );
}

export default function StockTable({ reports }) {
  const [order, setOrder] = useState('desc');
  const [orderBy, setOrderBy] = useState('occurrenceDateTime');

  if (!reports || reports.length === 0) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="text.secondary">No stock reports received yet.</Typography>
        <Typography variant="caption">CHPs need to submit stock reports via the CHT app.</Typography>
      </Paper>
    );
  }

  const rows = reports.map((r) => {
    const items = {};
    (r.suppliedItem || []).forEach((item) => {
      const kems = item.itemCodeableConcept?.coding?.find((c) => c.system?.includes('kemsa'))?.code;
      if (!kems) return;
      const key = kems.replace('KEMSA-', '').replace('-', '_').toLowerCase();
      items[key] = item.quantity?.value;
    });
    return {
      id: r.id,
      chp: r.supplier?.display || r.supplier?.reference || '—',
      chu: r.destination?.display || '—',
      date: r.occurrenceDateTime ? new Date(r.occurrenceDateTime).toLocaleDateString() : '—',
      stockout: (r.extension?.length ?? 0) > 0,
      ...items
    };
  });

  const sorted = [...rows].sort((a, b) => {
    const av = a[orderBy] ?? '';
    const bv = b[orderBy] ?? '';
    return order === 'asc' ? (av > bv ? 1 : -1) : (av < bv ? 1 : -1);
  });

  const toggleSort = (col) => {
    setOrder(orderBy === col && order === 'desc' ? 'asc' : 'desc');
    setOrderBy(col);
  };

  return (
    <TableContainer component={Paper} elevation={2}>
      <Table size="small">
        <TableHead sx={{ bgcolor: '#1a6e3c' }}>
          <TableRow>
            {['chp', 'chu', 'date'].map((col) => (
              <TableCell key={col} sx={{ color: 'white', fontWeight: 'bold' }}>
                <TableSortLabel
                  active={orderBy === col}
                  direction={orderBy === col ? order : 'asc'}
                  onClick={() => toggleSort(col)}
                  sx={{ color: 'white !important', '& .MuiTableSortLabel-icon': { color: 'white !important' } }}
                >
                  {col.toUpperCase()}
                </TableSortLabel>
              </TableCell>
            ))}
            {COMMODITIES.map((c) => (
              <TableCell key={c.key} align="center" sx={{ color: 'white', fontWeight: 'bold', fontSize: '0.75rem' }}>
                {c.label}
              </TableCell>
            ))}
            <TableCell align="center" sx={{ color: 'white', fontWeight: 'bold' }}>STATUS</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sorted.map((row) => (
            <TableRow key={row.id} hover sx={{ '&:nth-of-type(odd)': { bgcolor: '#f9f9f9' } }}>
              <TableCell>{row.chp}</TableCell>
              <TableCell>{row.chu}</TableCell>
              <TableCell>{row.date}</TableCell>
              {COMMODITIES.map((c) => (
                <StockCell key={c.key} value={row[c.key.replace('kemsa-', '')]} threshold={c.threshold} />
              ))}
              <TableCell align="center">
                {row.stockout
                  ? <Chip icon={<WarningIcon />} label="Stockout" color="warning" size="small" />
                  : <Chip icon={<CheckCircleIcon />} label="OK" color="success" size="small" />
                }
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
