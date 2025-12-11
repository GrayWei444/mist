/**
 * useChat Hook - 加密聊天整合
 *
 * 整合 AppProvider 和 chatStore，提供加密訊息收發功能
 */

import { useCallback, useEffect, useRef } from 'react';
import { useApp } from '../providers/AppProvider';
import { useChatStore } from '../stores/chatStore';
import { MessageType } from '../services/mqtt';
import type { Message } from '../types';

interface UseChatOptions {
  onMessageReceived?: (message: Message, senderPublicKey: string) => void;
  onError?: (error: string) => void;
}

/**
 * 加密聊天 Hook
 */
export function useChat(options: UseChatOptions = {}) {
  const { onMessageReceived, onError } = options;

  const {
    publicKey,
    cryptoReady,
    mqttConnected,
    encryptMessage,
    decryptMessage,
    sendToUser,
    subscribeMessage,
    connectPeer,
    sendToPeer,
    isConnectedTo,
  } = useApp();

  const {
    friends,
    currentFriendId,
    messages,
    sendMessage: storeSendMessage,
    receiveMessage: storeReceiveMessage,
    getFriendByPublicKey,
  } = useChatStore();

  const subscriptionRef = useRef<(() => void) | null>(null);

  // 取得當前好友
  const currentFriend = friends.find((f) => f.id === currentFriendId);

  // 訂閱 MQTT 訊息
  useEffect(() => {
    if (!mqttConnected || !publicKey) return;

    // 訂閱加密訊息
    const unsubscribe = subscribeMessage(MessageType.ENCRYPTED_MESSAGE, (mqttMessage) => {
      try {
        const { from: senderPublicKey, payload } = mqttMessage;

        // 檢查發送者是否為好友
        const friend = getFriendByPublicKey(senderPublicKey);
        if (!friend) {
          console.log('[useChat] Received message from unknown sender:', senderPublicKey.slice(0, 16));
          return;
        }

        // 解密訊息
        const decrypted = decryptMessage(senderPublicKey, payload);
        const messageData = JSON.parse(decrypted) as {
          content: string;
          type: 'text' | 'image' | 'file';
          ttl?: number;
        };

        // 建立訊息物件
        const message: Message = {
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          senderId: friend.id,
          content: messageData.content,
          timestamp: Date.now(),
          type: messageData.type,
          isRead: false,
          isBurned: false,
          ttl: messageData.ttl,
          encrypted: true,
        };

        // 儲存到 store
        storeReceiveMessage(friend.id, message);

        // 觸發回調
        onMessageReceived?.(message, senderPublicKey);

        console.log('[useChat] Received encrypted message from:', friend.name);
      } catch (err) {
        console.error('[useChat] Failed to process message:', err);
        onError?.(err instanceof Error ? err.message : 'Failed to process message');
      }
    });

    subscriptionRef.current = unsubscribe;

    return () => {
      unsubscribe();
      subscriptionRef.current = null;
    };
  }, [
    mqttConnected,
    publicKey,
    subscribeMessage,
    decryptMessage,
    getFriendByPublicKey,
    storeReceiveMessage,
    onMessageReceived,
    onError,
  ]);

  /**
   * 發送加密訊息
   */
  const sendEncryptedMessage = useCallback(
    async (content: string, type: 'text' | 'image' | 'file' = 'text', ttl?: number) => {
      if (!currentFriend || !publicKey) {
        onError?.('No friend selected or identity not initialized');
        return false;
      }

      try {
        // 建立訊息資料
        const messageData = {
          content,
          type,
          ttl,
          timestamp: Date.now(),
        };

        // 加密訊息
        const encrypted = encryptMessage(currentFriend.publicKey, JSON.stringify(messageData));

        // 檢查是否有 P2P 連線
        const hasPeerConnection = isConnectedTo(currentFriend.publicKey);

        if (hasPeerConnection) {
          // 透過 WebRTC 發送
          const sent = sendToPeer(currentFriend.publicKey, JSON.stringify({
            type: 'encrypted_message',
            payload: encrypted,
          }));

          if (!sent) {
            // P2P 失敗，改用 MQTT
            sendToUser(currentFriend.publicKey, MessageType.ENCRYPTED_MESSAGE, encrypted);
          }
        } else {
          // 透過 MQTT 發送
          sendToUser(currentFriend.publicKey, MessageType.ENCRYPTED_MESSAGE, encrypted);
        }

        // 儲存到本地 store（顯示已發送）
        storeSendMessage(content);

        console.log('[useChat] Sent encrypted message to:', currentFriend.name, hasPeerConnection ? '(P2P)' : '(MQTT)');
        return true;
      } catch (err) {
        console.error('[useChat] Failed to send message:', err);
        onError?.(err instanceof Error ? err.message : 'Failed to send message');
        return false;
      }
    },
    [
      currentFriend,
      publicKey,
      encryptMessage,
      isConnectedTo,
      sendToPeer,
      sendToUser,
      storeSendMessage,
      onError,
    ]
  );

  /**
   * 建立 P2P 連線
   */
  const establishPeerConnection = useCallback(
    async (friendId: string) => {
      const friend = friends.find((f) => f.id === friendId);
      if (!friend) {
        onError?.('Friend not found');
        return false;
      }

      try {
        await connectPeer(friend.publicKey);
        console.log('[useChat] P2P connection established with:', friend.name);
        return true;
      } catch (err) {
        console.error('[useChat] Failed to establish P2P connection:', err);
        // P2P 連線失敗不是錯誤，可以透過 MQTT 發送
        return false;
      }
    },
    [friends, connectPeer, onError]
  );

  /**
   * 取得當前對話的訊息
   */
  const currentMessages = currentFriendId ? messages[currentFriendId] || [] : [];

  return {
    // 狀態
    isReady: cryptoReady && mqttConnected && !!publicKey,
    currentFriend,
    currentMessages,
    friends,

    // 操作
    sendEncryptedMessage,
    establishPeerConnection,

    // 連線狀態
    isPeerConnected: currentFriend ? isConnectedTo(currentFriend.publicKey) : false,
  };
}

export default useChat;
