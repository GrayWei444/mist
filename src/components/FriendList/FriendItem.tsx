import { useState } from 'react';
import type { Friend } from '../../types';

interface FriendItemProps {
  friend: Friend;
  isSelected: boolean;
  onClick: () => void;
}

// 根據名字生成 emoji 頭像
const getEmojiAvatar = (name: string): string => {
  const emojis = ['👤', '👩', '👨', '🧑', '👩‍💼', '👨‍💼', '🧑‍💻', '👩‍🔬', '👨‍🎨', '🤖'];
  const index = name.charCodeAt(0) % emojis.length;
  return emojis[index];
};

export function FriendItem({ friend, isSelected, onClick }: FriendItemProps) {
  const [imgError, setImgError] = useState(false);
  const formatTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;

    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
    return `${Math.floor(diff / 86400000)} 天前`;
  };

  return (
    <div
      onClick={onClick}
      className={`
        flex items-center gap-3 p-3 cursor-pointer
        transition-colors duration-150
        ${isSelected
          ? 'bg-mist-500/20 border-l-2 border-mist-500'
          : 'hover:bg-dark-700 border-l-2 border-transparent'
        }
      `}
    >
      {/* Avatar */}
      <div className="relative">
        {friend.avatar.startsWith('http') && !imgError ? (
          <img
            src={friend.avatar}
            alt={friend.name}
            className="w-12 h-12 rounded-full object-cover bg-dark-600"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="w-12 h-12 rounded-full bg-dark-600 flex items-center justify-center text-2xl">
            {friend.avatar.startsWith('http') ? getEmojiAvatar(friend.name) : friend.avatar}
          </div>
        )}
        {/* Online indicator */}
        {friend.online && (
          <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-card" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="font-medium text-white truncate">{friend.name}</span>
            {/* Trust Level Indicator */}
            <span
              className="text-xs flex-shrink-0"
              title={friend.trustLevel === 'verified' ? '已驗證' : '未驗證'}
            >
              {friend.trustLevel === 'verified' ? '🟢' : '🟡'}
            </span>
          </div>
          <div className="flex items-center gap-2 ml-2">
            {friend.unreadCount > 0 && (
              <span className="px-2 py-0.5 text-xs bg-mist-500 text-white rounded-full">
                {friend.unreadCount}
              </span>
            )}
            <span className="text-xs text-dark-400 whitespace-nowrap">
              {formatTime(friend.lastMessageTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
