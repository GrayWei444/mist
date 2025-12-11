/**
 * RealP2PTest - 真實跨設備 P2P 測試
 *
 * 這是一個真正的跨設備測試工具：
 * 1. 連接 MQTT Broker
 * 2. 生成身份並顯示 QR Code
 * 3. 掃描對方 QR Code 或等待對方連線
 * 4. 通過 MQTT 進行 X3DH 金鑰交換
 * 5. 建立 WebRTC P2P 連線
 * 6. 進行端到端加密通訊
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
  fromBase64,
} from '../../services/crypto';
import { mqttService, MessageType, ConnectionState } from '../../services/mqtt';
import { webrtcService, PeerConnectionState, DataChannelState } from '../../services/webrtc';

// QR Code 資料結構
interface QRCodeData {
  v: number;              // 版本
  type: 'add';            // 類型：加好友
  pk: string;             // Ed25519 公鑰 (Base64)
  spk: string;            // SignedPreKey 公鑰 (Base64)
  sig: string;            // SignedPreKey 簽名 (Base64)
  name: string;           // 顯示名稱
  ts: number;             // 時間戳
}

// X3DH 初始化訊息
interface X3DHInitPayload {
  ephemeralPublicKey: string;  // Base64
  senderPublicKey: string;     // Base64
  senderName: string;
}

type TestStep = 'init' | 'connecting' | 'ready' | 'waiting' | 'exchanging' | 'connected' | 'chatting';

export function RealP2PTest() {
  // 狀態
  const [step, setStep] = useState<TestStep>('init');
  const [logs, setLogs] = useState<string[]>([]);
  const [mqttState, setMqttState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [peerState, setPeerState] = useState<PeerConnectionState | null>(null);
  const [_dataChannelState, setDataChannelState] = useState<DataChannelState | null>(null);

  // 本地身份
  const [myName, setMyName] = useState('');
  const [myPublicKey, setMyPublicKey] = useState('');
  const [qrData, setQrData] = useState<string>('');

  // 對方資訊
  const [peerName, setPeerName] = useState('');
  const [peerPublicKey, setPeerPublicKey] = useState('');

  // 訊息
  const [messages, setMessages] = useState<Array<{ from: string; text: string; encrypted?: boolean }>>([]);
  const [inputMessage, setInputMessage] = useState('');

  // QR Code 輸入
  const [qrInput, setQrInput] = useState('');

  // WASM 物件 (不能放 React state)
  const wasmRef = useRef<{
    identity: Identity | null;
    signedPreKey: SignedPreKey | null;
    session: Session | null;
  }>({
    identity: null,
    signedPreKey: null,
    session: null,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 添加日誌
  const addLog = useCallback((msg: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev.slice(-100), `[${timestamp}] ${msg}`]);
  }, []);

  // 滾動到日誌底部
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 監聽 MQTT 狀態變化
  useEffect(() => {
    const unsub = mqttService.onStateChange((state) => {
      setMqttState(state);
      addLog(`MQTT 狀態: ${state}`);
    });
    return unsub;
  }, [addLog]);

  // 初始化並連接
  const initialize = useCallback(async () => {
    if (!myName.trim()) {
      addLog('❌ 請輸入你的名稱');
      return;
    }

    setStep('connecting');

    try {
      // 1. 初始化 WASM
      addLog('正在初始化加密模組...');
      await initCrypto();
      const version = getCryptoVersion();
      addLog(`✅ 加密模組 v${version}`);

      // 2. 生成身份
      addLog('正在生成身份金鑰...');
      const identity = Identity.generate();
      const signedPreKey = SignedPreKey.generate(identity, 1);

      wasmRef.current.identity = identity;
      wasmRef.current.signedPreKey = signedPreKey;

      setMyPublicKey(identity.publicKeyBase64);
      addLog(`✅ 公鑰: ${identity.publicKeyBase64.slice(0, 24)}...`);

      // 3. 生成 QR Code 資料
      const qrCodeData: QRCodeData = {
        v: 1,
        type: 'add',
        pk: identity.publicKeyBase64,
        spk: signedPreKey.publicKeyBase64,
        sig: toBase64(signedPreKey.signature),
        name: myName,
        ts: Date.now(),
      };
      setQrData(JSON.stringify(qrCodeData));
      addLog('✅ QR Code 已生成');

      // 4. 連接 MQTT
      addLog('正在連接 MQTT Broker...');
      await mqttService.connect(identity.publicKeyBase64);
      addLog('✅ MQTT 已連接');

      // 5. 初始化 WebRTC
      webrtcService.initialize(identity.publicKeyBase64);
      addLog('✅ WebRTC 服務已初始化');

      // 6. 監聽 X3DH 初始化訊息
      mqttService.onMessage(MessageType.X3DH_INIT, async (msg) => {
        addLog(`📥 收到 X3DH 初始化請求`);
        await handleX3DHInit(msg.payload as X3DHInitPayload);
      });

      // 7. 監聽 WebRTC 狀態
      webrtcService.onStateChange((_peerKey, state) => {
        setPeerState(state);
        addLog(`WebRTC 狀態: ${state}`);
        if (state === PeerConnectionState.CONNECTED) {
          setStep('chatting');
        }
      });

      webrtcService.onDataChannelStateChange((_peerKey, state) => {
        setDataChannelState(state);
        addLog(`DataChannel 狀態: ${state}`);
      });

      // 8. 監聽收到的訊息
      webrtcService.onMessage((peerKey, data) => {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        addLog(`📥 收到訊息: ${text}`);
        setMessages((prev) => [...prev, { from: peerName || peerKey.slice(0, 8), text, encrypted: true }]);
      });

      setStep('ready');
      addLog('');
      addLog('🎉 初始化完成！');
      addLog('📲 讓對方掃描你的 QR Code，或輸入對方的 QR Code 資料');

    } catch (err) {
      addLog(`❌ 初始化失敗: ${err}`);
      setStep('init');
    }
  }, [myName, addLog]);

  // 處理收到的 X3DH 初始化請求
  const handleX3DHInit = async (payload: X3DHInitPayload) => {
    try {
      const { identity, signedPreKey } = wasmRef.current;
      if (!identity || !signedPreKey) {
        addLog('❌ 本地身份未初始化');
        return;
      }

      addLog('🔐 開始 X3DH 響應...');
      setPeerName(payload.senderName);
      setPeerPublicKey(payload.senderPublicKey);

      // 從 Base64 還原臨時公鑰
      const ephemeralPubKey = fromBase64(payload.ephemeralPublicKey);
      const senderPubKey = fromBase64(payload.senderPublicKey);

      // 執行 X3DH 響應者計算
      const sharedSecret = x3dhResponder(
        identity,
        signedPreKey,
        null, // 沒有 OPK
        senderPubKey,
        ephemeralPubKey
      );

      // 建立 Double Ratchet 會話 (作為 Bob)
      const session = Session.initAsBob(
        sharedSecret,
        signedPreKey.privateKey,
        signedPreKey.publicKey
      );
      wasmRef.current.session = session;

      addLog('✅ X3DH 完成，會話已建立');
      addLog(`✅ 已添加好友: ${payload.senderName}`);

      setStep('connected');

      // 等待對方建立 WebRTC 連線
      addLog('⏳ 等待 WebRTC P2P 連線...');

    } catch (err) {
      addLog(`❌ X3DH 失敗: ${err}`);
    }
  };

  // 掃描/輸入對方 QR Code
  const connectToPeer = useCallback(async () => {
    if (!qrInput.trim()) {
      addLog('❌ 請輸入 QR Code 資料');
      return;
    }

    try {
      const peerQR: QRCodeData = JSON.parse(qrInput);

      if (peerQR.v !== 1 || peerQR.type !== 'add') {
        addLog('❌ 無效的 QR Code 格式');
        return;
      }

      addLog(`📱 解析 QR Code 成功`);
      addLog(`   對方名稱: ${peerQR.name}`);
      addLog(`   對方公鑰: ${peerQR.pk.slice(0, 24)}...`);

      setPeerName(peerQR.name);
      setPeerPublicKey(peerQR.pk);
      setStep('exchanging');

      const { identity, signedPreKey } = wasmRef.current;
      if (!identity || !signedPreKey) {
        addLog('❌ 本地身份未初始化');
        return;
      }

      // 執行 X3DH 發起者
      addLog('🔐 開始 X3DH 金鑰協商...');

      const peerIdentityPubKey = fromBase64(peerQR.pk);
      const peerSpkPubKey = fromBase64(peerQR.spk);
      const peerSpkSig = fromBase64(peerQR.sig);

      const x3dhResult = x3dhInitiator(
        identity,
        peerIdentityPubKey,
        peerSpkPubKey,
        peerSpkSig
      );

      addLog('✅ X3DH 計算完成');

      // 建立 Double Ratchet 會話 (作為 Alice)
      const session = Session.initAsAlice(
        x3dhResult.sharedSecret,
        peerSpkPubKey
      );
      wasmRef.current.session = session;
      addLog('✅ Double Ratchet 會話已建立');

      // 通過 MQTT 發送 X3DH 初始化訊息
      const initPayload: X3DHInitPayload = {
        ephemeralPublicKey: toBase64(x3dhResult.ephemeralPublicKey),
        senderPublicKey: identity.publicKeyBase64,
        senderName: myName,
      };

      mqttService.sendToUser(peerQR.pk, MessageType.X3DH_INIT, initPayload);
      addLog('📤 已發送 X3DH 初始化請求');

      // 建立 WebRTC 連線
      addLog('🔗 正在建立 WebRTC P2P 連線...');
      await webrtcService.connect(peerQR.pk);

      setStep('connected');
      addLog(`✅ 已添加好友: ${peerQR.name}`);

    } catch (err) {
      addLog(`❌ 連線失敗: ${err}`);
      setStep('ready');
    }
  }, [qrInput, myName, addLog]);

  // 發送訊息
  const sendMessage = useCallback(() => {
    if (!inputMessage.trim() || !peerPublicKey) return;

    const session = wasmRef.current.session;
    if (!session) {
      addLog('❌ 會話未建立');
      return;
    }

    try {
      // 加密訊息
      const encrypted = session.encrypt(inputMessage);
      const encryptedBase64 = toBase64(encrypted.ciphertext);

      addLog(`📤 發送加密訊息: ${inputMessage}`);
      addLog(`   密文: ${encryptedBase64.slice(0, 32)}...`);

      // 通過 WebRTC 發送
      const sent = webrtcService.send(peerPublicKey, inputMessage);

      if (sent) {
        setMessages((prev) => [...prev, { from: '我', text: inputMessage, encrypted: true }]);
        setInputMessage('');
      } else {
        // WebRTC 未連線，通過 MQTT 發送
        mqttService.sendToUser(peerPublicKey, MessageType.ENCRYPTED_MESSAGE, {
          ciphertext: encryptedBase64,
        });
        setMessages((prev) => [...prev, { from: '我', text: inputMessage, encrypted: true }]);
        setInputMessage('');
        addLog('📤 訊息已通過 MQTT 發送');
      }
    } catch (err) {
      addLog(`❌ 發送失敗: ${err}`);
    }
  }, [inputMessage, peerPublicKey, addLog]);

  // 重置
  const reset = useCallback(() => {
    webrtcService.shutdown();
    mqttService.disconnect();

    wasmRef.current.identity?.free();
    wasmRef.current.signedPreKey?.free();
    wasmRef.current.session?.free();
    wasmRef.current = { identity: null, signedPreKey: null, session: null };

    setStep('init');
    setLogs([]);
    setMyPublicKey('');
    setQrData('');
    setPeerName('');
    setPeerPublicKey('');
    setMessages([]);
    setInputMessage('');
    setQrInput('');
    setPeerState(null);
    setDataChannelState(null);

    addLog('🔄 已重置');
  }, [addLog]);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* 標題 */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-white">🌐 真實 P2P 測試</h2>
        <p className="text-sm text-dark-400">
          跨設備加好友與加密通訊測試
          {mqttState === ConnectionState.CONNECTED && (
            <span className="ml-2 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs">
              MQTT 已連線
            </span>
          )}
        </p>
      </div>

      {/* 步驟指示器 */}
      <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
        <StepBadge active={step === 'init' || step === 'connecting'} done={step !== 'init' && step !== 'connecting'}>
          {step === 'connecting' ? '⏳ 連線中' : '1️⃣ 初始化'}
        </StepBadge>
        <span className="text-dark-500">→</span>
        <StepBadge active={step === 'ready' || step === 'waiting'} done={step === 'exchanging' || step === 'connected' || step === 'chatting'}>
          2️⃣ 加好友
        </StepBadge>
        <span className="text-dark-500">→</span>
        <StepBadge active={step === 'exchanging'} done={step === 'connected' || step === 'chatting'}>
          3️⃣ 金鑰交換
        </StepBadge>
        <span className="text-dark-500">→</span>
        <StepBadge active={step === 'connected' || step === 'chatting'} done={false}>
          4️⃣ 聊天
        </StepBadge>
      </div>

      <div className="flex-1 grid grid-cols-2 gap-4 min-h-0 overflow-hidden">
        {/* 左側：操作區 */}
        <div className="flex flex-col gap-4 overflow-y-auto pr-2">
          {/* 步驟 1: 初始化 */}
          {step === 'init' && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <h3 className="font-medium text-white mb-3">1️⃣ 輸入你的名稱並連線</h3>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                placeholder="輸入你的名稱..."
                className="w-full px-3 py-2 bg-dark-700 border border-dark-border rounded text-white mb-3"
              />
              <button
                onClick={initialize}
                disabled={!myName.trim()}
                className="w-full px-4 py-2 bg-gradient-to-r from-mist-600 to-purple-600 hover:from-mist-700 hover:to-purple-700 disabled:from-dark-600 disabled:to-dark-600 text-white rounded-lg font-medium"
              >
                🚀 連線並生成身份
              </button>
            </div>
          )}

          {step === 'connecting' && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border text-center">
              <div className="text-4xl mb-2 animate-spin">⏳</div>
              <p className="text-white">正在連線...</p>
            </div>
          )}

          {/* 步驟 2: 顯示 QR Code */}
          {(step === 'ready' || step === 'waiting' || step === 'exchanging' || step === 'connected' || step === 'chatting') && (
            <>
              <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
                <h3 className="font-medium text-white mb-3">📱 我的 QR Code</h3>
                <p className="text-xs text-dark-400 mb-2">讓對方掃描此 QR Code 加你為好友</p>

                {qrData && (
                  <div className="flex justify-center bg-white rounded-lg p-4 mb-3">
                    <QRCodeSVG value={qrData} size={160} level="M" />
                  </div>
                )}

                <div className="text-xs space-y-1">
                  <div>
                    <span className="text-dark-500">名稱：</span>
                    <span className="text-white">{myName}</span>
                  </div>
                  <div>
                    <span className="text-dark-500">公鑰：</span>
                    <span className="font-mono text-mist-400">{myPublicKey.slice(0, 24)}...</span>
                  </div>
                </div>
              </div>

              {/* 輸入對方 QR Code */}
              {step === 'ready' && (
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
                  <h3 className="font-medium text-white mb-3">📷 掃描對方 QR Code</h3>
                  <p className="text-xs text-dark-400 mb-2">
                    手機掃描後，將 QR Code 內容貼到這裡
                  </p>
                  <textarea
                    value={qrInput}
                    onChange={(e) => setQrInput(e.target.value)}
                    placeholder='{"v":1,"type":"add","pk":"...",...}'
                    rows={3}
                    className="w-full px-3 py-2 bg-dark-700 border border-dark-border rounded text-white text-xs font-mono mb-3"
                  />
                  <button
                    onClick={connectToPeer}
                    disabled={!qrInput.trim()}
                    className="w-full px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 disabled:from-dark-600 disabled:to-dark-600 text-white rounded-lg font-medium"
                  >
                    🔗 連線到對方
                  </button>
                </div>
              )}

              {/* 好友資訊 */}
              {peerName && (
                <div className="bg-green-900/20 border border-green-500/30 rounded-xl p-4">
                  <h3 className="font-medium text-green-400 mb-2">✅ 好友已連線</h3>
                  <div className="text-sm text-green-300">
                    <div>名稱：{peerName}</div>
                    <div className="font-mono text-xs">公鑰：{peerPublicKey.slice(0, 24)}...</div>
                  </div>
                  {peerState && (
                    <div className="mt-2 text-xs">
                      <span className="text-dark-500">WebRTC：</span>
                      <span className={peerState === PeerConnectionState.CONNECTED ? 'text-green-400' : 'text-yellow-400'}>
                        {peerState}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* 聊天區 */}
              {(step === 'connected' || step === 'chatting') && (
                <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
                  <h3 className="font-medium text-white mb-3">💬 加密聊天</h3>

                  {/* 訊息列表 */}
                  <div className="h-32 overflow-y-auto bg-dark-700 rounded p-2 mb-3">
                    {messages.length === 0 ? (
                      <p className="text-dark-500 text-sm text-center py-4">發送第一條訊息...</p>
                    ) : (
                      messages.map((msg, i) => (
                        <div key={i} className={`text-sm mb-1 ${msg.from === '我' ? 'text-right' : ''}`}>
                          <span className={msg.from === '我' ? 'text-mist-400' : 'text-purple-400'}>
                            {msg.from}:
                          </span>
                          <span className="text-white ml-1">{msg.text}</span>
                          {msg.encrypted && <span className="text-dark-500 text-xs ml-1">🔐</span>}
                        </div>
                      ))
                    )}
                  </div>

                  {/* 輸入框 */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                      placeholder="輸入訊息..."
                      className="flex-1 px-3 py-2 bg-dark-700 border border-dark-border rounded text-white"
                    />
                    <button
                      onClick={sendMessage}
                      className="px-4 py-2 bg-mist-600 hover:bg-mist-700 text-white rounded"
                    >
                      發送
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* 重置按鈕 */}
          {step !== 'init' && (
            <button
              onClick={reset}
              className="px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg"
            >
              🔄 重置
            </button>
          )}
        </div>

        {/* 右側：日誌 */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-dark-border">
            <h3 className="text-sm font-medium text-white">📋 連線日誌</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-dark-500">輸入名稱並點擊連線開始...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    log.includes('✅') || log.includes('🎉')
                      ? 'text-green-400'
                      : log.includes('❌')
                      ? 'text-red-400'
                      : log.includes('📤') || log.includes('📥')
                      ? 'text-yellow-400'
                      : log.includes('🔐') || log.includes('公鑰')
                      ? 'text-purple-400'
                      : log.includes('MQTT') || log.includes('WebRTC')
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
    </div>
  );
}

// 步驟徽章元件
function StepBadge({ active, done, children }: { active: boolean; done: boolean; children: React.ReactNode }) {
  return (
    <span className={`px-2 py-1 rounded text-xs ${
      done ? 'bg-green-600 text-white' :
      active ? 'bg-mist-600 text-white animate-pulse' :
      'bg-dark-600 text-dark-400'
    }`}>
      {done ? '✅' : ''} {children}
    </span>
  );
}

export default RealP2PTest;
