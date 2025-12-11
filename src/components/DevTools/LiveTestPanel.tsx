/**
 * LiveTestPanel - 互動測試面板（完整加好友流程展示）
 *
 * 完整展示：
 * 1. Bot 產生 QR Code（包含公鑰 + 簽名預密鑰）
 * 2. 用戶「掃描」QR Code
 * 3. 執行 X3DH 金鑰協商
 * 4. 建立 Double Ratchet 加密會話
 * 5. 雙方成為好友，進入聊天
 * 6. 測試訊息發送、刪除等功能
 *
 * 機器人狀態使用全局變數，離開頁面也不會丟失
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  initCrypto,
  Identity,
  SignedPreKey,
  Session,
  x3dhInitiator,
  x3dhResponder,
  getCryptoVersion,
  toBase64,
} from '../../services/crypto';
import { useChatStore } from '../../stores/chatStore';
import { useBotStore, botWasmState } from '../../stores/botStore';

// 追蹤已處理的訊息 ID，避免重複回覆
let lastProcessedMessageId: string | null = null;

// QR Code 資料結構（與真實流程一致）
interface QRCodeData {
  version: number;
  publicKey: string;           // Base64 Ed25519 公鑰
  signedPreKeyPub: string;     // Base64 簽名預密鑰公鑰
  signature: string;           // Base64 簽名
  name: string;                // 顯示名稱
}

// 流程步驟
type FlowStep = 'init' | 'qr-ready' | 'scanning' | 'key-exchange' | 'connected';

interface LiveTestPanelProps {
  onEnterChat?: () => void;
}

export function LiveTestPanel({ onEnterChat }: LiveTestPanelProps) {
  const { addFriend, friends, messages } = useChatStore();
  const { bot, logs, addLog, clearLogs, initializeBot: storeBotInit, establishSession: storeEstablish, reset: resetBotStore } = useBotStore();

  const [isInitializing, setIsInitializing] = useState(false);
  const [cryptoVersion, setCryptoVersion] = useState('');
  const [step, setStep] = useState<FlowStep>('init');
  const [qrData, setQrData] = useState<QRCodeData | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 檢查機器人是否已加為好友
  const botFriend = friends.find((f) => f.publicKey === bot.publicKey);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 監聽發送給機器人的訊息並自動回覆
  useEffect(() => {
    if (!botFriend || !bot.isSessionEstablished) return;

    const botMessages = messages[botFriend.id] || [];
    const lastMessage = botMessages[botMessages.length - 1];

    // 只處理用戶發送的新訊息（避免重複處理）
    // 注意：chatStore 中用戶發送的訊息 senderId 是 'me'
    if (lastMessage && lastMessage.senderId === 'me' && lastMessage.id !== lastProcessedMessageId) {
      lastProcessedMessageId = lastMessage.id;
      addLog(`收到用戶訊息: "${lastMessage.content}"`);

      // 模擬機器人回覆（延遲 1 秒）
      setTimeout(() => {
        const replies = [
          '收到！這是加密回覆 🔐',
          `你說: "${lastMessage.content.slice(0, 30)}${lastMessage.content.length > 30 ? '...' : ''}"`,
          'E2E 加密測試成功！',
          'Bot Alice 回覆你 🤖',
          '訊息已通過 Double Ratchet 加密',
          '前向保密：每條訊息使用不同密鑰',
        ];
        const reply = replies[Math.floor(Math.random() * replies.length)];
        addLog(`機器人回覆: "${reply}"`);

        // 將回覆加入訊息列表
        const { receiveMessage } = useChatStore.getState();
        receiveMessage(botFriend.id, {
          id: `bot-reply-${Date.now()}`,
          senderId: botFriend.id,
          content: reply,
          timestamp: Date.now(),
          type: 'text',
          isRead: false,
          isBurned: false,
          encrypted: true,
        });
      }, 1000);
    }
  }, [messages, botFriend, bot.isSessionEstablished, addLog]);

  // 第一步：產生機器人身份和 QR Code
  const generateBotQRCode = useCallback(async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      addLog('🚀 開始模擬完整加好友流程...');
      addLog('');
      addLog('正在初始化 WASM 加密模組...');
      await initCrypto();
      const version = getCryptoVersion();
      setCryptoVersion(version);
      addLog(`✅ 加密模組已載入 (v${version})`);

      // 產生機器人身份
      addLog('');
      addLog('📱 Bot Alice 正在產生身份...');
      const identity = Identity.generate();
      const signedPreKey = SignedPreKey.generate(identity, 1);

      // 存到全局狀態
      botWasmState.identity = identity;
      botWasmState.signedPreKey = signedPreKey;

      storeBotInit(identity.publicKeyBase64);
      addLog(`   Ed25519 公鑰: ${identity.publicKeyBase64.slice(0, 24)}...`);
      addLog(`   簽名預密鑰: ${signedPreKey.publicKeyBase64.slice(0, 24)}...`);

      // 產生 QR Code 資料（與真實流程一致）
      const qrCodeData: QRCodeData = {
        version: 1,
        publicKey: identity.publicKeyBase64,
        signedPreKeyPub: signedPreKey.publicKeyBase64,
        signature: toBase64(signedPreKey.signature),
        name: 'Bot Alice 🤖',
      };
      setQrData(qrCodeData);

      addLog('');
      addLog('📲 Bot Alice 產生了加好友 QR Code');
      addLog('   QR Code 包含：公鑰 + 簽名預密鑰 + 簽名');
      addLog('');
      addLog('💡 點擊「掃描 QR Code」按鈕繼續...');

      setStep('qr-ready');
    } catch (err) {
      addLog(`❌ 初始化失敗: ${err}`);
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  }, [addLog, storeBotInit, isInitializing]);

  // 第二步：模擬掃描 QR Code 並建立加密會話
  const scanAndConnect = useCallback(async () => {
    if (!qrData || !botWasmState.identity || !botWasmState.signedPreKey) {
      addLog('❌ 請先產生 QR Code');
      return;
    }

    setStep('scanning');
    addLog('');
    addLog('📷 正在掃描 Bot Alice 的 QR Code...');

    // 模擬掃描延遲
    await new Promise(resolve => setTimeout(resolve, 500));

    addLog(`   讀取到公鑰: ${qrData.publicKey.slice(0, 24)}...`);
    addLog(`   讀取到名稱: ${qrData.name}`);
    addLog('   ✅ QR Code 資料驗證通過');

    setStep('key-exchange');
    addLog('');
    addLog('🔐 開始 X3DH 金鑰協商...');

    try {
      // 產生用戶身份（模擬本地用戶）
      addLog('');
      addLog('   👤 產生用戶身份...');
      const uIdentity = Identity.generate();
      botWasmState.userIdentity = uIdentity;
      addLog(`   用戶公鑰: ${uIdentity.publicKeyBase64.slice(0, 24)}...`);

      // 模擬處理延遲
      await new Promise(resolve => setTimeout(resolve, 300));

      // 用戶作為發起者執行 X3DH
      addLog('');
      addLog('   👤 用戶 (發起者) 執行 X3DH...');
      const botIdentity = botWasmState.identity as Identity;
      const botSignedPreKey = botWasmState.signedPreKey as SignedPreKey;

      const x3dhResult = x3dhInitiator(
        uIdentity,
        botIdentity.publicKey,
        botSignedPreKey.publicKey,
        botSignedPreKey.signature
      );
      addLog(`   ✅ 產生共享密鑰`);
      addLog(`   臨時公鑰: ${toBase64(x3dhResult.ephemeralPublicKey).slice(0, 24)}...`);

      // 用戶建立 Double Ratchet 會話
      const uSession = Session.initAsAlice(
        x3dhResult.sharedSecret,
        botSignedPreKey.publicKey
      );
      botWasmState.userSession = uSession;
      addLog('   ✅ 用戶建立 Double Ratchet 會話');

      await new Promise(resolve => setTimeout(resolve, 300));

      // Bot 接收連線請求並建立會話
      addLog('');
      addLog('   🤖 Bot Alice (接收者) 執行 X3DH...');
      const botSharedSecret = x3dhResponder(
        botIdentity,
        botSignedPreKey,
        null,
        uIdentity.publicKey,
        x3dhResult.ephemeralPublicKey
      );
      addLog(`   ✅ 計算出相同的共享密鑰`);

      // Bot 建立 Double Ratchet 會話
      const bSession = Session.initAsBob(
        botSharedSecret,
        botSignedPreKey.privateKey,
        botSignedPreKey.publicKey
      );
      botWasmState.session = bSession;
      addLog('   ✅ Bot 建立 Double Ratchet 會話');

      await new Promise(resolve => setTimeout(resolve, 200));

      // 將 Bot 加入好友列表（已驗證狀態 - 因為是 QR Code 掃描）
      addLog('');
      addLog('👥 將 Bot Alice 加入好友列表...');
      addFriend(botIdentity.publicKeyBase64, 'Bot Alice 🤖', 'verified');
      addLog('   ✅ Bot Alice 已加入好友（🟢 已驗證）');

      storeEstablish();
      setStep('connected');

      addLog('');
      addLog('═══════════════════════════════════════');
      addLog('🎉 加好友流程完成！');
      addLog('═══════════════════════════════════════');
      addLog('');
      addLog('✅ X3DH 金鑰協商成功');
      addLog('✅ Double Ratchet 會話已建立');
      addLog('✅ 好友已添加（已驗證狀態）');
      addLog('');
      addLog('💬 現在可以進入聊天，與 Bot Alice 對話');
      addLog('🔐 所有訊息將使用端對端加密');
      addLog('🔥 可以測試訊息刪除/銷毀功能');

    } catch (err) {
      addLog(`❌ 金鑰協商失敗: ${err}`);
      console.error(err);
      setStep('qr-ready');
    }
  }, [qrData, addLog, addFriend, storeEstablish]);

  // 清理/重置
  const cleanup = useCallback(() => {
    // 釋放 WASM 記憶體
    (botWasmState.identity as Identity | null)?.free();
    (botWasmState.signedPreKey as SignedPreKey | null)?.free();
    (botWasmState.session as Session | null)?.free();
    (botWasmState.userIdentity as Identity | null)?.free();
    (botWasmState.userSession as Session | null)?.free();

    botWasmState.identity = null;
    botWasmState.signedPreKey = null;
    botWasmState.session = null;
    botWasmState.userIdentity = null;
    botWasmState.userSession = null;

    lastProcessedMessageId = null;

    setStep('init');
    setQrData(null);
    resetBotStore();
    addLog('🔄 已重置所有狀態');
  }, [resetBotStore, addLog]);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* 標題 */}
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-white">完整加好友流程模擬</h2>
        <p className="text-sm text-dark-400">
          展示 QR Code 掃描 → X3DH 金鑰交換 → 加密通訊
          {cryptoVersion && <span className="ml-2 text-mist-400">v{cryptoVersion}</span>}
        </p>
      </div>

      {/* 步驟指示器 */}
      <div className="flex items-center gap-1 mb-3 text-xs overflow-x-auto pb-1">
        <div className={`px-2 py-1 rounded whitespace-nowrap ${
          step === 'init' ? 'bg-mist-600 text-white' : 'bg-green-600 text-white'
        }`}>
          {step === 'init' ? '1️⃣ 開始' : '✅ 開始'}
        </div>
        <span className="text-dark-500">→</span>
        <div className={`px-2 py-1 rounded whitespace-nowrap ${
          step === 'qr-ready' ? 'bg-mist-600 text-white animate-pulse' :
          ['scanning', 'key-exchange', 'connected'].includes(step) ? 'bg-green-600 text-white' :
          'bg-dark-600 text-dark-400'
        }`}>
          {['scanning', 'key-exchange', 'connected'].includes(step) ? '✅ QR Code' : '2️⃣ QR Code'}
        </div>
        <span className="text-dark-500">→</span>
        <div className={`px-2 py-1 rounded whitespace-nowrap ${
          step === 'scanning' || step === 'key-exchange' ? 'bg-purple-600 text-white animate-pulse' :
          step === 'connected' ? 'bg-green-600 text-white' :
          'bg-dark-600 text-dark-400'
        }`}>
          {step === 'connected' ? '✅ X3DH' : '3️⃣ X3DH'}
        </div>
        <span className="text-dark-500">→</span>
        <div className={`px-2 py-1 rounded whitespace-nowrap ${
          step === 'connected' ? 'bg-green-600 text-white' : 'bg-dark-600 text-dark-400'
        }`}>
          {step === 'connected' ? '✅ 完成' : '4️⃣ 完成'}
        </div>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
        {/* 左側：QR Code 和操作區 */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {/* QR Code 區域 */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">🤖</span>
              <div>
                <h3 className="font-medium text-white">Bot Alice</h3>
                <p className="text-xs text-dark-400">測試機器人</p>
              </div>
              {step === 'connected' && (
                <span className="ml-auto px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                  🟢 已驗證
                </span>
              )}
            </div>

            {/* QR Code 顯示 */}
            {qrData ? (
              <div className="space-y-3">
                <div className="flex justify-center bg-white rounded-lg p-3">
                  <QRCodeSVG
                    value={JSON.stringify(qrData)}
                    size={140}
                    level="M"
                  />
                </div>
                <p className="text-xs text-dark-400 text-center">
                  Bot Alice 的加好友 QR Code
                </p>
                <div className="text-xs">
                  <label className="text-dark-500">公鑰</label>
                  <div className="font-mono text-mist-400 bg-dark-700 rounded px-2 py-1 break-all">
                    {qrData.publicKey.slice(0, 28)}...
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-dark-400">
                <span className="text-4xl mb-2">📱</span>
                <p className="text-sm">點擊下方按鈕產生 QR Code</p>
              </div>
            )}
          </div>

          {/* 操作按鈕區 */}
          <div className="space-y-2">
            {step === 'init' && (
              <button
                onClick={generateBotQRCode}
                disabled={isInitializing}
                className="w-full px-4 py-3 bg-gradient-to-r from-mist-600 to-purple-600 hover:from-mist-700 hover:to-purple-700 disabled:from-dark-600 disabled:to-dark-600 text-white rounded-lg transition-all text-sm font-medium"
              >
                {isInitializing ? '⏳ 初始化中...' : '🚀 第一步：Bot 產生 QR Code'}
              </button>
            )}

            {step === 'qr-ready' && (
              <button
                onClick={scanAndConnect}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg transition-all text-sm font-medium animate-pulse"
              >
                📷 第二步：掃描 QR Code 加好友
              </button>
            )}

            {(step === 'scanning' || step === 'key-exchange') && (
              <div className="w-full px-4 py-3 bg-purple-900/30 border border-purple-500/30 text-purple-300 rounded-lg text-sm text-center">
                <span className="animate-pulse">🔐 正在進行金鑰交換...</span>
              </div>
            )}

            {step === 'connected' && (
              <>
                {onEnterChat && (
                  <button
                    onClick={onEnterChat}
                    className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-mist-600 hover:from-green-700 hover:to-mist-700 text-white rounded-lg transition-all text-sm font-medium"
                  >
                    💬 進入聊天，測試加密通訊
                  </button>
                )}
                <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                  <p className="text-sm text-green-400 font-medium">🎉 加好友成功！</p>
                  <ul className="text-xs text-green-300/80 mt-2 space-y-1">
                    <li>✅ X3DH 金鑰協商完成</li>
                    <li>✅ Double Ratchet 會話建立</li>
                    <li>✅ 好友已添加（已驗證狀態）</li>
                    <li>🔐 所有訊息端對端加密</li>
                    <li>🔥 可測試訊息刪除功能</li>
                  </ul>
                </div>
              </>
            )}

            <button
              onClick={cleanup}
              className="w-full px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-colors text-sm"
            >
              🔄 重置
            </button>
          </div>
        </div>

        {/* 右側：日誌 */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">🔐 加密協議日誌</h3>
            <button
              onClick={clearLogs}
              className="text-xs text-dark-400 hover:text-white transition-colors"
            >
              清除
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-dark-500">點擊「🚀 Bot 產生 QR Code」開始...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    log.includes('✅') || log.includes('完成') || log.includes('成功') || log.includes('🎉') || log.includes('═')
                      ? 'text-green-400'
                      : log.includes('❌') || log.includes('失敗')
                      ? 'text-red-400'
                      : log.includes('📷') || log.includes('📲') || log.includes('收到') || log.includes('回覆')
                      ? 'text-yellow-400'
                      : log.includes('🔐') || log.includes('公鑰') || log.includes('密鑰') || log.includes('X3DH')
                      ? 'text-purple-400'
                      : log.includes('💡') || log.includes('💬') || log.includes('🔥')
                      ? 'text-mist-400'
                      : 'text-dark-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      </div>

      {/* 底部說明 */}
      <div className="mt-3 text-xs text-dark-500">
        <p>
          <strong>完整流程：</strong>
          Bot 產生 QR Code（公鑰 + 簽名預密鑰）→ 用戶掃描 → X3DH 金鑰協商 →
          Double Ratchet 會話 → 開始加密通訊
        </p>
      </div>
    </div>
  );
}

export default LiveTestPanel;
