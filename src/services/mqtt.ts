/**
 * MQTT Service - WebSocket 信令連線
 *
 * 透過 MQTT over WebSocket 進行信令交換
 * 用於 WebRTC 連線建立、PreKeyBundle 交換等
 */

import mqtt, { MqttClient, IClientOptions } from 'mqtt';

/**
 * 將 Base64 轉換為 URL 安全格式（用於 MQTT 主題）
 * Base64 的 + 和 / 在 MQTT 中是特殊字符
 */
function toUrlSafeBase64(base64: string): string {
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

// MQTT 設定
const MQTT_CONFIG = {
  // 生產環境 - 自有 VPS (Caddy 反向代理)
  broker: 'wss://mqtt.alwaysbefound.com/mqtt',
  // 開發環境 (本地 EMQX)
  devBroker: 'ws://localhost:8083/mqtt',
  // 重連設定
  reconnectPeriod: 3000,
  connectTimeout: 15000,
  keepalive: 60,
};

// 訊息類型
export enum MessageType {
  // 金鑰交換
  PRE_KEY_BUNDLE = 'prekey_bundle',
  X3DH_INIT = 'x3dh_init',
  // WebRTC 信令
  WEBRTC_OFFER = 'webrtc_offer',
  WEBRTC_ANSWER = 'webrtc_answer',
  WEBRTC_ICE = 'webrtc_ice',
  // 加密訊息
  ENCRYPTED_MESSAGE = 'encrypted_message',
  // 控制訊息
  PING = 'ping',
  PONG = 'pong',
  PRESENCE = 'presence',
  TYPING = 'typing',
}

// 訊息結構
export interface MqttMessage {
  type: MessageType;
  from: string; // 發送者公鑰 (Base64)
  to?: string; // 接收者公鑰 (Base64)，廣播時為空
  payload: unknown;
  timestamp: number;
  signature?: string; // 訊息簽章
}

// 訂閱主題
export interface TopicConfig {
  // 個人收件箱：接收直接發送給自己的訊息
  inbox: string;
  // 廣播頻道：接收 PreKeyBundle 等廣播訊息
  broadcast: string;
  // 群組頻道
  group: (groupId: string) => string;
}

// 連線狀態
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
}

// 事件回調
type MessageCallback = (message: MqttMessage) => void;
type StateCallback = (state: ConnectionState) => void;

/**
 * MQTT 服務類別
 */
class MqttService {
  private client: MqttClient | null = null;
  private publicKeyBase64: string | null = null;
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  // 事件監聽器
  private messageListeners: Map<MessageType, Set<MessageCallback>> = new Map();
  private stateListeners: Set<StateCallback> = new Set();

  /**
   * 取得主題設定
   */
  private getTopics(): TopicConfig {
    if (!this.publicKeyBase64) {
      throw new Error('Not connected');
    }
    // 使用 URL 安全的 Base64 作為主題名稱
    const safeKey = toUrlSafeBase64(this.publicKeyBase64);
    return {
      inbox: `mist/user/${safeKey}/inbox`,
      broadcast: 'mist/broadcast',
      group: (groupId: string) => `mist/group/${groupId}`,
    };
  }

  /**
   * 連線到 MQTT Broker
   */
  async connect(publicKeyBase64: string, isDev = false): Promise<void> {
    if (this.client?.connected) {
      console.warn('[MQTT] Already connected');
      return;
    }

    this.publicKeyBase64 = publicKeyBase64;
    this.setState(ConnectionState.CONNECTING);

    const broker = isDev ? MQTT_CONFIG.devBroker : MQTT_CONFIG.broker;

    const options: IClientOptions = {
      clientId: `mist_${publicKeyBase64.slice(0, 8)}_${Date.now()}`,
      clean: true,
      reconnectPeriod: MQTT_CONFIG.reconnectPeriod,
      connectTimeout: MQTT_CONFIG.connectTimeout,
      keepalive: MQTT_CONFIG.keepalive,
      // 使用公鑰作為 username（未來可加入簽章驗證）
      username: publicKeyBase64,
      // 協定版本
      protocolVersion: 5,
    };

    return new Promise((resolve, reject) => {
      console.log(`[MQTT] Connecting to ${broker}...`);
      this.client = mqtt.connect(broker, options);

      this.client.on('connect', () => {
        console.log('[MQTT] Connected');
        this.setState(ConnectionState.CONNECTED);
        this.subscribeToDefaultTopics();
        resolve();
      });

      this.client.on('reconnect', () => {
        console.log('[MQTT] Reconnecting...');
        this.setState(ConnectionState.RECONNECTING);
      });

      this.client.on('close', () => {
        console.log('[MQTT] Connection closed');
        this.setState(ConnectionState.DISCONNECTED);
      });

      this.client.on('error', (error) => {
        console.error('[MQTT] Error:', error);
        this.setState(ConnectionState.ERROR);
        reject(error);
      });

      this.client.on('message', (topic, payload) => {
        this.handleMessage(topic, payload);
      });

      // 連線超時
      setTimeout(() => {
        if (this.state === ConnectionState.CONNECTING) {
          reject(new Error('Connection timeout'));
        }
      }, MQTT_CONFIG.connectTimeout);
    });
  }

  /**
   * 斷開連線
   */
  disconnect(): void {
    if (this.client) {
      this.client.end(true);
      this.client = null;
      this.publicKeyBase64 = null;
      this.setState(ConnectionState.DISCONNECTED);
      console.log('[MQTT] Disconnected');
    }
  }

  /**
   * 訂閱預設主題
   */
  private subscribeToDefaultTopics(): void {
    if (!this.client) return;

    const topics = this.getTopics();

    // 訂閱個人收件箱
    this.client.subscribe(topics.inbox, { qos: 1 }, (err) => {
      if (err) {
        console.error('[MQTT] Failed to subscribe to inbox:', err);
      } else {
        console.log('[MQTT] Subscribed to inbox');
      }
    });

    // 訂閱廣播頻道
    this.client.subscribe(topics.broadcast, { qos: 0 }, (err) => {
      if (err) {
        console.error('[MQTT] Failed to subscribe to broadcast:', err);
      } else {
        console.log('[MQTT] Subscribed to broadcast');
      }
    });
  }

  /**
   * 訂閱群組頻道
   */
  subscribeToGroup(groupId: string): void {
    if (!this.client) {
      throw new Error('Not connected');
    }

    const topic = this.getTopics().group(groupId);
    this.client.subscribe(topic, { qos: 1 }, (err) => {
      if (err) {
        console.error(`[MQTT] Failed to subscribe to group ${groupId}:`, err);
      } else {
        console.log(`[MQTT] Subscribed to group ${groupId}`);
      }
    });
  }

  /**
   * 取消訂閱群組頻道
   */
  unsubscribeFromGroup(groupId: string): void {
    if (!this.client) return;

    const topic = this.getTopics().group(groupId);
    this.client.unsubscribe(topic);
    console.log(`[MQTT] Unsubscribed from group ${groupId}`);
  }

  /**
   * 發送訊息到指定用戶
   */
  sendToUser(
    recipientPublicKeyBase64: string,
    type: MessageType,
    payload: unknown
  ): void {
    if (!this.client || !this.publicKeyBase64) {
      throw new Error('Not connected');
    }

    // 將接收者公鑰轉換為 URL 安全格式用於主題
    const safeRecipientKey = toUrlSafeBase64(recipientPublicKeyBase64);
    const topic = `mist/user/${safeRecipientKey}/inbox`;
    const message: MqttMessage = {
      type,
      from: this.publicKeyBase64,  // 保持原始格式用於識別
      to: recipientPublicKeyBase64,
      payload,
      timestamp: Date.now(),
    };

    this.client.publish(topic, JSON.stringify(message), { qos: 1 });
  }

  /**
   * 廣播訊息
   */
  broadcast(type: MessageType, payload: unknown): void {
    if (!this.client || !this.publicKeyBase64) {
      throw new Error('Not connected');
    }

    const message: MqttMessage = {
      type,
      from: this.publicKeyBase64,
      payload,
      timestamp: Date.now(),
    };

    this.client.publish(this.getTopics().broadcast, JSON.stringify(message), {
      qos: 0,
    });
  }

  /**
   * 發送訊息到群組
   */
  sendToGroup(groupId: string, type: MessageType, payload: unknown): void {
    if (!this.client || !this.publicKeyBase64) {
      throw new Error('Not connected');
    }

    const topic = this.getTopics().group(groupId);
    const message: MqttMessage = {
      type,
      from: this.publicKeyBase64,
      payload,
      timestamp: Date.now(),
    };

    this.client.publish(topic, JSON.stringify(message), { qos: 1 });
  }

  /**
   * 處理收到的訊息
   */
  private handleMessage(_topic: string, payload: Buffer): void {
    try {
      const message: MqttMessage = JSON.parse(payload.toString());

      // 忽略自己發送的訊息
      if (message.from === this.publicKeyBase64) {
        return;
      }

      console.log(`[MQTT] Received ${message.type} from ${message.from.slice(0, 8)}...`);

      // 通知監聽器
      const listeners = this.messageListeners.get(message.type);
      if (listeners) {
        listeners.forEach((callback) => callback(message));
      }

      // 通知全局監聽器
      const allListeners = this.messageListeners.get('*' as MessageType);
      if (allListeners) {
        allListeners.forEach((callback) => callback(message));
      }
    } catch (error) {
      console.error('[MQTT] Failed to parse message:', error);
    }
  }

  /**
   * 設定連線狀態
   */
  private setState(state: ConnectionState): void {
    this.state = state;
    this.stateListeners.forEach((callback) => callback(state));
  }

  /**
   * 取得當前連線狀態
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * 監聽特定類型的訊息
   */
  onMessage(type: MessageType | '*', callback: MessageCallback): () => void {
    const typeKey = type as MessageType;
    if (!this.messageListeners.has(typeKey)) {
      this.messageListeners.set(typeKey, new Set());
    }
    this.messageListeners.get(typeKey)!.add(callback);

    // 返回取消監聽的函式
    return () => {
      this.messageListeners.get(typeKey)?.delete(callback);
    };
  }

  /**
   * 監聽連線狀態變化
   */
  onStateChange(callback: StateCallback): () => void {
    this.stateListeners.add(callback);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  /**
   * 發送 WebRTC Offer
   */
  sendOffer(recipientPublicKeyBase64: string, offer: RTCSessionDescriptionInit): void {
    this.sendToUser(recipientPublicKeyBase64, MessageType.WEBRTC_OFFER, offer);
  }

  /**
   * 發送 WebRTC Answer
   */
  sendAnswer(recipientPublicKeyBase64: string, answer: RTCSessionDescriptionInit): void {
    this.sendToUser(recipientPublicKeyBase64, MessageType.WEBRTC_ANSWER, answer);
  }

  /**
   * 發送 ICE Candidate
   */
  sendIceCandidate(recipientPublicKeyBase64: string, candidate: RTCIceCandidate): void {
    this.sendToUser(recipientPublicKeyBase64, MessageType.WEBRTC_ICE, candidate);
  }

  /**
   * 廣播 PreKeyBundle
   */
  broadcastPreKeyBundle(bundle: string): void {
    this.broadcast(MessageType.PRE_KEY_BUNDLE, { bundle });
  }

  /**
   * 發送 X3DH 初始訊息
   */
  sendX3DHInit(recipientPublicKeyBase64: string, initMessage: string): void {
    this.sendToUser(recipientPublicKeyBase64, MessageType.X3DH_INIT, {
      initMessage,
    });
  }

  /**
   * 發送在線狀態
   */
  broadcastPresence(isOnline: boolean): void {
    this.broadcast(MessageType.PRESENCE, { online: isOnline });
  }

  /**
   * 發送正在輸入狀態
   */
  sendTyping(recipientPublicKeyBase64: string, isTyping: boolean): void {
    this.sendToUser(recipientPublicKeyBase64, MessageType.TYPING, {
      typing: isTyping,
    });
  }
}

// 單例導出
export const mqttService = new MqttService();

export default mqttService;
