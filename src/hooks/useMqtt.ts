/**
 * useMqtt Hook - MQTT 連線 React Hook
 *
 * 提供 MQTT 連線的 React 整合
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  mqttService,
  ConnectionState,
  MessageType,
  type MqttMessage,
} from '@services/mqtt';

interface MqttHookState {
  connectionState: ConnectionState;
  isConnected: boolean;
  error: Error | null;
}

interface UseMqttOptions {
  autoConnect?: boolean;
  isDev?: boolean;
}

/**
 * MQTT 連線 Hook
 */
export function useMqtt(publicKeyBase64: string | null, options: UseMqttOptions = {}) {
  const { autoConnect = false, isDev = false } = options;

  const [state, setState] = useState<MqttHookState>({
    connectionState: ConnectionState.DISCONNECTED,
    isConnected: false,
    error: null,
  });

  const cleanupRef = useRef<(() => void)[]>([]);

  /**
   * 連線
   */
  const connect = useCallback(async () => {
    if (!publicKeyBase64) {
      setState((s) => ({
        ...s,
        error: new Error('No public key provided'),
      }));
      return;
    }

    try {
      setState((s) => ({ ...s, error: null }));
      await mqttService.connect(publicKeyBase64, isDev);
    } catch (error) {
      setState((s) => ({
        ...s,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, [publicKeyBase64, isDev]);

  /**
   * 斷開連線
   */
  const disconnect = useCallback(() => {
    mqttService.disconnect();
  }, []);

  /**
   * 訂閱訊息
   */
  const subscribe = useCallback(
    (type: MessageType | '*', callback: (message: MqttMessage) => void) => {
      const unsub = mqttService.onMessage(type, callback);
      cleanupRef.current.push(unsub);
      return unsub;
    },
    []
  );

  /**
   * 發送訊息給用戶
   */
  const sendToUser = useCallback(
    (recipientPublicKeyBase64: string, type: MessageType, payload: unknown) => {
      mqttService.sendToUser(recipientPublicKeyBase64, type, payload);
    },
    []
  );

  /**
   * 廣播訊息
   */
  const broadcast = useCallback((type: MessageType, payload: unknown) => {
    mqttService.broadcast(type, payload);
  }, []);

  /**
   * 發送 WebRTC Offer
   */
  const sendOffer = useCallback(
    (recipientPublicKeyBase64: string, offer: RTCSessionDescriptionInit) => {
      mqttService.sendOffer(recipientPublicKeyBase64, offer);
    },
    []
  );

  /**
   * 發送 WebRTC Answer
   */
  const sendAnswer = useCallback(
    (recipientPublicKeyBase64: string, answer: RTCSessionDescriptionInit) => {
      mqttService.sendAnswer(recipientPublicKeyBase64, answer);
    },
    []
  );

  /**
   * 發送 ICE Candidate
   */
  const sendIceCandidate = useCallback(
    (recipientPublicKeyBase64: string, candidate: RTCIceCandidate) => {
      mqttService.sendIceCandidate(recipientPublicKeyBase64, candidate);
    },
    []
  );

  /**
   * 廣播 PreKeyBundle
   */
  const broadcastPreKeyBundle = useCallback((bundle: string) => {
    mqttService.broadcastPreKeyBundle(bundle);
  }, []);

  /**
   * 發送 X3DH 初始訊息
   */
  const sendX3DHInit = useCallback(
    (recipientPublicKeyBase64: string, initMessage: string) => {
      mqttService.sendX3DHInit(recipientPublicKeyBase64, initMessage);
    },
    []
  );

  /**
   * 廣播在線狀態
   */
  const broadcastPresence = useCallback((isOnline: boolean) => {
    mqttService.broadcastPresence(isOnline);
  }, []);

  /**
   * 發送正在輸入狀態
   */
  const sendTyping = useCallback(
    (recipientPublicKeyBase64: string, isTyping: boolean) => {
      mqttService.sendTyping(recipientPublicKeyBase64, isTyping);
    },
    []
  );

  /**
   * 訂閱群組
   */
  const subscribeToGroup = useCallback((groupId: string) => {
    mqttService.subscribeToGroup(groupId);
  }, []);

  /**
   * 取消訂閱群組
   */
  const unsubscribeFromGroup = useCallback((groupId: string) => {
    mqttService.unsubscribeFromGroup(groupId);
  }, []);

  // 監聽連線狀態變化
  useEffect(() => {
    const unsub = mqttService.onStateChange((newState) => {
      setState((s) => ({
        ...s,
        connectionState: newState,
        isConnected: newState === ConnectionState.CONNECTED,
      }));
    });

    cleanupRef.current.push(unsub);

    // 設定初始狀態
    setState((s) => ({
      ...s,
      connectionState: mqttService.getState(),
      isConnected: mqttService.getState() === ConnectionState.CONNECTED,
    }));

    return () => {
      unsub();
    };
  }, []);

  // 自動連線
  useEffect(() => {
    if (autoConnect && publicKeyBase64 && !state.isConnected) {
      connect();
    }
  }, [autoConnect, publicKeyBase64, state.isConnected, connect]);

  // 清理
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach((fn) => fn());
      cleanupRef.current = [];
    };
  }, []);

  return {
    // 狀態
    connectionState: state.connectionState,
    isConnected: state.isConnected,
    error: state.error,

    // 連線控制
    connect,
    disconnect,

    // 訊息
    subscribe,
    sendToUser,
    broadcast,

    // WebRTC 信令
    sendOffer,
    sendAnswer,
    sendIceCandidate,

    // 金鑰交換
    broadcastPreKeyBundle,
    sendX3DHInit,

    // 狀態廣播
    broadcastPresence,
    sendTyping,

    // 群組
    subscribeToGroup,
    unsubscribeFromGroup,
  };
}

export default useMqtt;
