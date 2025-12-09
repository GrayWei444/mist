import { useChatStore } from '../../stores/chatStore';
import { FriendItem } from './FriendItem';

interface FriendListProps {
  onBackToDisguise?: () => void;
}

export function FriendList({ onBackToDisguise }: FriendListProps) {
  const { friends, currentFriendId, selectFriend } = useChatStore();

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <h1 className="text-lg font-semibold text-white">訊息</h1>
        {onBackToDisguise && (
          <button
            onClick={onBackToDisguise}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors"
            title="返回偽裝頁面"
          >
            <span className="text-dark-300">☁️</span>
          </button>
        )}
      </div>

      {/* Search bar */}
      <div className="px-4 py-2">
        <div className="relative">
          <input
            type="text"
            placeholder="搜尋"
            className="w-full bg-dark-700 text-white placeholder-dark-400 rounded-lg px-4 py-2 pl-10 outline-none focus:ring-2 focus:ring-mist-500/50"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-dark-400">
            🔍
          </span>
        </div>
      </div>

      {/* Friend list */}
      <div className="flex-1 overflow-y-auto">
        {friends.map(friend => (
          <FriendItem
            key={friend.id}
            friend={friend}
            isSelected={friend.id === currentFriendId}
            onClick={() => selectFriend(friend.id)}
          />
        ))}
      </div>
    </div>
  );
}
