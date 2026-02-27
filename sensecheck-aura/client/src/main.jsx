import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { preventZoom } from './utils/preventZoom.js';

// Prevent zoom on all devices
preventZoom();

// Note: Global interaction tracking is handled by the extension after the game is complete
// The game itself should not track global interactions to avoid duplicate data

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

