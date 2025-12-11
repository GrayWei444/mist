/**
 * DevToolsPage - 開發者工具頁面
 */

import { useState } from 'react';
import { E2ESimulator, LiveTestPanel, QRCodeExchange } from '../components/DevTools';

interface DevToolsPageProps {
  onBack: () => void;
}

type TabType = 'live' | 'qr' | 'simulator';

export function DevToolsPage({ onBack }: DevToolsPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>('live');

  return (
    <div className="h-screen flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-card border-b border-dark-border">
        <button
          onClick={onBack}
          className="p-2 hover:bg-dark-700 rounded-full transition-colors"
        >
          <span className="text-dark-300">←</span>
        </button>
        <h1 className="text-lg font-semibold text-white">開發者工具</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-dark-border bg-dark-card">
        <button
          onClick={() => setActiveTab('live')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'live'
              ? 'text-mist-400 border-b-2 border-mist-400'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          🤖 機器人
        </button>
        <button
          onClick={() => setActiveTab('qr')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'qr'
              ? 'text-mist-400 border-b-2 border-mist-400'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          📱 QR 加好友
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'simulator'
              ? 'text-mist-400 border-b-2 border-mist-400'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          🔬 模擬器
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'live' && <LiveTestPanel />}
        {activeTab === 'qr' && <QRCodeExchange />}
        {activeTab === 'simulator' && <E2ESimulator />}
      </div>
    </div>
  );
}

export default DevToolsPage;
