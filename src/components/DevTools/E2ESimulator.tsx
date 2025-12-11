/**
 * E2ESimulator - 端到端加密測試模擬器
 *
 * 模擬兩台設備透過 MQTT 交換加密訊息
 * 使用真實的 X3DH + Double Ratchet 加密
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import {
  initCrypto,
  Identity,
  SignedPreKey,
  Session,
  x3dhInitiator,
  x3dhResponder,
  getCryptoVersion,
} from '../../services/crypto';

interface DeviceMessage {
  id: string;
  from: 'self' | 'peer';
  content: string;
  encrypted: string;
  timestamp: number;
}

interface SimulatedDevice {
  name: string;
  identity: Identity | null;
  signedPreKey: SignedPreKey | null;
  session: Session | null;
  connected: boolean;
  messages: DeviceMessage[];
}

const initialDevice = (name: string): SimulatedDevice => ({
  name,
  identity: null,
  signedPreKey: null,
  session: null,
  connected: false,
  messages: [],
});

export function E2ESimulator() {
  // 使用 ref 來存儲 WASM 物件，避免 React state 序列化問題
  const deviceARef = useRef<SimulatedDevice>(initialDevice('Device A'));
  const deviceBRef = useRef<SimulatedDevice>(initialDevice('Device B'));

  // UI 狀態
  const [deviceAState, setDeviceAState] = useState({ publicKey: '', connected: false, messages: [] as DeviceMessage[] });
  const [deviceBState, setDeviceBState] = useState({ publicKey: '', connected: false, messages: [] as DeviceMessage[] });
  const [inputA, setInputA] = useState('');
  const [inputB, setInputB] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [cryptoVersion, setCryptoVersion] = useState<string>('');

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 添加日誌
  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-50), `[${timestamp}] ${message}`]);
  }, []);

  // 滾動到最新日誌
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 更新設備狀態到 UI
  const syncDeviceState = useCallback((device: 'A' | 'B') => {
    const deviceRef = device === 'A' ? deviceARef : deviceBRef;
    const setDeviceState = device === 'A' ? setDeviceAState : setDeviceBState;

    setDeviceState({
      publicKey: deviceRef.current.identity?.publicKeyBase64 || '',
      connected: deviceRef.current.connected,
      messages: [...deviceRef.current.messages],
    });
  }, []);

  // 初始化 Crypto 服務
  const initializeCrypto = useCallback(async () => {
    try {
      addLog('正在初始化 WASM 加密模組...');
      await initCrypto();
      const version = getCryptoVersion();
      setCryptoVersion(version);
      setIsInitialized(true);
      addLog(`✅ 加密模組初始化完成 (v${version})`);
    } catch (err) {
      addLog(`❌ 初始化失敗: ${err}`);
    }
  }, [addLog]);

  // 產生身份
  const generateIdentity = useCallback(
    (device: 'A' | 'B') => {
      if (!isInitialized) {
        addLog('❌ 請先初始化加密服務');
        return;
      }

      try {
        const deviceName = device === 'A' ? 'Device A' : 'Device B';
        const deviceRef = device === 'A' ? deviceARef : deviceBRef;

        addLog(`🔑 ${deviceName} 正在產生身份金鑰...`);

        // 產生 Ed25519 身份金鑰
        const identity = Identity.generate();
        // 產生簽名的 PreKey
        const signedPreKey = SignedPreKey.generate(identity, 1);

        deviceRef.current.identity = identity;
        deviceRef.current.signedPreKey = signedPreKey;

        syncDeviceState(device);

        addLog(`✅ ${deviceName} 身份已產生`);
        addLog(`   公鑰 (Ed25519): ${identity.publicKeyBase64.slice(0, 32)}...`);
        addLog(`   已簽名 PreKey 已產生`);
      } catch (err) {
        addLog(`❌ 產生身份失敗: ${err}`);
      }
    },
    [isInitialized, addLog, syncDeviceState]
  );

  // 建立 X3DH 會話
  const establishSession = useCallback(() => {
    const deviceA = deviceARef.current;
    const deviceB = deviceBRef.current;

    if (!deviceA.identity || !deviceA.signedPreKey || !deviceB.identity || !deviceB.signedPreKey) {
      addLog('❌ 雙方都需要先產生身份');
      return;
    }

    try {
      addLog('🤝 正在執行 X3DH 金鑰協商...');

      // Device A 作為發起者
      addLog('   Device A (發起者) 執行 X3DH...');
      const x3dhResultA = x3dhInitiator(
        deviceA.identity,
        deviceB.identity.publicKey,
        deviceB.signedPreKey.publicKey,
        deviceB.signedPreKey.signature
      );

      addLog(`   共享密鑰已計算 (HKDF)`);

      // Device A 建立 Double Ratchet 會話
      const sessionA = Session.initAsAlice(
        x3dhResultA.sharedSecret,
        deviceB.signedPreKey.publicKey
      );
      deviceA.session = sessionA;

      // Device B 作為接收者
      addLog('   Device B (接收者) 執行 X3DH...');
      const sharedSecretB = x3dhResponder(
        deviceB.identity,
        deviceB.signedPreKey,
        null, // 沒有使用 OneTimePreKey
        deviceA.identity.publicKey,
        x3dhResultA.ephemeralPublicKey
      );

      // Device B 建立 Double Ratchet 會話
      const sessionB = Session.initAsBob(
        sharedSecretB,
        deviceB.signedPreKey.privateKey,
        deviceB.signedPreKey.publicKey,
        x3dhResultA.ephemeralPublicKey
      );
      deviceB.session = sessionB;

      // 更新連線狀態
      deviceA.connected = true;
      deviceB.connected = true;

      syncDeviceState('A');
      syncDeviceState('B');

      addLog('✅ X3DH 金鑰協商完成！');
      addLog('✅ Double Ratchet 會話已建立');
      addLog('   現在雙方可以開始交換加密訊息');
    } catch (err) {
      addLog(`❌ 建立會話失敗: ${err}`);
      console.error(err);
    }
  }, [addLog, syncDeviceState]);

  // 發送加密訊息
  const sendMessage = useCallback(
    (from: 'A' | 'B', content: string) => {
      const sender = from === 'A' ? deviceARef.current : deviceBRef.current;
      const receiver = from === 'A' ? deviceBRef.current : deviceARef.current;
      const senderName = from === 'A' ? 'Device A' : 'Device B';
      const receiverName = from === 'A' ? 'Device B' : 'Device A';

      if (!sender.session || !receiver.session) {
        addLog('❌ 請先建立會話');
        return;
      }

      try {
        addLog(`📤 ${senderName} 發送: "${content}"`);

        // 加密訊息 (Double Ratchet)
        addLog(`🔐 使用 Double Ratchet 加密...`);
        const encrypted = sender.session.encrypt(content);
        const encryptedStr = JSON.stringify(encrypted);
        addLog(`   密文長度: ${encryptedStr.length} bytes`);

        // 模擬網路傳輸
        addLog(`📡 模擬 MQTT 傳輸...`);

        // 解密訊息
        addLog(`🔓 ${receiverName} 解密中...`);
        const decrypted = receiver.session.decryptToString(encrypted);
        addLog(`   解密結果: "${decrypted}"`);

        // 驗證解密正確
        if (decrypted === content) {
          addLog(`✅ 訊息傳送成功！加密驗證通過`);
        } else {
          addLog(`⚠️ 警告：解密內容不匹配`);
        }

        // 更新訊息列表
        const messageId = `msg-${Date.now()}`;
        const newMessage: DeviceMessage = {
          id: messageId,
          from: 'self',
          content,
          encrypted: encryptedStr.slice(0, 50) + '...',
          timestamp: Date.now(),
        };

        const receivedMessage: DeviceMessage = {
          id: messageId + '-received',
          from: 'peer',
          content: decrypted,
          encrypted: encryptedStr.slice(0, 50) + '...',
          timestamp: Date.now(),
        };

        sender.messages.push(newMessage);
        receiver.messages.push(receivedMessage);

        syncDeviceState('A');
        syncDeviceState('B');
      } catch (err) {
        addLog(`❌ 發送失敗: ${err}`);
        console.error(err);
      }
    },
    [addLog, syncDeviceState]
  );

  // 清除所有狀態
  const reset = useCallback(() => {
    // 釋放 WASM 記憶體
    deviceARef.current.identity?.free();
    deviceARef.current.signedPreKey?.free();
    deviceARef.current.session?.free();
    deviceBRef.current.identity?.free();
    deviceBRef.current.signedPreKey?.free();
    deviceBRef.current.session?.free();

    // 重置
    deviceARef.current = initialDevice('Device A');
    deviceBRef.current = initialDevice('Device B');

    setDeviceAState({ publicKey: '', connected: false, messages: [] });
    setDeviceBState({ publicKey: '', connected: false, messages: [] });
    setInputA('');
    setInputB('');
    setLogs([]);
    setIsInitialized(false);
    setCryptoVersion('');

    addLog('🔄 已重置所有狀態');
  }, [addLog]);

  // 渲染設備面板
  const renderDevice = (
    deviceState: { publicKey: string; connected: boolean; messages: DeviceMessage[] },
    deviceId: 'A' | 'B',
    input: string,
    setInput: (v: string) => void
  ) => {
    const deviceName = deviceId === 'A' ? 'Device A' : 'Device B';

    return (
      <div className="flex-1 bg-dark-card rounded-xl p-4 border border-dark-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-white">{deviceName}</h3>
          <span
            className={`px-2 py-0.5 text-xs rounded-full ${
              deviceState.connected
                ? 'bg-green-500/20 text-green-400'
                : 'bg-dark-600 text-dark-400'
            }`}
          >
            {deviceState.connected ? '會話已建立' : '未連線'}
          </span>
        </div>

        {/* 公鑰 */}
        <div className="mb-3">
          <label className="text-xs text-dark-400">Ed25519 公鑰</label>
          <div className="text-xs font-mono text-mist-400 bg-dark-700 rounded px-2 py-1 truncate">
            {deviceState.publicKey ? deviceState.publicKey.slice(0, 40) + '...' : '(未產生)'}
          </div>
        </div>

        {/* 按鈕 */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => generateIdentity(deviceId)}
            disabled={!!deviceState.publicKey}
            className="flex-1 px-3 py-1.5 text-sm bg-mist-600 hover:bg-mist-700 disabled:bg-dark-600 disabled:text-dark-400 text-white rounded-lg transition-colors"
          >
            產生身份
          </button>
        </div>

        {/* 訊息列表 */}
        <div className="h-32 overflow-y-auto bg-dark-700 rounded-lg p-2 mb-3">
          {deviceState.messages.length === 0 ? (
            <p className="text-xs text-dark-500 text-center py-4">尚無訊息</p>
          ) : (
            deviceState.messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-2 ${msg.from === 'self' ? 'text-right' : 'text-left'}`}
              >
                <span
                  className={`inline-block px-2 py-1 rounded-lg text-sm ${
                    msg.from === 'self'
                      ? 'bg-mist-600 text-white'
                      : 'bg-dark-600 text-dark-200'
                  }`}
                >
                  {msg.content}
                </span>
                <div className="text-xs text-dark-500 mt-0.5">
                  🔐 {msg.from === 'self' ? '已加密發送' : '已解密接收'}
                </div>
              </div>
            ))
          )}
        </div>

        {/* 輸入框 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && input.trim()) {
                sendMessage(deviceId, input.trim());
                setInput('');
              }
            }}
            placeholder="輸入訊息..."
            disabled={!deviceState.connected}
            className="flex-1 bg-dark-600 text-white placeholder-dark-400 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-mist-500/50 disabled:opacity-50"
          />
          <button
            onClick={() => {
              if (input.trim()) {
                sendMessage(deviceId, input.trim());
                setInput('');
              }
            }}
            disabled={!deviceState.connected || !input.trim()}
            className="px-4 py-2 bg-mist-600 hover:bg-mist-700 disabled:bg-dark-600 disabled:text-dark-400 text-white rounded-lg transition-colors"
          >
            發送
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg p-4">
      {/* 標題列 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">E2E 加密模擬器</h2>
          <p className="text-sm text-dark-400">
            測試 X3DH + Double Ratchet 端到端加密
            {cryptoVersion && <span className="ml-2 text-mist-400">v{cryptoVersion}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={initializeCrypto}
            disabled={isInitialized}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-dark-600 disabled:text-dark-400 text-white rounded-lg transition-colors text-sm"
          >
            {isInitialized ? '✅ 已初始化' : '1. 初始化 WASM'}
          </button>
          <button
            onClick={establishSession}
            disabled={!deviceAState.publicKey || !deviceBState.publicKey || deviceAState.connected}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-dark-600 disabled:text-dark-400 text-white rounded-lg transition-colors text-sm"
          >
            {deviceAState.connected ? '✅ 已建立' : '3. 建立 X3DH 會話'}
          </button>
          <button
            onClick={reset}
            className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg transition-colors text-sm"
          >
            重置
          </button>
        </div>
      </div>

      {/* 設備面板 */}
      <div className="flex gap-4 mb-4">
        {renderDevice(deviceAState, 'A', inputA, setInputA)}
        <div className="flex items-center">
          <div className="text-dark-500 text-2xl">⟷</div>
        </div>
        {renderDevice(deviceBState, 'B', inputB, setInputB)}
      </div>

      {/* 日誌面板 */}
      <div className="flex-1 bg-dark-card rounded-xl border border-dark-border overflow-hidden flex flex-col">
        <div className="px-4 py-2 border-b border-dark-border flex items-center justify-between">
          <h3 className="text-sm font-medium text-white">加密流程日誌</h3>
          <button
            onClick={() => setLogs([])}
            className="text-xs text-dark-400 hover:text-white transition-colors"
          >
            清除
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
          {logs.length === 0 ? (
            <p className="text-dark-500">點擊「初始化 WASM」開始測試...</p>
          ) : (
            logs.map((log, i) => (
              <div
                key={i}
                className={`py-0.5 ${
                  log.includes('✅')
                    ? 'text-green-400'
                    : log.includes('❌')
                    ? 'text-red-400'
                    : log.includes('🔐') || log.includes('🔓')
                    ? 'text-yellow-400'
                    : log.includes('📤') || log.includes('📡')
                    ? 'text-blue-400'
                    : log.includes('🔑') || log.includes('🤝')
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

      {/* 說明 */}
      <div className="mt-4 p-3 bg-dark-700/50 rounded-lg">
        <p className="text-xs text-dark-400">
          <strong className="text-dark-300">測試流程：</strong>
          {' '}1. 初始化 WASM → 2. 兩台設備產生身份 → 3. 建立 X3DH 會話 → 4. 互相發送加密訊息
        </p>
        <p className="text-xs text-dark-500 mt-1">
          使用 Rust WASM 執行真實的 X3DH 金鑰協商 + Double Ratchet 前向保密加密。每條訊息都使用不同的對稱金鑰。
        </p>
      </div>
    </div>
  );
}

export default E2ESimulator;
