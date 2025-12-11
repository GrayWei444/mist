/**
 * BotStore - 測試機器人全局狀態
 *
 * 讓機器人在整個應用生命週期中持久運行
 */

import { create } from 'zustand';

// 機器人會話狀態（不能序列化的 WASM 物件用 ref 存）
interface BotState {
  isInitialized: boolean;
  publicKey: string;
  name: string;
  isSessionEstablished: boolean;
}

interface BotStore {
  bot: BotState;
  logs: string[];

  // Actions
  initializeBot: (publicKey: string) => void;
  establishSession: () => void;
  addLog: (message: string) => void;
  clearLogs: () => void;
  reset: () => void;

  // 機器人回覆訊息（由 LiveTestPanel 呼叫）
  generateReply: (userMessage: string) => string;
}

const initialBotState: BotState = {
  isInitialized: false,
  publicKey: '',
  name: 'Bot Alice 🤖',
  isSessionEstablished: false,
};

export const useBotStore = create<BotStore>((set, get) => ({
  bot: initialBotState,
  logs: [],

  initializeBot: (publicKey) => {
    set({
      bot: {
        ...get().bot,
        isInitialized: true,
        publicKey,
      },
    });
    get().addLog(`機器人已初始化: ${publicKey.slice(0, 20)}...`);
  },

  establishSession: () => {
    set({
      bot: {
        ...get().bot,
        isSessionEstablished: true,
      },
    });
    get().addLog('加密會話已建立');
  },

  addLog: (message) => {
    const timestamp = new Date().toLocaleTimeString();
    set({
      logs: [...get().logs.slice(-100), `[${timestamp}] ${message}`],
    });
  },

  clearLogs: () => {
    set({ logs: [] });
  },

  reset: () => {
    set({
      bot: initialBotState,
      logs: [],
    });
  },

  generateReply: (userMessage) => {
    const replies = [
      '收到！這是加密回覆 🔐',
      `你說: "${userMessage.slice(0, 20)}${userMessage.length > 20 ? '...' : ''}"`,
      'E2E 加密測試成功！',
      'Bot Alice 回覆你 🤖',
      '訊息已通過 Double Ratchet 加密傳輸',
      '前向保密確保每條訊息使用不同密鑰',
      'Hello! 這是來自機器人的加密訊息',
    ];
    return replies[Math.floor(Math.random() * replies.length)];
  },
}));

// WASM 物件存儲（不能放在 zustand store 中）
interface BotWasmState {
  identity: unknown | null;
  signedPreKey: unknown | null;
  session: unknown | null;
  userIdentity: unknown | null;
  userSession: unknown | null;
}

// 全局 WASM 物件（在模組級別存儲）
export const botWasmState: BotWasmState = {
  identity: null,
  signedPreKey: null,
  session: null,
  userIdentity: null,
  userSession: null,
};

export default useBotStore;
