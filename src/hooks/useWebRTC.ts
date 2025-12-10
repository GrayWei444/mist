/**
 * useWebRTC Hook - WebRTC P2P 連線 React Hook
 *
 * 提供 WebRTC 連線的 React 整合
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  webrtcService,
  PeerConnectionState,
  DataChannelState,
} from '@services/webrtc';

interface PeerState {
  publicKeyBase64: string;
  connectionState: PeerConnectionState;
  dataChannelState: DataChannelState;
}

interface UseWebRTCOptions {
  onMessage?: (peerPublicKey: string, data: ArrayBuffer | string) => void;
  onPeerConnected?: (peerPublicKey: string) => void;
  onPeerDisconnected?: (peerPublicKey: string) => void;
}

/**
 * WebRTC P2P 連線 Hook
 */
export function useWebRTC(
  localPublicKeyBase64: string | null,
  options: UseWebRTCOptions = {}
) {
  const { onMessage, onPeerConnected, onPeerDisconnected } = options;

  const [peers, setPeers] = useState<Map<string, PeerState>>(new Map());
  const [isInitialized, setIsInitialized] = useState(false);

  const cleanupRef = useRef<(() => void)[]>([]);

  /**
   * 初始化 WebRTC 服務
   */
  useEffect(() => {
    if (!localPublicKeyBase64) return;

    webrtcService.initialize(localPublicKeyBase64);
    setIsInitialized(true);

    // 監聽連線狀態變化
    const unsubState = webrtcService.onStateChange((peerPublicKey, state) => {
      setPeers((prev) => {
        const newPeers = new Map(prev);
        const existing = newPeers.get(peerPublicKey);

        if (state === PeerConnectionState.CLOSED) {
          newPeers.delete(peerPublicKey);
        } else {
          newPeers.set(peerPublicKey, {
            publicKeyBase64: peerPublicKey,
            connectionState: state,
            dataChannelState: existing?.dataChannelState ?? DataChannelState.CONNECTING,
          });
        }

        return newPeers;
      });

      // 觸發回調
      if (state === PeerConnectionState.CONNECTED) {
        onPeerConnected?.(peerPublicKey);
      } else if (
        state === PeerConnectionState.DISCONNECTED ||
        state === PeerConnectionState.CLOSED ||
        state === PeerConnectionState.FAILED
      ) {
        onPeerDisconnected?.(peerPublicKey);
      }
    });

    // 監聽資料通道狀態變化
    const unsubChannel = webrtcService.onDataChannelStateChange(
      (peerPublicKey, state) => {
        setPeers((prev) => {
          const newPeers = new Map(prev);
          const existing = newPeers.get(peerPublicKey);
          if (existing) {
            newPeers.set(peerPublicKey, {
              ...existing,
              dataChannelState: state,
            });
          }
          return newPeers;
        });
      }
    );

    // 監聽訊息
    const unsubMessage = webrtcService.onMessage((peerPublicKey, data) => {
      onMessage?.(peerPublicKey, data);
    });

    cleanupRef.current = [unsubState, unsubChannel, unsubMessage];

    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
      webrtcService.shutdown();
      setIsInitialized(false);
    };
  }, [localPublicKeyBase64, onMessage, onPeerConnected, onPeerDisconnected]);

  /**
   * 連線到指定 Peer
   */
  const connect = useCallback(async (remotePublicKeyBase64: string) => {
    if (!isInitialized) {
      throw new Error('WebRTC not initialized');
    }
    await webrtcService.connect(remotePublicKeyBase64);
  }, [isInitialized]);

  /**
   * 斷開與指定 Peer 的連線
   */
  const disconnect = useCallback((remotePublicKeyBase64: string) => {
    webrtcService.disconnect(remotePublicKeyBase64);
  }, []);

  /**
   * 發送資料到指定 Peer
   */
  const send = useCallback(
    (remotePublicKeyBase64: string, data: ArrayBuffer | string): boolean => {
      return webrtcService.send(remotePublicKeyBase64, data);
    },
    []
  );

  /**
   * 廣播資料到所有已連線的 Peers
   */
  const broadcast = useCallback((data: ArrayBuffer | string) => {
    webrtcService.broadcast(data);
  }, []);

  /**
   * 取得已連線的 Peers
   */
  const connectedPeers = Array.from(peers.values()).filter(
    (peer) => peer.connectionState === PeerConnectionState.CONNECTED
  );

  /**
   * 檢查是否與指定 Peer 連線
   */
  const isConnectedTo = useCallback(
    (remotePublicKeyBase64: string): boolean => {
      const peer = peers.get(remotePublicKeyBase64);
      return peer?.connectionState === PeerConnectionState.CONNECTED;
    },
    [peers]
  );

  /**
   * 取得指定 Peer 的狀態
   */
  const getPeerState = useCallback(
    (remotePublicKeyBase64: string): PeerState | null => {
      return peers.get(remotePublicKeyBase64) ?? null;
    },
    [peers]
  );

  return {
    // 狀態
    isInitialized,
    peers: Array.from(peers.values()),
    connectedPeers,

    // 連線控制
    connect,
    disconnect,

    // 資料傳輸
    send,
    broadcast,

    // 查詢
    isConnectedTo,
    getPeerState,
  };
}

export default useWebRTC;
