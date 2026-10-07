import React from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles/main.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {/* HashRouter: works on GitHub Pages / any static host without rewrite rules. Admin lives at /#/admin */}
    <HashRouter>
      <App />
    </HashRouter>
  </React.StrictMode>
);
