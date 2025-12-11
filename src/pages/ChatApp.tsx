import { useState, useEffect } from 'react';
import { FriendList } from '../components/FriendList/FriendList';
import { ChatRoom } from '../components/ChatRoom/ChatRoom';
import { useChatStore } from '../stores/chatStore';
import { useCrypto } from '../hooks/useCrypto';

interface ChatAppProps {
  onBackToDisguise: () => void;
}

export function ChatApp({ onBackToDisguise }: ChatAppProps) {
  const { currentFriendId, clearSelection } = useChatStore();
  const { isInitialized, hasIdentity, generateIdentity, loading } = useCrypto();
  const [isMobile, setIsMobile] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // 自動生成身份（首次使用時）
  useEffect(() => {
    if (isInitialized && !hasIdentity && !loading && !isGenerating) {
      setIsGenerating(true);
      try {
        const publicKey = generateIdentity();
        console.log('[ChatApp] Generated new identity:', publicKey.slice(0, 20) + '...');
      } catch (err) {
        console.error('[ChatApp] Failed to generate identity:', err);
      } finally {
        setIsGenerating(false);
      }
    }
  }, [isInitialized, hasIdentity, loading, isGenerating, generateIdentity]);

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
  if (loading || isGenerating || !hasIdentity) {
    return (
      <div className="h-screen bg-dark-bg flex flex-col items-center justify-center">
        <div className="w-16 h-16 border-4 border-mist-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-dark-400">
          {loading ? '初始化加密模組...' : '正在生成您的身份金鑰...'}
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
