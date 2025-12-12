import { useState, useEffect } from 'react';
import { FriendList } from '../components/FriendList/FriendList';
import { ChatRoom } from '../components/ChatRoom/ChatRoom';
import { useChatStore } from '../stores/chatStore';
import { useApp } from '../providers/AppProvider';

interface ChatAppProps {
  onBackToDisguise: () => void;
}

export function ChatApp({ onBackToDisguise }: ChatAppProps) {
  const { currentFriendId, clearSelection, loadFromStorage, isLoaded } = useChatStore();
  const { cryptoReady, hasIdentity, generateIdentity, isInitializing, storageReady } = useApp();
  const [isMobile, setIsMobile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 從本地儲存載入資料
  useEffect(() => {
    if (storageReady && !isLoaded) {
      console.log('[ChatApp] Loading data from storage...');
      loadFromStorage();
    }
  }, [storageReady, isLoaded, loadFromStorage]);

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

  // 注意：X3DH_INIT 和 ENCRYPTED_MESSAGE 的處理已移至 AppProvider 全域處理
  // 這裡不再需要重複監聽，避免衝突

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
