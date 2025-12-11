import { useRef, useEffect, useCallback } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useChat } from '../../hooks/useChat';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

interface ChatRoomProps {
  onBack?: () => void;
}

export function ChatRoom({ onBack }: ChatRoomProps) {
  const { burnMessage } = useChatStore();
  const {
    isReady,
    currentFriend,
    currentMessages,
    sendEncryptedMessage,
    isPeerConnected,
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 發送訊息（使用加密）
  const handleSendMessage = useCallback(
    (content: string) => {
      if (isReady) {
        sendEncryptedMessage(content, 'text');
      }
    },
    [isReady, sendEncryptedMessage]
  );

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentMessages.length]);

  if (!currentFriend) {
    return (
      <div className="h-full flex items-center justify-center bg-dark-bg">
        <div className="text-center text-dark-400">
          <div className="text-6xl mb-4">💬</div>
          <p>選擇一個對話開始聊天</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-dark-card border-b border-dark-border">
        {/* Back button - only on mobile */}
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 -ml-2 hover:bg-dark-700 rounded-full transition-colors sm:hidden"
          >
            <span className="text-dark-300">←</span>
          </button>
        )}

        {/* Friend avatar */}
        <div className="relative">
          {currentFriend.avatar.startsWith('http') ? (
            <img
              src={currentFriend.avatar}
              alt={currentFriend.name}
              className="w-10 h-10 rounded-full object-cover"
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-dark-600 flex items-center justify-center text-xl">
              {currentFriend.avatar}
            </div>
          )}
          {currentFriend.online && (
            <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-dark-card" />
          )}
        </div>

        {/* Friend info */}
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <h2 className="font-medium text-white">{currentFriend.name}</h2>
            {/* Trust Level */}
            <span
              className="text-xs"
              title={currentFriend.trustLevel === 'verified' ? '已驗證' : '未驗證'}
            >
              {currentFriend.trustLevel === 'verified' ? '🟢' : '🟡'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs text-dark-400">
              {currentFriend.online ? '在線' : '離線'}
            </p>
            {/* Connection indicator */}
            {isPeerConnected && (
              <span className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                P2P
              </span>
            )}
            {isReady && !isPeerConnected && (
              <span className="text-xs text-mist-400">E2E</span>
            )}
          </div>
        </div>

        {/* Menu button */}
        <button className="p-2 hover:bg-dark-700 rounded-full transition-colors">
          <span className="text-dark-300">⋮</span>
        </button>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {currentMessages.map(message => (
          <MessageBubble
            key={message.id}
            message={message}
            onBurn={() => burnMessage(message.id)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <ChatInput onSend={handleSendMessage} />
    </div>
  );
}
