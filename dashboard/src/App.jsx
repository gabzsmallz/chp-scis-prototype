import React, { useState, useEffect } from 'react';
import {
  Box, Container, Typography, AppBar, Toolbar, CircularProgress,
  Alert, Tabs, Tab
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import StockTable from './components/StockTable';
import StockoutAlerts from './components/StockoutAlerts';
import StockChart from './components/StockChart';
import SummaryCards from './components/SummaryCards';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || '';

function TabPanel({ children, value, index }) {
  return value === index ? <Box sx={{ py: 3 }}>{children}</Box> : null;
}

export default function App() {
  const [tab, setTab] = useState(0);
  const [summary, setSummary] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [sumRes, alertsRes, reportsRes] = await Promise.all([
        axios.get(`${API}/reports/summary`),
        axios.get(`${API}/reports/alerts`),
        axios.get(`${API}/reports/stock?limit=100`)
      ]);
      setSummary(sumRes.data);
      setAlerts(alertsRes.data);
      setReports(Array.isArray(reportsRes.data) ? reportsRes.data : []);
      setLastRefresh(new Date().toLocaleTimeString());
      setError(null);
    } catch (err) {
      setError(`Failed to load data: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Box sx={{ flexGrow: 1, minHeight: '100vh', bgcolor: '#f5f5f5' }}>
      {/* Header */}
      <AppBar position="static" sx={{ bgcolor: '#1a6e3c' }}>
        <Toolbar>
          <LocalHospitalIcon sx={{ mr: 1 }} />
          <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            CHP-SCIS Decision Dashboard
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.8 }}>
            Nairobi County Simulation{lastRefresh ? ` · Refreshed ${lastRefresh}` : ''}
          </Typography>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ mt: 3 }}>
        {/* Error banner */}
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

        {/* Stockout alert banner */}
        {!loading && alerts.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <strong>{alerts.length} CHP(s)</strong> have reported stockouts in their latest submission.
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
            <CircularProgress size={60} sx={{ color: '#1a6e3c' }} />
          </Box>
        ) : (
          <>
            {/* Summary KPI cards */}
            <SummaryCards summary={summary} alertCount={alerts.length} />

            {/* Navigation tabs */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mt: 3 }}>
              <Tabs
                value={tab}
                onChange={(_, v) => setTab(v)}
                textColor="inherit"
                sx={{ '& .MuiTab-root.Mui-selected': { color: '#1a6e3c', fontWeight: 'bold' } }}
              >
                <Tab label="Stock Overview" />
                <Tab label={`Stockout Alerts (${alerts.length})`} />
                <Tab label="Commodity Chart" />
              </Tabs>
            </Box>

            <TabPanel value={tab} index={0}>
              <StockTable reports={reports} />
            </TabPanel>
            <TabPanel value={tab} index={1}>
              <StockoutAlerts alerts={alerts} />
            </TabPanel>
            <TabPanel value={tab} index={2}>
              <StockChart reports={reports} />
            </TabPanel>
          </>
        )}
      </Container>
    </Box>
  );
}
