/**
 * QRCodeExchange - QR Code 加好友模擬器
 *
 * 模擬真實的加好友流程：
 * 1. 用戶 A 產生 QR Code（包含公鑰 + 簽名預密鑰）
 * 2. 用戶 B 掃描 QR Code
 * 3. 執行 X3DH 金鑰協商
 * 4. 建立 Double Ratchet 加密會話
 * 5. 雙方成為好友，可以加密通訊
 */

import { useState, useRef, useCallback } from 'react';
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

// QR Code 資料結構
interface QRCodeData {
  version: number;
  publicKey: string;           // Base64 Ed25519 公鑰
  signedPreKeyPub: string;     // Base64 簽名預密鑰公鑰
  signature: string;           // Base64 簽名
  name: string;                // 顯示名稱
}

// 設備狀態
interface DeviceState {
  name: string;
  identity: Identity | null;
  signedPreKey: SignedPreKey | null;
  session: Session | null;
  publicKey: string;
  qrData: QRCodeData | null;
  friendPublicKey: string;
  friendName: string;
  isSessionEstablished: boolean;
}

const initialDeviceState = (name: string): DeviceState => ({
  name,
  identity: null,
  signedPreKey: null,
  session: null,
  publicKey: '',
  qrData: null,
  friendPublicKey: '',
  friendName: '',
  isSessionEstablished: false,
});

export function QRCodeExchange() {
  const [deviceA, setDeviceA] = useState<DeviceState>(initialDeviceState('Alice 👩'));
  const [deviceB, setDeviceB] = useState<DeviceState>(initialDeviceState('Bob 👨'));
  const [logs, setLogs] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [step, setStep] = useState<'init' | 'qr-generated' | 'scanned' | 'connected'>('init');
  const [cryptoVersion, setCryptoVersion] = useState('');

  // 訊息狀態（雙方共用同一個訊息列表）
  const [messages, setMessages] = useState<Array<{ from: string; text: string; encrypted: string }>>([]);
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  // 追蹤是否 Bob 已發送第一條訊息（DR 協議要求掃描者先發）
  const [bobSentFirst, setBobSentFirst] = useState(false);

  // WASM 物件存儲（不能放在 React state）
  const wasmRef = useRef<{
    identityA: Identity | null;
    signedPreKeyA: SignedPreKey | null;
    sessionA: Session | null;
    identityB: Identity | null;
    signedPreKeyB: SignedPreKey | null;
    sessionB: Session | null;
  }>({
    identityA: null,
    signedPreKeyA: null,
    sessionA: null,
    identityB: null,
    signedPreKeyB: null,
    sessionB: null,
  });

  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-50), `[${timestamp}] ${msg}`]);
  }, []);

  // 初始化加密模組
  const initialize = useCallback(async () => {
    try {
      addLog('正在初始化 WASM 加密模組...');
      await initCrypto();
      const version = getCryptoVersion();
      setCryptoVersion(version);
      addLog(`✅ 加密模組已載入 (v${version})`);
      setIsInitialized(true);
    } catch (err) {
      addLog(`❌ 初始化失敗: ${err}`);
    }
  }, [addLog]);

  // 為設備產生身份和 QR Code
  const generateIdentity = useCallback(async (device: 'A' | 'B') => {
    if (!isInitialized) {
      await initialize();
    }

    const deviceName = device === 'A' ? 'Alice 👩' : 'Bob 👨';
    addLog(`📱 ${deviceName} 正在產生身份...`);

    try {
      const identity = Identity.generate();
      const signedPreKey = SignedPreKey.generate(identity, 1);

      // 存儲 WASM 物件
      if (device === 'A') {
        wasmRef.current.identityA = identity;
        wasmRef.current.signedPreKeyA = signedPreKey;
      } else {
        wasmRef.current.identityB = identity;
        wasmRef.current.signedPreKeyB = signedPreKey;
      }

      // 產生 QR Code 資料
      const qrData: QRCodeData = {
        version: 1,
        publicKey: identity.publicKeyBase64,
        signedPreKeyPub: signedPreKey.publicKeyBase64,
        signature: toBase64(signedPreKey.signature),
        name: deviceName,
      };

      const newState: DeviceState = {
        name: deviceName,
        identity,
        signedPreKey,
        session: null,
        publicKey: identity.publicKeyBase64,
        qrData,
        friendPublicKey: '',
        friendName: '',
        isSessionEstablished: false,
      };

      if (device === 'A') {
        setDeviceA(newState);
        addLog(`✅ Alice 身份已產生`);
        addLog(`   公鑰: ${identity.publicKeyBase64.slice(0, 24)}...`);
      } else {
        setDeviceB(newState);
        addLog(`✅ Bob 身份已產生`);
        addLog(`   公鑰: ${identity.publicKeyBase64.slice(0, 24)}...`);
      }

      return qrData;
    } catch (err) {
      addLog(`❌ 產生身份失敗: ${err}`);
      return null;
    }
  }, [isInitialized, initialize, addLog]);

  // 一鍵產生雙方身份和 Alice 的 QR Code
  const setupBothDevices = useCallback(async () => {
    addLog('🚀 開始設定雙方設備...');
    addLog('');

    await generateIdentity('A');
    await generateIdentity('B');

    setStep('qr-generated');
    addLog('');
    addLog('📲 Alice 的 QR Code 已產生');
    addLog('💡 Bob 可以掃描此 QR Code 來加好友');
  }, [generateIdentity, addLog]);

  // 模擬 Bob 掃描 Alice 的 QR Code
  const scanQRCode = useCallback(async () => {
    if (!deviceA.qrData || !wasmRef.current.identityB || !wasmRef.current.signedPreKeyB) {
      addLog('❌ 請先產生雙方身份');
      return;
    }

    addLog('');
    addLog('📷 Bob 正在掃描 Alice 的 QR Code...');
    addLog(`   讀取到公鑰: ${deviceA.qrData.publicKey.slice(0, 24)}...`);
    addLog(`   讀取到名稱: ${deviceA.qrData.name}`);

    try {
      // Bob 需要 Alice 的原始公鑰（從 Base64 轉換）
      // 這裡我們直接使用存儲的 WASM 物件
      const aliceIdentity = wasmRef.current.identityA!;
      const aliceSignedPreKey = wasmRef.current.signedPreKeyA!;
      const bobIdentity = wasmRef.current.identityB;

      setStep('scanned');
      addLog('');
      addLog('🔐 開始 X3DH 金鑰協商...');

      // Bob 作為發起者執行 X3DH
      addLog('   Bob (發起者) 執行 X3DH...');
      const x3dhResult = x3dhInitiator(
        bobIdentity,
        aliceIdentity.publicKey,
        aliceSignedPreKey.publicKey,
        aliceSignedPreKey.signature
      );
      addLog(`   ✅ 產生共享密鑰`);
      addLog(`   臨時公鑰: ${toBase64(x3dhResult.ephemeralPublicKey).slice(0, 24)}...`);

      // Bob 建立 Double Ratchet 會話（作為 Alice）
      const bobSession = Session.initAsAlice(
        x3dhResult.sharedSecret,
        aliceSignedPreKey.publicKey
      );
      wasmRef.current.sessionB = bobSession;
      addLog('   ✅ Bob 建立 Double Ratchet 會話');

      // Alice 接收連線請求並建立會話
      addLog('');
      addLog('   Alice (接收者) 執行 X3DH...');
      const aliceSharedSecret = x3dhResponder(
        aliceIdentity,
        aliceSignedPreKey,
        null,
        bobIdentity.publicKey,
        x3dhResult.ephemeralPublicKey
      );
      addLog(`   ✅ 計算出相同的共享密鑰`);

      // Alice 建立 Double Ratchet 會話（作為 Bob）
      const aliceSession = Session.initAsBob(
        aliceSharedSecret,
        aliceSignedPreKey.privateKey,
        aliceSignedPreKey.publicKey
      );
      wasmRef.current.sessionA = aliceSession;
      addLog('   ✅ Alice 建立 Double Ratchet 會話');

      // 更新狀態
      setDeviceA((prev) => ({
        ...prev,
        session: aliceSession,
        friendPublicKey: bobIdentity.publicKeyBase64,
        friendName: 'Bob 👨',
        isSessionEstablished: true,
      }));

      setDeviceB((prev) => ({
        ...prev,
        session: bobSession,
        friendPublicKey: aliceIdentity.publicKeyBase64,
        friendName: 'Alice 👩',
        isSessionEstablished: true,
      }));

      setStep('connected');
      addLog('');
      addLog('🎉 加密會話建立成功！');
      addLog('✅ Alice 和 Bob 現在是好友了');
      addLog('');
      addLog('📋 Double Ratchet 協議說明：');
      addLog('   • 掃描者（Bob）需要先發送第一條訊息');
      addLog('   • Alice 收到後才能回覆');
      addLog('   • 這是協議的安全設計，確保金鑰正確同步');
      addLog('');
      addLog('💬 請讓 Bob 先發送訊息開始對話');

    } catch (err) {
      addLog(`❌ 金鑰協商失敗: ${err}`);
      console.error(err);
    }
  }, [deviceA.qrData, addLog]);

  // 發送加密訊息
  const sendMessage = useCallback((from: 'A' | 'B') => {
    const input = from === 'A' ? inputA : inputB;
    if (!input.trim()) return;

    // Double Ratchet 協議：X3DH 發起者（Bob，掃描者）必須先發送
    // 因為 DR 的 "Alice"（發起者）才有初始的 sending chain
    if (from === 'A' && !bobSentFirst) {
      addLog('⚠️ Double Ratchet 協議要求掃描者（Bob）先發送第一條訊息');
      addLog('   Alice 需要先收到 Bob 的訊息才能回覆');
      return;
    }

    const senderSession = from === 'A' ? wasmRef.current.sessionA : wasmRef.current.sessionB;
    const receiverSession = from === 'A' ? wasmRef.current.sessionB : wasmRef.current.sessionA;

    if (!senderSession || !receiverSession) {
      addLog('❌ 會話未建立');
      return;
    }

    try {
      const senderName = from === 'A' ? 'Alice' : 'Bob';
      const receiverName = from === 'A' ? 'Bob' : 'Alice';

      // 加密訊息
      const encrypted = senderSession.encrypt(input);
      const encryptedBase64 = toBase64(encrypted.ciphertext);

      addLog(`📤 ${senderName} 發送: "${input}"`);
      addLog(`   密文: ${encryptedBase64.slice(0, 32)}...`);

      // 解密訊息
      const decrypted = receiverSession.decrypt(encrypted);
      const decryptedText = new TextDecoder().decode(decrypted);

      addLog(`📥 ${receiverName} 解密: "${decryptedText}"`);

      // 更新訊息列表
      const newMessage = {
        from: senderName,
        text: input,
        encrypted: encryptedBase64.slice(0, 40) + '...',
      };

      setMessages((prev) => [...prev, newMessage]);

      // 如果是 Bob 第一次發送，標記已完成
      if (from === 'B' && !bobSentFirst) {
        setBobSentFirst(true);
        addLog('✅ Bob 發送了第一條訊息，Alice 現在可以回覆');
      }

      if (from === 'A') {
        setInputA('');
      } else {
        setInputB('');
      }

    } catch (err) {
      addLog(`❌ 加密/解密失敗: ${err}`);
      console.error(err);
    }
  }, [inputA, inputB, addLog, bobSentFirst]);

  // 重置
  const reset = useCallback(() => {
    // 釋放 WASM 記憶體
    wasmRef.current.identityA?.free();
    wasmRef.current.signedPreKeyA?.free();
    wasmRef.current.sessionA?.free();
    wasmRef.current.identityB?.free();
    wasmRef.current.signedPreKeyB?.free();
    wasmRef.current.sessionB?.free();

    wasmRef.current = {
      identityA: null,
      signedPreKeyA: null,
      sessionA: null,
      identityB: null,
      signedPreKeyB: null,
      sessionB: null,
    };

    setDeviceA(initialDeviceState('Alice 👩'));
    setDeviceB(initialDeviceState('Bob 👨'));
    setMessages([]);
    setInputA('');
    setInputB('');
    setBobSentFirst(false);
    setStep('init');
    setLogs([]);
    addLog('🔄 已重置所有狀態');
  }, [addLog]);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* 標題 */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">QR Code 加好友模擬</h2>
        <p className="text-sm text-dark-400">
          模擬真實的 QR Code 掃描加好友流程
          {cryptoVersion && <span className="ml-2 text-mist-400">v{cryptoVersion}</span>}
        </p>
      </div>

      {/* 步驟指示器 */}
      <div className="flex items-center gap-2 mb-4 text-xs">
        <div className={`px-2 py-1 rounded ${step === 'init' ? 'bg-mist-600 text-white' : 'bg-dark-600 text-dark-400'}`}>
          1. 初始化
        </div>
        <span className="text-dark-500">→</span>
        <div className={`px-2 py-1 rounded ${step === 'qr-generated' ? 'bg-mist-600 text-white' : 'bg-dark-600 text-dark-400'}`}>
          2. 產生 QR
        </div>
        <span className="text-dark-500">→</span>
        <div className={`px-2 py-1 rounded ${step === 'scanned' ? 'bg-mist-600 text-white' : 'bg-dark-600 text-dark-400'}`}>
          3. 掃描
        </div>
        <span className="text-dark-500">→</span>
        <div className={`px-2 py-1 rounded ${step === 'connected' ? 'bg-green-600 text-white' : 'bg-dark-600 text-dark-400'}`}>
          4. 已連線
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-2 mb-4">
        {step === 'init' && (
          <button
            onClick={setupBothDevices}
            className="px-4 py-2 bg-gradient-to-r from-mist-600 to-purple-600 hover:from-mist-700 hover:to-purple-700 text-white rounded-lg text-sm font-medium"
          >
            🚀 初始化雙方設備
          </button>
        )}
        {step === 'qr-generated' && (
          <button
            onClick={scanQRCode}
            className="px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 text-white rounded-lg text-sm font-medium"
          >
            📷 Bob 掃描 QR Code
          </button>
        )}
        <button
          onClick={reset}
          className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg text-sm"
        >
          重置
        </button>
      </div>

      {/* 主要內容區 */}
      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* 左側：雙方設備 */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          {/* Alice 的設備 */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">👩</span>
              <span className="font-medium text-white">Alice</span>
              {deviceA.isSessionEstablished && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full ml-auto">
                  🔐 已連線
                </span>
              )}
            </div>

            {deviceA.qrData && (
              <div className="space-y-3">
                {/* QR Code */}
                <div className="flex justify-center bg-white rounded-lg p-3">
                  <QRCodeSVG
                    value={JSON.stringify(deviceA.qrData)}
                    size={120}
                    level="M"
                  />
                </div>
                <p className="text-xs text-dark-400 text-center">Alice 的加好友 QR Code</p>

                {/* 公鑰資訊 */}
                <div className="text-xs">
                  <label className="text-dark-500">公鑰</label>
                  <div className="font-mono text-mist-400 bg-dark-700 rounded px-2 py-1 break-all">
                    {deviceA.publicKey.slice(0, 32)}...
                  </div>
                </div>

                {/* 好友資訊 */}
                {deviceA.friendName && (
                  <div className="text-xs">
                    <label className="text-dark-500">好友</label>
                    <div className="text-green-400">{deviceA.friendName}</div>
                  </div>
                )}
              </div>
            )}

            {/* 訊息輸入（已連線後） */}
            {deviceA.isSessionEstablished && (
              <div className="mt-3">
                {!bobSentFirst && (
                  <p className="text-xs text-yellow-400 mb-2">
                    ⏳ 等待 Bob 發送第一條訊息...
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputA}
                    onChange={(e) => setInputA(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage('A')}
                    placeholder={bobSentFirst ? "輸入訊息..." : "等待 Bob 先發訊息..."}
                    disabled={!bobSentFirst}
                    className="flex-1 px-3 py-1.5 bg-dark-700 border border-dark-border rounded text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                  <button
                    onClick={() => sendMessage('A')}
                    disabled={!bobSentFirst}
                    className="px-3 py-1.5 bg-mist-600 hover:bg-mist-700 disabled:bg-dark-600 disabled:cursor-not-allowed text-white rounded text-sm"
                  >
                    發送
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Bob 的設備 */}
          <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">👨</span>
              <span className="font-medium text-white">Bob</span>
              {deviceB.isSessionEstablished && (
                <span className="px-2 py-0.5 text-xs bg-green-500/20 text-green-400 rounded-full ml-auto">
                  🔐 已連線
                </span>
              )}
            </div>

            {deviceB.publicKey && (
              <div className="space-y-3">
                {/* 公鑰資訊 */}
                <div className="text-xs">
                  <label className="text-dark-500">公鑰</label>
                  <div className="font-mono text-purple-400 bg-dark-700 rounded px-2 py-1 break-all">
                    {deviceB.publicKey.slice(0, 32)}...
                  </div>
                </div>

                {/* 好友資訊 */}
                {deviceB.friendName && (
                  <div className="text-xs">
                    <label className="text-dark-500">好友</label>
                    <div className="text-green-400">{deviceB.friendName}</div>
                  </div>
                )}

                {/* 掃描提示 */}
                {step === 'qr-generated' && (
                  <div className="text-center py-2">
                    <p className="text-sm text-yellow-400">📷 等待掃描 Alice 的 QR Code</p>
                  </div>
                )}
              </div>
            )}

            {/* 訊息輸入（已連線後） */}
            {deviceB.isSessionEstablished && (
              <div className="mt-3">
                {!bobSentFirst && (
                  <p className="text-xs text-green-400 mb-2">
                    👆 Bob 請先發送第一條訊息（DR 協議要求）
                  </p>
                )}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputB}
                    onChange={(e) => setInputB(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendMessage('B')}
                    placeholder={bobSentFirst ? "輸入訊息..." : "請先發送第一條訊息..."}
                    className="flex-1 px-3 py-1.5 bg-dark-700 border border-dark-border rounded text-sm text-white"
                  />
                  <button
                    onClick={() => sendMessage('B')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded text-sm"
                  >
                    發送
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 訊息列表 */}
          {messages.length > 0 && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <h4 className="text-sm font-medium text-white mb-2">💬 對話記錄</h4>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {messages.map((msg, i) => (
                  <div
                    key={i}
                    className={`text-xs p-2 rounded ${
                      msg.from === 'Alice' ? 'bg-mist-900/30 text-mist-300' : 'bg-purple-900/30 text-purple-300'
                    }`}
                  >
                    <span className="font-medium">{msg.from}:</span> {msg.text}
                    <div className="text-dark-500 font-mono text-[10px] mt-1">
                      密文: {msg.encrypted}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 右側：日誌 */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-dark-border">
            <h3 className="text-sm font-medium text-white">🔐 加密協議日誌</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-dark-500">點擊「初始化雙方設備」開始...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    log.includes('✅') || log.includes('🎉')
                      ? 'text-green-400'
                      : log.includes('❌')
                      ? 'text-red-400'
                      : log.includes('📷') || log.includes('📲') || log.includes('📤') || log.includes('📥')
                      ? 'text-yellow-400'
                      : log.includes('🔐') || log.includes('公鑰') || log.includes('密鑰')
                      ? 'text-purple-400'
                      : log.includes('💡') || log.includes('💬')
                      ? 'text-mist-400'
                      : 'text-dark-300'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 說明 */}
      <div className="mt-4 text-xs text-dark-500">
        <p>
          <strong>流程說明：</strong>
          Alice 產生包含公鑰和簽名預密鑰的 QR Code → Bob 掃描後執行 X3DH 金鑰協商 →
          雙方建立 Double Ratchet 會話 → 開始加密通訊
        </p>
      </div>
    </div>
  );
}

export default QRCodeExchange;
