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
import { initStorage, isInitialized as isStorageInitialized, startCleanupTask } from '@services/storage';
import { fromBase64, RatchetMessage } from '@services/crypto';
import { useChatStore } from '@stores/chatStore';

// 應用狀態
interface AppState {
  // Crypto
  cryptoReady: boolean;
  hasIdentity: boolean;
  publicKey: string | null;

  // Storage
  storageReady: boolean;

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
  // Crypto 金鑰 (用於 QR Code 產生)
  signedPreKey: {
    publicKeyBase64: string;
    signatureBase64: string;
  } | null;

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
  const [storageReady, setStorageReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peerMessageHandlers] = useState<Map<string, (data: ArrayBuffer | string) => void>>(new Map());

  // Crypto Hook
  const {
    initialized: cryptoReady,
    hasIdentity,
    publicKeyBase64: publicKey,
    signedPreKey,
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

  // 從 chatStore 取得 addFriend 方法
  const addFriend = useChatStore((state) => state.addFriend);
  const getFriendByPublicKey = useChatStore((state) => state.getFriendByPublicKey);

  // 初始化流程
  useEffect(() => {
    const init = async () => {
      try {
        setIsInitializing(true);
        setError(null);

        // 初始化本地儲存
        if (!isStorageInitialized()) {
          console.log('[AppProvider] Initializing storage...');
          await initStorage();
          startCleanupTask(); // 啟動過期訊息清理任務
          console.log('[AppProvider] Storage initialized');
        } else {
          console.log('[AppProvider] Storage already initialized');
        }
        // 無論是新初始化還是已存在，都設為 ready
        setStorageReady(true);

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

  // 從 chatStore 取得 receiveMessage 方法
  const receiveMessage = useChatStore((state) => state.receiveMessage);

  // 監聽 X3DH_INIT 訊息 - 接收端建立 session
  useEffect(() => {
    if (!mqtt.isConnected || !cryptoReady) return;

    console.log('[AppProvider] Setting up X3DH_INIT listener...');

    const unsubscribe = mqtt.subscribe(MessageType.X3DH_INIT, (message: MqttMessage) => {
      try {
        const senderPublicKeyBase64 = message.from;
        const payload = message.payload as {
          ephemeralPublicKey: string;
          senderName: string;
        };

        console.log('[AppProvider] Received X3DH_INIT from:', senderPublicKeyBase64.slice(0, 16) + '...');
        console.log('[AppProvider] Sender name:', payload.senderName);

        // 檢查是否已經是好友（已有 session）
        const existingFriend = getFriendByPublicKey(senderPublicKeyBase64);
        if (existingFriend) {
          console.log('[AppProvider] Already have this friend, updating session...');
        }

        // 將 Base64 轉換為 Uint8Array
        const senderIdentityPublic = fromBase64(senderPublicKeyBase64);
        const senderEphemeralPublic = fromBase64(payload.ephemeralPublicKey);

        // 建立接收端的 session
        acceptSession(senderIdentityPublic, senderEphemeralPublic);

        console.log('[AppProvider] Session created for:', senderPublicKeyBase64.slice(0, 16) + '...');

        // 如果不是好友，將發送者加入好友列表
        if (!existingFriend) {
          addFriend(senderPublicKeyBase64, payload.senderName, 'verified');
          console.log('[AppProvider] Added new friend:', payload.senderName);
        }
      } catch (err) {
        console.error('[AppProvider] Failed to process X3DH_INIT:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [mqtt.isConnected, mqtt.subscribe, cryptoReady, acceptSession, addFriend, getFriendByPublicKey]);

  // 全域監聽 ENCRYPTED_MESSAGE - 確保訊息在任何頁面都能接收
  useEffect(() => {
    if (!mqtt.isConnected || !cryptoReady) return;

    console.log('[AppProvider] Setting up global ENCRYPTED_MESSAGE listener...');

    const unsubscribe = mqtt.subscribe(MessageType.ENCRYPTED_MESSAGE, (message: MqttMessage) => {
      try {
        const senderPublicKeyBase64 = message.from;
        const payload = message.payload;

        console.log('[AppProvider] Received ENCRYPTED_MESSAGE from:', senderPublicKeyBase64.slice(0, 16) + '...');
        console.log('[AppProvider] Payload type:', typeof payload);
        console.log('[AppProvider] Payload preview:', typeof payload === 'string' ? payload.slice(0, 100) + '...' : JSON.stringify(payload).slice(0, 100));

        // 檢查發送者是否為好友
        const friend = getFriendByPublicKey(senderPublicKeyBase64);
        if (!friend) {
          console.log('[AppProvider] Message from unknown sender, ignoring');
          return;
        }

        // payload 是 JSON 字串 (來自 RatchetMessage.toJson())，需要先反序列化為 WASM 物件
        console.log('[AppProvider] Converting payload to RatchetMessage...');
        const ratchetMessage = RatchetMessage.fromJson(payload as string);
        console.log('[AppProvider] RatchetMessage created successfully');

        // 解密訊息
        console.log('[AppProvider] Attempting to decrypt...');
        const decrypted = decrypt(senderPublicKeyBase64, ratchetMessage);
        console.log('[AppProvider] Decryption successful!');
        const messageData = JSON.parse(decrypted) as {
          content: string;
          type: 'text' | 'image' | 'file';
          ttl?: number;
          timestamp?: number;
        };

        console.log('[AppProvider] Decrypted message from:', friend.name);

        // 建立訊息物件並儲存到 store
        const newMessage = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          senderId: friend.id,
          content: messageData.content,
          timestamp: messageData.timestamp || Date.now(),
          type: messageData.type,
          isRead: false,
          isBurned: false,
          ttl: messageData.ttl,
          encrypted: true,
        };

        receiveMessage(friend.id, newMessage);
        console.log('[AppProvider] Message saved to store');
      } catch (err) {
        console.error('[AppProvider] Failed to process ENCRYPTED_MESSAGE:', err);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [mqtt.isConnected, mqtt.subscribe, cryptoReady, decrypt, getFriendByPublicKey, receiveMessage]);

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
    storageReady,
    mqttConnected: mqtt.isConnected,
    activePeers,
    isInitializing,
    error,

    // Crypto 金鑰
    signedPreKey: signedPreKey ? {
      publicKeyBase64: signedPreKey.publicKeyBase64,
      signatureBase64: signedPreKey.signatureBase64,
    } : null,

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
