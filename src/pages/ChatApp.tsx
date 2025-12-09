import { useState, useEffect } from 'react';
import { FriendList } from '../components/FriendList/FriendList';
import { ChatRoom } from '../components/ChatRoom/ChatRoom';
import { useChatStore } from '../stores/chatStore';

interface ChatAppProps {
  onBackToDisguise: () => void;
}

export function ChatApp({ onBackToDisguise }: ChatAppProps) {
  const { currentFriendId, clearSelection } = useChatStore();
  const [isMobile, setIsMobile] = useState(false);

  // Responsive breakpoint detection
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 600);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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
