import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { preventZoom } from './utils/preventZoom.js';
import globalTracker from './utils/globalTracking.js';

// Prevent zoom on all devices
preventZoom();

// Initialize global tracking with session ID
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('sensecheck_session_id');
  if (!sessionId) {
    sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('sensecheck_session_id', sessionId);
  }
  return sessionId;
};

// Start comprehensive tracking
globalTracker.initialize(getSessionId());

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

