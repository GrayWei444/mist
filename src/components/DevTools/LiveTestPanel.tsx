/**
 * LiveTestPanel - 真實 P2P 測試面板
 *
 * 使用真實的 MQTT 和 WebRTC 進行跨設備測試：
 * 1. 連接 MQTT Broker
 * 2. 產生身份並顯示 QR Code
 * 3. 等待對方掃描或手動輸入對方公鑰
 * 4. 透過 MQTT 進行 X3DH 金鑰交換
 * 5. 建立 WebRTC P2P 連線
 * 6. 進行端對端加密通訊
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
import { useChatStore } from '../../stores/chatStore';

// QR Code 資料結構
interface QRCodeData {
  v: number;              // 版本
  pk: string;             // Ed25519 公鑰 (Base64)
  spk: string;            // SignedPreKey 公鑰 (Base64)
  sig: string;            // SignedPreKey 簽名 (Base64)
  name: string;           // 顯示名稱
}

// X3DH 初始化訊息
interface X3DHInitPayload {
  ephemeralPublicKey: string;  // Base64
  senderName: string;
}

// WASM 物件存儲
interface WasmState {
  identity: Identity | null;
  signedPreKey: SignedPreKey | null;
  session: Session | null;
}

type TestStep = 'init' | 'connecting' | 'ready' | 'exchanging' | 'connected';

interface LiveTestPanelProps {
  onEnterChat?: () => void;
}

export function LiveTestPanel({ onEnterChat }: LiveTestPanelProps) {
  const { addFriend } = useChatStore();

  // 狀態
  const [step, setStep] = useState<TestStep>('init');
  const [logs, setLogs] = useState<string[]>([]);
  const [mqttState, setMqttState] = useState<ConnectionState>(ConnectionState.DISCONNECTED);
  const [peerState, setPeerState] = useState<PeerConnectionState | null>(null);
  const [dataChannelState, setDataChannelState] = useState<DataChannelState | null>(null);
  const [cryptoVersion, setCryptoVersion] = useState('');

  // 本地身份
  const [myName, setMyName] = useState('我的設備');
  const [_myPublicKey, setMyPublicKey] = useState('');
  const [qrData, setQrData] = useState<string>('');

  // 對方資訊
  const [peerName, setPeerName] = useState('');
  const [peerPublicKey, setPeerPublicKey] = useState('');

  // 訊息
  const [messages, setMessages] = useState<Array<{ from: string; text: string; time: string }>>([]);
  const [inputMessage, setInputMessage] = useState('');

  // 手動輸入對方 QR Code 資料
  const [qrInput, setQrInput] = useState('');

  // WASM 物件 (不能放 React state)
  const wasmRef = useRef<WasmState>({
    identity: null,
    signedPreKey: null,
    session: null,
  });

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 添加日誌
  const addLog = useCallback((msg: string) => {
    const time = new Date().toLocaleTimeString('zh-TW', { hour12: false });
    setLogs(prev => [...prev.slice(-100), `[${time}] ${msg}`]);
  }, []);

  // 自動滾動日誌
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // 處理收到的 X3DH 初始化請求
  const handleX3DHInit = useCallback(async (payload: X3DHInitPayload, fromKey: string) => {
    if (!wasmRef.current.identity || !wasmRef.current.signedPreKey) {
      addLog('❌ 本地身份未初始化');
      return;
    }

    addLog(`📥 收到 X3DH 請求來自: ${payload.senderName}`);
    setPeerPublicKey(fromKey);
    setPeerName(payload.senderName);
    setStep('exchanging');

    try {
      // 作為接收者執行 X3DH
      const ephemeralPubKey = fromBase64(payload.ephemeralPublicKey);
      const senderPubKey = fromBase64(fromKey);

      const sharedSecret = x3dhResponder(
        wasmRef.current.identity,
        wasmRef.current.signedPreKey,
        null,
        senderPubKey,
        ephemeralPubKey
      );

      // 建立 Double Ratchet 會話 (作為 Bob)
      const session = Session.initAsBob(
        sharedSecret,
        wasmRef.current.signedPreKey.privateKey,
        wasmRef.current.signedPreKey.publicKey,
        ephemeralPubKey
      );
      wasmRef.current.session = session;

      addLog('✅ X3DH 金鑰協商完成');
      addLog('✅ Double Ratchet 會話已建立');

      // 將對方加入好友列表
      addFriend(fromKey, payload.senderName, 'verified');
      addLog(`👥 已將 ${payload.senderName} 加入好友`);

      // 發起 WebRTC 連線
      addLog('🔗 正在建立 WebRTC 連線...');
      await webrtcService.connect(fromKey);

      setStep('connected');
    } catch (err) {
      addLog(`❌ X3DH 失敗: ${err}`);
      setStep('ready');
    }
  }, [addLog, addFriend]);

  // 初始化：連接 MQTT 並產生身份
  const initialize = useCallback(async () => {
    if (step !== 'init') return;
    setStep('connecting');

    try {
      // 1. 初始化加密模組
      addLog('正在初始化加密模組...');
      await initCrypto();
      const version = getCryptoVersion();
      setCryptoVersion(version);
      addLog(`✅ 加密模組已載入 (v${version})`);

      // 2. 產生身份
      addLog('正在產生身份金鑰...');
      const identity = Identity.generate();
      const signedPreKey = SignedPreKey.generate(identity, 1);
      wasmRef.current.identity = identity;
      wasmRef.current.signedPreKey = signedPreKey;

      const pubKey = identity.publicKeyBase64;
      setMyPublicKey(pubKey);
      addLog(`📱 公鑰: ${pubKey.slice(0, 20)}...`);

      // 3. 產生 QR Code 資料
      const qr: QRCodeData = {
        v: 1,
        pk: pubKey,
        spk: signedPreKey.publicKeyBase64,
        sig: toBase64(signedPreKey.signature),
        name: myName,
      };
      setQrData(JSON.stringify(qr));

      // 4. 連接 MQTT
      addLog('正在連接 MQTT Broker...');
      addLog('   wss://mqtt.alwaysbefound.com');

      mqttService.onStateChange((state) => {
        setMqttState(state);
        addLog(`MQTT 狀態: ${state}`);
      });

      await mqttService.connect(pubKey);
      addLog('✅ MQTT 已連接');

      // 5. 初始化 WebRTC 服務
      webrtcService.initialize(pubKey);

      // 6. 監聽 X3DH 初始化訊息
      mqttService.onMessage(MessageType.X3DH_INIT, async (msg) => {
        await handleX3DHInit(msg.payload as X3DHInitPayload, msg.from);
      });

      // 7. 監聽 WebRTC 狀態
      webrtcService.onStateChange((_peerKey, state) => {
        setPeerState(state);
        addLog(`WebRTC 狀態: ${state}`);
        if (state === PeerConnectionState.CONNECTED) {
          addLog('🎉 P2P 連線建立成功！');
          setStep('connected');
        }
      });

      webrtcService.onDataChannelStateChange((_peerKey, state) => {
        setDataChannelState(state);
        addLog(`DataChannel: ${state}`);
      });

      // 8. 監聯收到的訊息
      webrtcService.onMessage((_peerKey, data) => {
        const text = typeof data === 'string' ? data : new TextDecoder().decode(data);
        addLog(`📥 收到: ${text}`);
        const time = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        setMessages(prev => [...prev, { from: peerName || '對方', text, time }]);
      });

      setStep('ready');
      addLog('');
      addLog('✅ 準備就緒！');
      addLog('💡 請用另一台設備掃描 QR Code');
      addLog('   或在下方輸入對方的 QR Code 資料');

    } catch (err) {
      addLog(`❌ 初始化失敗: ${err}`);
      setStep('init');
    }
  }, [step, myName, addLog, handleX3DHInit, peerName]);

  // 處理掃描到的 QR Code
  const handleQrCodeScanned = useCallback(async (qrText: string) => {
    if (!wasmRef.current.identity) {
      addLog('❌ 請先初始化');
      return;
    }

    try {
      const peerQr: QRCodeData = JSON.parse(qrText);
      setPeerPublicKey(peerQr.pk);
      setPeerName(peerQr.name);
      setStep('exchanging');

      addLog(`📷 掃描到: ${peerQr.name}`);
      addLog(`   公鑰: ${peerQr.pk.slice(0, 20)}...`);

      // 執行 X3DH (作為發起者)
      addLog('🔐 開始 X3DH 金鑰協商...');

      const peerIdentityPubKey = fromBase64(peerQr.pk);
      const peerSignedPreKeyPub = fromBase64(peerQr.spk);
      const peerSignature = fromBase64(peerQr.sig);

      const x3dhResult = x3dhInitiator(
        wasmRef.current.identity,
        peerIdentityPubKey,
        peerSignedPreKeyPub,
        peerSignature
      );

      addLog('✅ X3DH 產生共享密鑰');

      // 建立 Double Ratchet 會話 (作為 Alice，使用 X3DH 臨時金鑰對)
      const session = Session.initAsAlice(
        x3dhResult.sharedSecret,
        peerSignedPreKeyPub,
        x3dhResult.ephemeralPrivateKey,
        x3dhResult.ephemeralPublicKey
      );
      wasmRef.current.session = session;
      addLog('✅ Double Ratchet 會話已建立');

      // 透過 MQTT 發送 X3DH 初始化訊息
      const initPayload: X3DHInitPayload = {
        ephemeralPublicKey: toBase64(x3dhResult.ephemeralPublicKey),
        senderName: myName,
      };
      mqttService.sendToUser(peerQr.pk, MessageType.X3DH_INIT, initPayload);
      addLog('📤 已發送 X3DH 初始化訊息');

      // 將對方加入好友列表
      addFriend(peerQr.pk, peerQr.name, 'verified');
      addLog(`👥 已將 ${peerQr.name} 加入好友`);

      // 等待對方建立 WebRTC 連線
      addLog('⏳ 等待對方建立 WebRTC 連線...');

    } catch (err) {
      addLog(`❌ 連線失敗: ${err}`);
      setStep('ready');
    }
  }, [myName, addLog, addFriend]);

  // 手動輸入連接
  const connectToPeer = useCallback(() => {
    if (!qrInput.trim()) {
      addLog('❌ 請輸入對方的 QR Code 資料');
      return;
    }
    handleQrCodeScanned(qrInput);
  }, [qrInput, addLog, handleQrCodeScanned]);

  // 發送訊息
  const sendMessage = useCallback(() => {
    if (!inputMessage.trim() || !peerPublicKey) return;

    const text = inputMessage.trim();

    // 透過 WebRTC 發送
    const success = webrtcService.send(peerPublicKey, text);

    if (success) {
      addLog(`📤 發送: ${text}`);
      const time = new Date().toLocaleTimeString('zh-TW', { hour12: false });
      setMessages(prev => [...prev, { from: '我', text, time }]);
      setInputMessage('');
    } else {
      addLog('❌ 發送失敗，連線可能已斷開');
    }
  }, [inputMessage, peerPublicKey, addLog]);

  // 重置
  const reset = useCallback(() => {
    // 斷開連線
    mqttService.disconnect();
    webrtcService.shutdown();

    // 釋放 WASM
    wasmRef.current.identity?.free();
    wasmRef.current.signedPreKey?.free();
    wasmRef.current.session?.free();
    wasmRef.current = { identity: null, signedPreKey: null, session: null };

    // 重置狀態
    setStep('init');
    setLogs([]);
    setMqttState(ConnectionState.DISCONNECTED);
    setPeerState(null);
    setDataChannelState(null);
    setMyPublicKey('');
    setQrData('');
    setPeerPublicKey('');
    setPeerName('');
    setMessages([]);
    setQrInput('');

    addLog('🔄 已重置');
  }, [addLog]);

  return (
    <div className="h-full flex flex-col p-4 overflow-hidden">
      {/* 標題 */}
      <div className="mb-3">
        <h2 className="text-lg font-semibold text-white">跨設備 P2P 測試</h2>
        <p className="text-sm text-dark-400">
          使用真實 MQTT + WebRTC
          {cryptoVersion && <span className="ml-2 text-mist-400">v{cryptoVersion}</span>}
        </p>
      </div>

      {/* 連線狀態 */}
      <div className="flex items-center gap-2 mb-3 text-xs">
        <span className={`px-2 py-1 rounded ${
          mqttState === ConnectionState.CONNECTED ? 'bg-green-600' :
          mqttState === ConnectionState.CONNECTING ? 'bg-yellow-600' : 'bg-dark-600'
        } text-white`}>
          MQTT: {mqttState}
        </span>
        {peerState && (
          <span className={`px-2 py-1 rounded ${
            peerState === PeerConnectionState.CONNECTED ? 'bg-green-600' :
            peerState === PeerConnectionState.CONNECTING ? 'bg-yellow-600' : 'bg-dark-600'
          } text-white`}>
            WebRTC: {peerState}
          </span>
        )}
        {dataChannelState && (
          <span className={`px-2 py-1 rounded ${
            dataChannelState === DataChannelState.OPEN ? 'bg-green-600' : 'bg-dark-600'
          } text-white`}>
            DC: {dataChannelState}
          </span>
        )}
      </div>

      {/* 主要內容 */}
      <div className="flex-1 grid grid-cols-2 gap-3 min-h-0 overflow-hidden">
        {/* 左側：QR Code 和操作 */}
        <div className="flex flex-col gap-3 overflow-y-auto pr-1">
          {/* 設備名稱 */}
          {step === 'init' && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <label className="text-sm text-dark-400">設備名稱</label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                className="w-full mt-1 px-3 py-2 bg-dark-700 border border-dark-border rounded text-white"
                placeholder="我的設備"
              />
            </div>
          )}

          {/* QR Code */}
          {qrData && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <h3 className="font-medium text-white mb-3">我的 QR Code</h3>
              <div className="flex justify-center bg-white rounded-lg p-3">
                <QRCodeSVG value={qrData} size={140} level="M" />
              </div>
              <p className="text-xs text-dark-400 text-center mt-2">
                讓對方掃描此 QR Code
              </p>
            </div>
          )}

          {/* 輸入對方 QR Code */}
          {step === 'ready' && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border">
              <h3 className="font-medium text-white mb-2">連接對方</h3>
              <textarea
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-border rounded text-white text-xs font-mono h-20"
                placeholder='貼上對方的 QR Code 資料 (JSON 格式)'
              />
              <button
                onClick={connectToPeer}
                className="w-full mt-2 px-4 py-2 bg-gradient-to-r from-green-600 to-teal-600 text-white rounded-lg text-sm"
              >
                📷 連接
              </button>
            </div>
          )}

          {/* 聊天區域 */}
          {step === 'connected' && (
            <div className="bg-dark-card rounded-xl p-4 border border-dark-border flex flex-col">
              <h3 className="font-medium text-white mb-2">💬 與 {peerName || '對方'} 對話</h3>
              <div className="flex-1 min-h-[100px] max-h-[200px] overflow-y-auto bg-dark-700 rounded p-2 mb-2">
                {messages.length === 0 ? (
                  <p className="text-xs text-dark-400">還沒有訊息...</p>
                ) : (
                  messages.map((msg, i) => (
                    <div key={i} className={`text-xs mb-1 ${msg.from === '我' ? 'text-mist-400' : 'text-green-400'}`}>
                      <span className="text-dark-500">[{msg.time}]</span> {msg.from}: {msg.text}
                    </div>
                  ))
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  className="flex-1 px-3 py-2 bg-dark-700 border border-dark-border rounded text-white text-sm"
                  placeholder="輸入訊息..."
                />
                <button
                  onClick={sendMessage}
                  className="px-4 py-2 bg-mist-600 hover:bg-mist-700 text-white rounded text-sm"
                >
                  發送
                </button>
              </div>
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="space-y-2">
            {step === 'init' && (
              <button
                onClick={initialize}
                className="w-full px-4 py-3 bg-gradient-to-r from-mist-600 to-purple-600 text-white rounded-lg text-sm font-medium"
              >
                🚀 連接 MQTT 並產生身份
              </button>
            )}

            {step === 'connecting' && (
              <div className="w-full px-4 py-3 bg-yellow-900/30 border border-yellow-500/30 text-yellow-300 rounded-lg text-sm text-center">
                <span className="animate-pulse">⏳ 正在連接...</span>
              </div>
            )}

            {step === 'exchanging' && (
              <div className="w-full px-4 py-3 bg-purple-900/30 border border-purple-500/30 text-purple-300 rounded-lg text-sm text-center">
                <span className="animate-pulse">🔐 正在進行金鑰交換...</span>
              </div>
            )}

            {step === 'connected' && onEnterChat && (
              <button
                onClick={onEnterChat}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-mist-600 text-white rounded-lg text-sm font-medium"
              >
                💬 進入聊天室
              </button>
            )}

            <button
              onClick={reset}
              className="w-full px-4 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg text-sm"
            >
              🔄 重置
            </button>
          </div>
        </div>

        {/* 右側：日誌 */}
        <div className="bg-dark-card rounded-xl border border-dark-border overflow-hidden flex flex-col">
          <div className="px-4 py-2 border-b border-dark-border">
            <h3 className="text-sm font-medium text-white">📋 連線日誌</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-dark-500">點擊「連接 MQTT」開始...</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`py-0.5 ${
                    log.includes('✅') || log.includes('🎉') ? 'text-green-400' :
                    log.includes('❌') ? 'text-red-400' :
                    log.includes('📥') || log.includes('📤') ? 'text-yellow-400' :
                    log.includes('🔐') || log.includes('X3DH') ? 'text-purple-400' :
                    log.includes('💡') ? 'text-mist-400' :
                    'text-dark-300'
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
          <strong>使用方式：</strong>
          在兩台設備上開啟此頁面 → 其中一台掃描另一台的 QR Code → 自動建立加密 P2P 連線
        </p>
      </div>
    </div>
  );
}

export default LiveTestPanel;
