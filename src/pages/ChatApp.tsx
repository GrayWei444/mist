import { useState, useEffect } from 'react';
import { FriendList } from '../components/FriendList/FriendList';
import { ChatRoom } from '../components/ChatRoom/ChatRoom';
import { useChatStore } from '../stores/chatStore';
import { useApp } from '../providers/AppProvider';
import { mqttService, MessageType, ConnectionState } from '../services/mqtt';
import { fromBase64 } from '../services/crypto';

interface ChatAppProps {
  onBackToDisguise: () => void;
}

// X3DH 初始化訊息結構
interface X3DHInitPayload {
  ephemeralPublicKey: string;
  senderName: string;
}

export function ChatApp({ onBackToDisguise }: ChatAppProps) {
  const { currentFriendId, clearSelection } = useChatStore();
  const { cryptoReady, hasIdentity, generateIdentity, publicKey, isInitializing, acceptSession } = useApp();
  const [isMobile, setIsMobile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 自動生成身份（首次使用時）
  useEffect(() => {
    if (cryptoReady && !hasIdentity && !isInitializing && !isGenerating) {
      setIsGenerating(true);
      try {
        const newPubKey = generateIdentity();
        console.log('[ChatApp] Generated new identity:', newPubKey.slice(0, 20) + '...');
      } catch (err) {
        console.error('[ChatApp] Failed to generate identity:', err);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [cryptoReady, hasIdentity, isInitializing, isGenerating, generateIdentity]);

  // MQTT 連接與 X3DH_INIT 監聽（接收好友添加請求）
  useEffect(() => {
    if (!publicKey) return;

    let isMounted = true;
    let unsubscribeX3dh: (() => void) | null = null;
    let unsubscribeAll: (() => void) | null = null;

    const setupMqtt = async () => {
      try {
        // 連接 MQTT (如果尚未連接)
        if (mqttService.getState() !== ConnectionState.CONNECTED) {
          console.log('[ChatApp] Connecting to MQTT...');
          console.log('[ChatApp] My public key:', publicKey.slice(0, 20) + '...');
          await mqttService.connect(publicKey);
          console.log('[ChatApp] MQTT connected successfully');
        } else {
          console.log('[ChatApp] MQTT already connected');
        }

        if (!isMounted) return;

        // 監聽所有訊息（用於調試）
        unsubscribeAll = mqttService.onMessage('*' as MessageType, (msg) => {
          console.log('[ChatApp] 📨 Received message:', {
            type: msg.type,
            from: msg.from?.slice(0, 16) + '...',
            to: msg.to?.slice(0, 16) + '...',
          });
        });

        // 監聯 X3DH_INIT 訊息（有人掃描了我的 QR Code）
        unsubscribeX3dh = mqttService.onMessage(MessageType.X3DH_INIT, (msg) => {
          const senderPk = msg.from;
          const payload = msg.payload as X3DHInitPayload;

          console.log('[ChatApp] 🔑 Received X3DH_INIT!');
          console.log('[ChatApp] From:', senderPk);
          console.log('[ChatApp] Payload:', payload);

          // 使用 getState() 確保獲取最新狀態
          const { getFriendByPublicKey: getFriend, addFriend: add } = useChatStore.getState();

          // 檢查是否已經是好友
          const existingFriend = getFriend(senderPk);
          if (existingFriend) {
            console.log('[ChatApp] Already friends with:', existingFriend.name);
            return;
          }

          try {
            // 執行 X3DH (作為接收者) - 建立 Double Ratchet 會話
            const senderIdentityPubKey = fromBase64(senderPk);
            const senderEphemeralPubKey = fromBase64(payload.ephemeralPublicKey);

            acceptSession(senderIdentityPubKey, senderEphemeralPubKey);
            console.log('[ChatApp] ✅ Session established with:', senderPk.slice(0, 16) + '...');
          } catch (err) {
            console.error('[ChatApp] Failed to accept session:', err);
          }

          // 添加為好友
          const friendName = payload.senderName || `好友 ${senderPk.slice(0, 8)}`;
          add(senderPk, friendName, 'verified');
          console.log('[ChatApp] ✅ Added new friend:', friendName);
        });

        console.log('[ChatApp] X3DH_INIT listener registered');
      } catch (err) {
        console.error('[ChatApp] MQTT setup error:', err);
      }
    };

    setupMqtt();

    return () => {
      isMounted = false;
      if (unsubscribeX3dh) unsubscribeX3dh();
      if (unsubscribeAll) unsubscribeAll();
    };
  }, [publicKey, acceptSession]); // 依賴 publicKey 和 acceptSession

  // Responsive breakpoint detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 600);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 顯示載入中畫面
  if (isInitializing || isGenerating || !hasIdentity) {
    return (
      <div className="h-screen bg-dark-bg flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-mist-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-dark-400">
          {isInitializing ? '初始化加密模組...' : '正在生成您的身份金鑰...'}
        </p>
        <p className="text-dark-500 text-sm mt-2">首次使用需要幾秒鐘</p>
      </div>
    );
  }

  // Mobile: single column layout with navigation
  if (isMobile) {
    return (
      <div className="h-screen bg-dark-bg">
        {currentFriendId ? (
          <ChatRoom onBack={clearSelection} />
        ) : (
          <FriendList onBackToDisguise={onBackToDisguise} />
        )}
      </div>
    );
  }

  // Tablet/Desktop: split view
  return (
    <div className="h-screen flex bg-dark-bg">
      {/* Friend list - left panel */}
      <div className="w-80 border-r border-dark-border flex-shrink-0">
        <FriendList onBackToDisguise={onBackToDisguise} />
      </div>

      {/* Chat room - right panel */}
      <div className="flex-1">
        <ChatRoom />
      </div>
    </div>
  );
}
