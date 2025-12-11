/**
 * WebRTC Service - P2P 連線管理
 *
 * 透過 WebRTC 建立端對端加密的 P2P 連線
 * 使用 MQTT 作為信令通道
 */

import { mqttService, MessageType, type MqttMessage } from './mqtt';

// ICE 伺服器設定
// 連線優先順序：IPv6 直連 → STUN 打洞 → TURN 中繼（最後手段）
const ICE_SERVERS: RTCIceServer[] = [
  // 1. 自架 STUN（優先使用，Coturn 同時支援 STUN）
  { urls: 'stun:31.97.71.140:3478' },
  // 2. 公共 STUN 備用
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  // 3. TURN 中繼（最後手段，有頻寬成本）
  {
    urls: 'turn:31.97.71.140:3478',
    username: 'mist',
    credential: 'mist_turn_2024',
  },
  {
    urls: 'turns:31.97.71.140:5349',
    username: 'mist',
    credential: 'mist_turn_2024',
  },
];

// ICE 連線類型（用於監控）
export enum IceCandidateType {
  HOST = 'host',       // 直連（IPv4/IPv6）
  SRFLX = 'srflx',     // STUN 反射
  PRFLX = 'prflx',     // Peer 反射
  RELAY = 'relay',     // TURN 中繼
}

// 連線狀態
export enum PeerConnectionState {
  NEW = 'new',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  FAILED = 'failed',
  CLOSED = 'closed',
}

// 資料通道狀態
export enum DataChannelState {
  CONNECTING = 'connecting',
  OPEN = 'open',
  CLOSING = 'closing',
  CLOSED = 'closed',
}

// Peer 連線資訊
export interface PeerInfo {
  publicKeyBase64: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  connectionState: PeerConnectionState;
  dataChannelState: DataChannelState;
  isInitiator: boolean;
}

// 訊息回調
type MessageCallback = (peerPublicKey: string, data: ArrayBuffer | string) => void;
type StateCallback = (peerPublicKey: string, state: PeerConnectionState) => void;
type DataChannelStateCallback = (peerPublicKey: string, state: DataChannelState) => void;

/**
 * WebRTC P2P 連線服務
 */
class WebRTCService {
  private peers: Map<string, PeerInfo> = new Map();
  private localPublicKeyBase64: string | null = null;

  // 事件監聽器
  private messageListeners: Set<MessageCallback> = new Set();
  private stateListeners: Set<StateCallback> = new Set();
  private dataChannelStateListeners: Set<DataChannelStateCallback> = new Set();

  // MQTT 訂閱取消函式
  private mqttUnsubscribes: (() => void)[] = [];

  /**
   * 初始化 WebRTC 服務
   */
  initialize(localPublicKeyBase64: string): void {
    this.localPublicKeyBase64 = localPublicKeyBase64;

    // 訂閱 MQTT 信令訊息
    this.mqttUnsubscribes.push(
      mqttService.onMessage(MessageType.WEBRTC_OFFER, (msg) => this.handleOffer(msg)),
      mqttService.onMessage(MessageType.WEBRTC_ANSWER, (msg) => this.handleAnswer(msg)),
      mqttService.onMessage(MessageType.WEBRTC_ICE, (msg) => this.handleIceCandidate(msg))
    );

    console.log('[WebRTC] Service initialized');
  }

  /**
   * 關閉服務
   */
  shutdown(): void {
    // 取消 MQTT 訂閱
    this.mqttUnsubscribes.forEach((unsub) => unsub());
    this.mqttUnsubscribes = [];

    // 關閉所有連線
    this.peers.forEach((peer) => {
      peer.dataChannel?.close();
      peer.connection.close();
    });
    this.peers.clear();

    this.localPublicKeyBase64 = null;
    console.log('[WebRTC] Service shut down');
  }

  /**
   * 發起連線到指定 Peer
   */
  async connect(remotePublicKeyBase64: string): Promise<void> {
    if (!this.localPublicKeyBase64) {
      throw new Error('WebRTC service not initialized');
    }

    if (this.peers.has(remotePublicKeyBase64)) {
      console.warn(`[WebRTC] Already connected or connecting to ${remotePublicKeyBase64.slice(0, 8)}...`);
      return;
    }

    console.log(`[WebRTC] Initiating connection to ${remotePublicKeyBase64.slice(0, 8)}...`);

    // 建立 RTCPeerConnection
    const connection = this.createPeerConnection(remotePublicKeyBase64, true);

    // 建立資料通道
    const dataChannel = connection.createDataChannel('mist', {
      ordered: true,
    });
    this.setupDataChannel(dataChannel, remotePublicKeyBase64);

    // 儲存 Peer 資訊
    this.peers.set(remotePublicKeyBase64, {
      publicKeyBase64: remotePublicKeyBase64,
      connection,
      dataChannel,
      connectionState: PeerConnectionState.CONNECTING,
      dataChannelState: DataChannelState.CONNECTING,
      isInitiator: true,
    });

    // 建立 Offer
    try {
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);

      // 透過 MQTT 發送 Offer
      mqttService.sendOffer(remotePublicKeyBase64, offer);
      console.log(`[WebRTC] Sent offer to ${remotePublicKeyBase64.slice(0, 8)}...`);
    } catch (error) {
      console.error('[WebRTC] Failed to create offer:', error);
      this.closePeer(remotePublicKeyBase64);
      throw error;
    }
  }

  /**
   * 斷開與指定 Peer 的連線
   */
  disconnect(remotePublicKeyBase64: string): void {
    this.closePeer(remotePublicKeyBase64);
  }

  /**
   * 發送資料到指定 Peer
   */
  send(remotePublicKeyBase64: string, data: ArrayBuffer | string): boolean {
    const peer = this.peers.get(remotePublicKeyBase64);
    if (!peer || !peer.dataChannel || peer.dataChannel.readyState !== 'open') {
      console.warn(`[WebRTC] Cannot send to ${remotePublicKeyBase64.slice(0, 8)}...: channel not open`);
      return false;
    }

    try {
      if (typeof data === 'string') {
        peer.dataChannel.send(data);
      } else {
        peer.dataChannel.send(data);
      }
      return true;
    } catch (error) {
      console.error('[WebRTC] Failed to send:', error);
      return false;
    }
  }

  /**
   * 廣播資料到所有已連線的 Peers
   */
  broadcast(data: ArrayBuffer | string): void {
    this.peers.forEach((peer, key) => {
      if (peer.dataChannel?.readyState === 'open') {
        this.send(key, data);
      }
    });
  }

  /**
   * 取得所有已連線的 Peers
   */
  getConnectedPeers(): string[] {
    return Array.from(this.peers.entries())
      .filter(([_, peer]) => peer.connectionState === PeerConnectionState.CONNECTED)
      .map(([key]) => key);
  }

  /**
   * 取得 Peer 連線狀態
   */
  getPeerState(remotePublicKeyBase64: string): PeerConnectionState | null {
    return this.peers.get(remotePublicKeyBase64)?.connectionState ?? null;
  }

  /**
   * 監聽收到的訊息
   */
  onMessage(callback: MessageCallback): () => void {
    this.messageListeners.add(callback);
    return () => this.messageListeners.delete(callback);
  }

  /**
   * 監聯連線狀態變化
   */
  onStateChange(callback: StateCallback): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  /**
   * 監聽資料通道狀態變化
   */
  onDataChannelStateChange(callback: DataChannelStateCallback): () => void {
    this.dataChannelStateListeners.add(callback);
    return () => this.dataChannelStateListeners.delete(callback);
  }

  // ============================================
  // Private Methods
  // ============================================

  /**
   * 建立 RTCPeerConnection
   */
  private createPeerConnection(remotePublicKeyBase64: string, isInitiator: boolean): RTCPeerConnection {
    const connection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10,
    });

    // ICE Candidate 事件
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        mqttService.sendIceCandidate(remotePublicKeyBase64, event.candidate);
      }
    };

    // ICE 連線狀態變化
    connection.oniceconnectionstatechange = () => {
      const state = this.mapIceConnectionState(connection.iceConnectionState);
      this.updatePeerState(remotePublicKeyBase64, state);

      // 連線成功時，記錄使用的連線類型
      if (connection.iceConnectionState === 'connected' || connection.iceConnectionState === 'completed') {
        this.logConnectionType(connection, remotePublicKeyBase64);
      }
    };

    // 連線狀態變化
    connection.onconnectionstatechange = () => {
      const state = this.mapConnectionState(connection.connectionState);
      this.updatePeerState(remotePublicKeyBase64, state);
    };

    // 接收資料通道 (非發起者)
    if (!isInitiator) {
      connection.ondatachannel = (event) => {
        const peer = this.peers.get(remotePublicKeyBase64);
        if (peer) {
          peer.dataChannel = event.channel;
          this.setupDataChannel(event.channel, remotePublicKeyBase64);
        }
      };
    }

    return connection;
  }

  /**
   * 設定資料通道事件處理
   */
  private setupDataChannel(channel: RTCDataChannel, remotePublicKeyBase64: string): void {
    channel.binaryType = 'arraybuffer';

    channel.onopen = () => {
      console.log(`[WebRTC] Data channel opened with ${remotePublicKeyBase64.slice(0, 8)}...`);
      this.updateDataChannelState(remotePublicKeyBase64, DataChannelState.OPEN);
    };

    channel.onclose = () => {
      console.log(`[WebRTC] Data channel closed with ${remotePublicKeyBase64.slice(0, 8)}...`);
      this.updateDataChannelState(remotePublicKeyBase64, DataChannelState.CLOSED);
    };

    channel.onerror = (error) => {
      console.error(`[WebRTC] Data channel error with ${remotePublicKeyBase64.slice(0, 8)}...:`, error);
    };

    channel.onmessage = (event) => {
      this.messageListeners.forEach((callback) => {
        callback(remotePublicKeyBase64, event.data);
      });
    };
  }

  /**
   * 處理收到的 Offer
   */
  private async handleOffer(msg: MqttMessage): Promise<void> {
    const remotePublicKeyBase64 = msg.from;
    const offer = msg.payload as RTCSessionDescriptionInit;

    console.log(`[WebRTC] Received offer from ${remotePublicKeyBase64.slice(0, 8)}...`);

    // 如果已經有連線，先關閉
    if (this.peers.has(remotePublicKeyBase64)) {
      this.closePeer(remotePublicKeyBase64);
    }

    // 建立 RTCPeerConnection
    const connection = this.createPeerConnection(remotePublicKeyBase64, false);

    // 儲存 Peer 資訊
    this.peers.set(remotePublicKeyBase64, {
      publicKeyBase64: remotePublicKeyBase64,
      connection,
      dataChannel: null,
      connectionState: PeerConnectionState.CONNECTING,
      dataChannelState: DataChannelState.CONNECTING,
      isInitiator: false,
    });

    try {
      // 設定遠端描述
      await connection.setRemoteDescription(new RTCSessionDescription(offer));

      // 建立 Answer
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      // 透過 MQTT 發送 Answer
      mqttService.sendAnswer(remotePublicKeyBase64, answer);
      console.log(`[WebRTC] Sent answer to ${remotePublicKeyBase64.slice(0, 8)}...`);
    } catch (error) {
      console.error('[WebRTC] Failed to handle offer:', error);
      this.closePeer(remotePublicKeyBase64);
    }
  }

  /**
   * 處理收到的 Answer
   */
  private async handleAnswer(msg: MqttMessage): Promise<void> {
    const remotePublicKeyBase64 = msg.from;
    const answer = msg.payload as RTCSessionDescriptionInit;

    console.log(`[WebRTC] Received answer from ${remotePublicKeyBase64.slice(0, 8)}...`);

    const peer = this.peers.get(remotePublicKeyBase64);
    if (!peer) {
      console.warn(`[WebRTC] No pending connection for ${remotePublicKeyBase64.slice(0, 8)}...`);
      return;
    }

    try {
      await peer.connection.setRemoteDescription(new RTCSessionDescription(answer));
    } catch (error) {
      console.error('[WebRTC] Failed to set remote description:', error);
      this.closePeer(remotePublicKeyBase64);
    }
  }

  /**
   * 處理收到的 ICE Candidate
   */
  private async handleIceCandidate(msg: MqttMessage): Promise<void> {
    const remotePublicKeyBase64 = msg.from;
    const candidate = msg.payload as RTCIceCandidateInit;

    const peer = this.peers.get(remotePublicKeyBase64);
    if (!peer) {
      console.warn(`[WebRTC] No connection for ICE candidate from ${remotePublicKeyBase64.slice(0, 8)}...`);
      return;
    }

    try {
      await peer.connection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('[WebRTC] Failed to add ICE candidate:', error);
    }
  }

  /**
   * 關閉 Peer 連線
   */
  private closePeer(remotePublicKeyBase64: string): void {
    const peer = this.peers.get(remotePublicKeyBase64);
    if (peer) {
      peer.dataChannel?.close();
      peer.connection.close();
      this.peers.delete(remotePublicKeyBase64);
      this.updatePeerState(remotePublicKeyBase64, PeerConnectionState.CLOSED);
      console.log(`[WebRTC] Closed connection with ${remotePublicKeyBase64.slice(0, 8)}...`);
    }
  }

  /**
   * 更新 Peer 連線狀態
   */
  private updatePeerState(remotePublicKeyBase64: string, state: PeerConnectionState): void {
    const peer = this.peers.get(remotePublicKeyBase64);
    if (peer) {
      peer.connectionState = state;
    }
    this.stateListeners.forEach((callback) => callback(remotePublicKeyBase64, state));
  }

  /**
   * 更新資料通道狀態
   */
  private updateDataChannelState(remotePublicKeyBase64: string, state: DataChannelState): void {
    const peer = this.peers.get(remotePublicKeyBase64);
    if (peer) {
      peer.dataChannelState = state;
    }
    this.dataChannelStateListeners.forEach((callback) => callback(remotePublicKeyBase64, state));
  }

  /**
   * 映射 ICE 連線狀態
   */
  private mapIceConnectionState(state: RTCIceConnectionState): PeerConnectionState {
    switch (state) {
      case 'new':
        return PeerConnectionState.NEW;
      case 'checking':
        return PeerConnectionState.CONNECTING;
      case 'connected':
      case 'completed':
        return PeerConnectionState.CONNECTED;
      case 'disconnected':
        return PeerConnectionState.DISCONNECTED;
      case 'failed':
        return PeerConnectionState.FAILED;
      case 'closed':
        return PeerConnectionState.CLOSED;
      default:
        return PeerConnectionState.NEW;
    }
  }

  /**
   * 映射連線狀態
   */
  private mapConnectionState(state: RTCPeerConnectionState): PeerConnectionState {
    switch (state) {
      case 'new':
        return PeerConnectionState.NEW;
      case 'connecting':
        return PeerConnectionState.CONNECTING;
      case 'connected':
        return PeerConnectionState.CONNECTED;
      case 'disconnected':
        return PeerConnectionState.DISCONNECTED;
      case 'failed':
        return PeerConnectionState.FAILED;
      case 'closed':
        return PeerConnectionState.CLOSED;
      default:
        return PeerConnectionState.NEW;
    }
  }

  /**
   * 記錄連線類型（用於監控 P2P 連線品質）
   * - host: IPv4/IPv6 直連（最佳）
   * - srflx: STUN 反射（NAT 打洞）
   * - prflx: Peer 反射
   * - relay: TURN 中繼（最後手段）
   */
  private async logConnectionType(connection: RTCPeerConnection, peerKey: string): Promise<void> {
    try {
      const stats = await connection.getStats();
      let candidateType = 'unknown';
      let localAddress = '';
      let remoteAddress = '';

      stats.forEach((report) => {
        if (report.type === 'candidate-pair' && report.state === 'succeeded') {
          const localId = report.localCandidateId;
          const remoteId = report.remoteCandidateId;

          stats.forEach((candidate) => {
            if (candidate.id === localId) {
              candidateType = candidate.candidateType || 'unknown';
              localAddress = `${candidate.address}:${candidate.port}`;
            }
            if (candidate.id === remoteId) {
              remoteAddress = `${candidate.address}:${candidate.port}`;
            }
          });
        }
      });

      // 根據連線類型顯示不同的標記
      const typeEmoji = {
        host: '🟢 直連',
        srflx: '🟡 STUN',
        prflx: '🟡 Peer反射',
        relay: '🔴 TURN中繼',
        unknown: '⚪ 未知',
      }[candidateType] || '⚪ 未知';

      console.log(
        `[WebRTC] ${typeEmoji} | ${peerKey.slice(0, 8)}... | ${localAddress} ↔ ${remoteAddress}`
      );

      // 如果使用 TURN，發出警告
      if (candidateType === 'relay') {
        console.warn('[WebRTC] ⚠️ 使用 TURN 中繼，將消耗伺服器頻寬');
      }
    } catch (error) {
      console.error('[WebRTC] Failed to get connection stats:', error);
    }
  }
}

// 單例導出
export const webrtcService = new WebRTCService();

export default webrtcService;
