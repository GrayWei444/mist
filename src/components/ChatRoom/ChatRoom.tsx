import { useRef, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';

interface ChatRoomProps {
  onBack?: () => void;
}

export function ChatRoom({ onBack }: ChatRoomProps) {
  const { friends, currentFriendId, messages, sendMessage, burnMessage } = useChatStore();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const currentFriend = friends.find(f => f.id === currentFriendId);
  const currentMessages = currentFriendId ? messages[currentFriendId] || [] : [];

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
          <h2 className="font-medium text-white">{currentFriend.name}</h2>
          <p className="text-xs text-dark-400">
            {currentFriend.online ? '在線' : '離線'}
          </p>
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
      <ChatInput onSend={sendMessage} />
    </div>
  );
}
