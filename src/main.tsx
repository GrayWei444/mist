import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './providers';
import './index.css';

// Service Worker 由 VitePWA 插件自動處理 (vite.config.ts)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
