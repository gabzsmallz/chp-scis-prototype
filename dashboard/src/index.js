import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';

const theme = createTheme({
    palette: {
          primary: { main: '#1a6e3c' },
          secondary: { main: '#e65100' }
    },
    typography: {
          fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
    }
});

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <App />
  </ThemeProvider>
  </React.StrictMode>
);
