import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AppProvider } from './providers';
import './index.css';

// Service Worker 由 VitePWA 插件自動處理 (vite.config.ts)
// 當新 SW 接管時，自動刷新頁面以載入最新版本
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    console.log('[PWA] New version available, reloading...');
    window.location.reload();
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>
);
