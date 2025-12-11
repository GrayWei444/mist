/**
 * AppProvider - 應用程式服務提供者
 *
 * 整合 Crypto、MQTT、WebRTC 等核心服務的初始化與狀態管理
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useCrypto } from '@hooks/useCrypto';
import { useMqtt } from '@hooks/useMqtt';
import { useWebRTC } from '@hooks/useWebRTC';
import { MessageType, type MqttMessage } from '@services/mqtt';

// 應用狀態
interface AppState {
  // Crypto
  cryptoReady: boolean;
  hasIdentity: boolean;
  publicKey: string | null;

  // MQTT
  mqttConnected: boolean;

  // WebRTC
  activePeers: string[];

  // 整體狀態
  isInitializing: boolean;
  error: string | null;
}

// Context 值
interface AppContextValue extends AppState {
  // Crypto 操作
  generateIdentity: () => string;
  getPreKeyBundle: () => string | null;

  // MQTT 操作
  connectMqtt: () => Promise<void>;
  disconnectMqtt: () => void;
  sendToUser: (recipientPublicKey: string, type: MessageType, payload: unknown) => void;
  subscribeMessage: (type: MessageType | '*', callback: (message: MqttMessage) => void) => () => void;

  // WebRTC 操作
  connectPeer: (remotePublicKey: string) => Promise<void>;
  sendToPeer: (remotePublicKey: string, data: string | ArrayBuffer) => boolean;
  disconnectPeer: (remotePublicKey: string) => void;
  isConnectedTo: (remotePublicKey: string) => boolean;

  // 加解密操作
  encryptMessage: (recipientPublicKey: string, plaintext: string) => unknown;
  decryptMessage: (senderPublicKey: string, ciphertext: unknown) => string;

  // 會話管理
  createSession: (
    recipientIdentityPublic: Uint8Array,
    recipientSignedPrekeyPublic: Uint8Array,
    recipientSignedPrekeySignature: Uint8Array,
    recipientOneTimePrekeyPublic?: Uint8Array,
    recipientOneTimePrekeyId?: number
  ) => { session: unknown; x3dhResult: { sharedSecret: Uint8Array; ephemeralPublicKey: Uint8Array; usedOneTimePrekeyId?: number } };
  acceptSession: (
    senderIdentityPublic: Uint8Array,
    senderEphemeralPublic: Uint8Array,
    usedOneTimePrekeyId?: number
  ) => unknown;
}

const AppContext = createContext<AppContextValue | null>(null);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [peerMessageHandlers] = useState<Map<string, (data: ArrayBuffer | string) => void>>(new Map());

  // Crypto Hook
  const {
    initialized: cryptoReady,
    hasIdentity,
    publicKeyBase64: publicKey,
    generateIdentity,
    getPreKeyBundle,
    encrypt,
    decrypt,
    acceptSession,
    createSession,
  } = useCrypto();

  // MQTT Hook - 需要 publicKey 參數
  const mqtt = useMqtt(publicKey, { autoConnect: false, isDev: false });

  // WebRTC 訊息處理
  const handleWebRTCMessage = useCallback((peerPublicKey: string, data: ArrayBuffer | string) => {
    console.log(`[AppProvider] WebRTC message from: ${peerPublicKey.slice(0, 8)}...`);
    const handler = peerMessageHandlers.get(peerPublicKey);
    if (handler) {
      handler(data);
    }
  }, [peerMessageHandlers]);

  // WebRTC Hook - 需要 localPublicKey 參數
  const webrtc = useWebRTC(publicKey, {
    onMessage: handleWebRTCMessage,
    onPeerConnected: (peerPublicKey) => {
      console.log(`[AppProvider] Peer connected: ${peerPublicKey.slice(0, 8)}...`);
    },
    onPeerDisconnected: (peerPublicKey) => {
      console.log(`[AppProvider] Peer disconnected: ${peerPublicKey.slice(0, 8)}...`);
      peerMessageHandlers.delete(peerPublicKey);
    },
  });

  // 初始化流程
  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // 等待 Crypto 初始化
        if (!cryptoReady) {
          return; // 等待 useCrypto 自動初始化
        }

        // 如果沒有身份，自動產生
        if (!hasIdentity) {
          console.log('[AppProvider] Generating new identity...');
          generateIdentity();
          return; // 等待身份產生後重新進入
        }

        // 連線 MQTT
        if (publicKey && !mqtt.isConnected) {
          console.log('[AppProvider] Connecting to MQTT...');
          await mqtt.connect();
        }

        setIsInitializing(false);
        console.log('[AppProvider] Initialization complete');
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Initialization failed';
        setError(errorMsg);
        setIsInitializing(false);
        console.error('[AppProvider] Init error:', err);
      }
    };

    init();
  }, [cryptoReady, hasIdentity, publicKey, mqtt.isConnected, generateIdentity, mqtt.connect]);

  // MQTT 連線
  const connectMqtt = useCallback(async () => {
    try {
      await mqtt.connect();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'MQTT connection failed';
      setError(errorMsg);
    }
  }, [mqtt]);

  // 發送訊息給用戶
  const sendToUser = useCallback(
    (recipientPublicKey: string, type: MessageType, payload: unknown) => {
      mqtt.sendToUser(recipientPublicKey, type, payload);
    },
    [mqtt]
  );

  // 訂閱訊息
  const subscribeMessage = useCallback(
    (type: MessageType | '*', callback: (message: MqttMessage) => void) => {
      return mqtt.subscribe(type, callback);
    },
    [mqtt]
  );

  // WebRTC 連線
  const connectPeer = useCallback(
    async (remotePublicKey: string) => {
      if (!publicKey) {
        throw new Error('Identity not initialized');
      }
      await webrtc.connect(remotePublicKey);
    },
    [publicKey, webrtc]
  );

  // 發送到對等端
  const sendToPeer = useCallback(
    (remotePublicKey: string, data: string | ArrayBuffer) => {
      return webrtc.send(remotePublicKey, data);
    },
    [webrtc]
  );

  // 檢查是否已連線
  const isConnectedTo = useCallback(
    (remotePublicKey: string) => {
      return webrtc.isConnectedTo(remotePublicKey);
    },
    [webrtc]
  );

  // 加密訊息
  const encryptMessage = useCallback(
    (recipientPublicKey: string, plaintext: string) => {
      return encrypt(recipientPublicKey, plaintext);
    },
    [encrypt]
  );

  // 解密訊息
  const decryptMessage = useCallback(
    (senderPublicKey: string, ciphertext: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return decrypt(senderPublicKey, ciphertext as any);
    },
    [decrypt]
  );

  // 取得已連線的 peers 公鑰列表
  const activePeers = webrtc.connectedPeers.map((p) => p.publicKeyBase64);

  const value: AppContextValue = {
    // 狀態
    cryptoReady,
    hasIdentity,
    publicKey,
    mqttConnected: mqtt.isConnected,
    activePeers,
    isInitializing,
    error,

    // Crypto 操作
    generateIdentity,
    getPreKeyBundle,

    // MQTT 操作
    connectMqtt,
    disconnectMqtt: mqtt.disconnect,
    sendToUser,
    subscribeMessage,

    // WebRTC 操作
    connectPeer,
    sendToPeer,
    disconnectPeer: webrtc.disconnect,
    isConnectedTo,

    // 加解密
    encryptMessage,
    decryptMessage,

    // 會話管理
    createSession,
    acceptSession,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

/**
 * 使用 App Context 的 Hook
 */
export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}

export default AppProvider;
