/**
 * useChat Hook - 加密聊天整合
 *
 * 整合 AppProvider 和 chatStore，提供加密訊息收發功能
 * 注意：訊息接收由 AppProvider 全域處理，此 Hook 主要負責發送
 */

import { useCallback } from 'react';
import { useApp } from '../providers/AppProvider';
import { useChatStore } from '../stores/chatStore';
import { MessageType } from '../services/mqtt';
import type { RatchetMessage } from '../services/crypto';

interface UseChatOptions {
  onError?: (error: string) => void;
}

/**
 * 加密聊天 Hook
 */
export function useChat(options: UseChatOptions = {}) {
  const { onError } = options;

  const {
    publicKey,
    cryptoReady,
    mqttConnected,
    encryptMessage,
    sendToUser,
    connectPeer,
    sendToPeer,
    isConnectedTo,
  } = useApp();

  const {
    friends,
    currentFriendId,
    messages,
    sendMessage: storeSendMessage,
  } = useChatStore();

  // 取得當前好友
  const currentFriend = friends.find((f) => f.id === currentFriendId);

  // 訊息接收由 AppProvider 全域處理，不需要在這裡訂閱

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

        // 加密訊息 (返回 RatchetMessage WASM 物件)
        console.log('[useChat] Encrypting message for:', currentFriend.publicKey.slice(0, 16) + '...');
        const encrypted = encryptMessage(currentFriend.publicKey, JSON.stringify(messageData)) as RatchetMessage;
        console.log('[useChat] Encryption successful');

        // 序列化 RatchetMessage 為 JSON 字串以便透過網路傳輸
        const serializedMessage = encrypted.toJson();
        console.log('[useChat] Serialized message preview:', serializedMessage.slice(0, 100) + '...');

        // 檢查是否有 P2P 連線
        const hasPeerConnection = isConnectedTo(currentFriend.publicKey);

        if (hasPeerConnection) {
          // 透過 WebRTC 發送
          const sent = sendToPeer(currentFriend.publicKey, JSON.stringify({
            type: 'encrypted_message',
            payload: serializedMessage,
          }));

          if (!sent) {
            // P2P 失敗，改用 MQTT
            sendToUser(currentFriend.publicKey, MessageType.ENCRYPTED_MESSAGE, serializedMessage);
          }
        } else {
          // 透過 MQTT 發送
          sendToUser(currentFriend.publicKey, MessageType.ENCRYPTED_MESSAGE, serializedMessage);
        }

        // 儲存到本地 store（顯示已發送）
        storeSendMessage(content, publicKey);

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
