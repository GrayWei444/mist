/**
 * LiveTestPanel - 互動測試面板
 *
 * 讓用戶可以：
 * 1. 啟動測試機器人
 * 2. 將機器人加入好友列表
 * 3. 在真正的聊天界面與機器人互動
 *
 * 機器人狀態使用全局變數，離開頁面也不會丟失
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  initCrypto,
  Identity,
  SignedPreKey,
  Session,
  x3dhInitiator,
  x3dhResponder,
  getCryptoVersion,
} from '../../services/crypto';
import { useChatStore } from '../../stores/chatStore';
import { useBotStore, botWasmState } from '../../stores/botStore';

// 追蹤已處理的訊息 ID，避免重複回覆
let lastProcessedMessageId: string | null = null;

interface LiveTestPanelProps {
  onEnterChat?: () => void;
}

export function LiveTestPanel({ onEnterChat }: LiveTestPanelProps) {
  const { addFriend, friends, messages } = useChatStore();
  const { bot, logs, addLog, clearLogs, initializeBot: storeBotInit, establishSession: storeEstablish, reset: resetBotStore } = useBotStore();

  const [isInitializing, setIsInitializing] = useState(false);
  const [cryptoVersion, setCryptoVersion] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  // 檢查機器人是否已加為好友
  const botFriend = friends.find((f) => f.publicKey === bot.publicKey);
  const isAdded = !!botFriend;

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

  // 一鍵初始化：產生身份 + 加好友 + 建立會話
  const initializeBot = useCallback(async () => {
    if (isInitializing) return;
    setIsInitializing(true);

    try {
      addLog('正在初始化 WASM 加密模組...');
      await initCrypto();
      const version = getCryptoVersion();
      setCryptoVersion(version);
      addLog(`加密模組已載入 (v${version})`);

      // 產生機器人身份
      addLog('正在產生機器人身份...');
      const identity = Identity.generate();
      const signedPreKey = SignedPreKey.generate(identity, 1);

      // 存到全局狀態
      botWasmState.identity = identity;
      botWasmState.signedPreKey = signedPreKey;

      storeBotInit(identity.publicKeyBase64);
      addLog(`機器人公鑰: ${identity.publicKeyBase64.slice(0, 32)}...`);

      // 產生用戶身份（模擬本地用戶）
      addLog('正在產生用戶身份...');
      const uIdentity = Identity.generate();
      SignedPreKey.generate(uIdentity, 1); // 產生但不需要存儲
      botWasmState.userIdentity = uIdentity;

      addLog(`用戶公鑰: ${uIdentity.publicKeyBase64.slice(0, 32)}...`);

      // 自動加為好友
      addLog('自動將機器人加入好友列表...');
      addFriend(identity.publicKeyBase64, 'Bot Alice 🤖', 'verified');
      addLog('✅ Bot Alice 已加入好友');

      // 自動建立 X3DH 會話
      addLog('正在建立 X3DH 加密會話...');

      const x3dhResult = x3dhInitiator(
        uIdentity,
        identity.publicKey,
        signedPreKey.publicKey,
        signedPreKey.signature
      );

      const uSession = Session.initAsAlice(
        x3dhResult.sharedSecret,
        signedPreKey.publicKey
      );
      botWasmState.userSession = uSession;

      const botSharedSecret = x3dhResponder(
        identity,
        signedPreKey,
        null,
        uIdentity.publicKey,
        x3dhResult.ephemeralPublicKey
      );

      const bSession = Session.initAsBob(
        botSharedSecret,
        signedPreKey.privateKey,
        signedPreKey.publicKey
      );
      botWasmState.session = bSession;

      storeEstablish();

      addLog('✅ X3DH 金鑰協商完成');
      addLog('✅ Double Ratchet 會話已建立');
      addLog('');
      addLog('🎉 設定完成！返回聊天界面找 Bot Alice 對話');
      addLog('💡 機器人會持續運行，即使離開此頁面');
    } catch (err) {
      addLog(`初始化失敗: ${err}`);
      console.error(err);
    } finally {
      setIsInitializing(false);
    }
  }, [addLog, addFriend, storeBotInit, storeEstablish, isInitializing]);

  // 清理
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

    resetBotStore();
    addLog('已清理所有資源');
  }, [resetBotStore, addLog]);

  return (
    <div className="h-full flex flex-col p-4">
      {/* 標題 */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">互動測試模式</h2>
        <p className="text-sm text-dark-400">
          與機器人建立加密會話，在真實聊天界面測試
          {cryptoVersion && <span className="ml-2 text-mist-400">v{cryptoVersion}</span>}
        </p>
      </div>

      {/* 操作按鈕 */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={initializeBot}
          disabled={bot.isInitialized || isInitializing}
          className="px-4 py-2 bg-gradient-to-r from-mist-600 to-purple-600 hover:from-mist-700 hover:to-purple-700 disabled:from-dark-600 disabled:to-dark-600 disabled:text-dark-400 text-white rounded-lg transition-all text-sm font-medium"
        >
          {isInitializing ? '⏳ 初始化中...' : bot.isInitialized ? '✅ 機器人已就緒' : '🚀 一鍵啟動測試機器人'}
        </button>

        <button
          onClick={cleanup}
          className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-colors text-sm"
        >
          重置
        </button>
      </div>

      {/* 機器人狀態 */}
      {bot.isInitialized && (
        <div className="bg-dark-card rounded-xl p-4 mb-4 border border-dark-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mist-500 to-purple-600 flex items-center justify-center text-2xl">
              🤖
            </div>
            <div>
              <h3 className="font-medium text-white">{bot.name}</h3>
              <p className="text-xs text-dark-400">測試機器人（持久運行中）</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {isAdded && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full">
                  已加好友
                </span>
              )}
              {bot.isSessionEstablished && (
                <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-400 rounded-full animate-pulse">
                  🔐 加密連線
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-xs text-dark-400">Ed25519 公鑰</label>
              <div className="text-xs font-mono text-mist-400 bg-dark-700 rounded px-2 py-1.5 break-all">
                {bot.publicKey}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 使用說明 + 進入聊天按鈕 */}
      {bot.isSessionEstablished && isAdded && (
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3 mb-4">
          <p className="text-sm text-green-400">
            ✅ 機器人運行中！
          </p>
          {onEnterChat ? (
            <button
              onClick={onEnterChat}
              className="w-full mt-3 px-4 py-3 bg-gradient-to-r from-green-600 to-mist-600 hover:from-green-700 hover:to-mist-700 text-white rounded-lg transition-all text-sm font-medium"
            >
              💬 進入聊天，與 Bot Alice 對話
            </button>
          ) : (
            <ol className="text-sm text-green-300/80 mt-2 ml-4 list-decimal space-y-1">
              <li>返回主畫面（點左上角 ←）</li>
              <li>長按太陽 ☀️ 進入聊天</li>
              <li>選擇「Bot Alice 🤖」</li>
              <li>發送訊息，機器人會自動回覆！</li>
            </ol>
          )}
          <p className="text-xs text-green-500/60 mt-3">
            💡 機器人會持續運行，即使離開此頁面
          </p>
        </div>
      )}

      {/* 日誌 */}
      <div className="flex-1 bg-dark-card rounded-xl border border-dark-border overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-dark-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">操作日誌</h3>
          <button
            onClick={clearLogs}
            className="text-xs text-dark-400 hover:text-white transition-colors"
          >
            清除
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-dark-500">點擊「🚀 一鍵啟動測試機器人」開始...</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  log.includes('✅') || log.includes('完成') || log.includes('成功') || log.includes('🎉')
                    ? 'text-green-400'
                    : log.includes('❌') || log.includes('失敗')
                    ? 'text-red-400'
                    : log.includes('收到') || log.includes('回覆')
                    ? 'text-yellow-400'
                    : log.includes('公鑰') || log.includes('身份') || log.includes('💡')
                    ? 'text-purple-400'
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
  );
}

export default LiveTestPanel;
