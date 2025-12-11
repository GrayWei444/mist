import { useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useCrypto } from '../../hooks/useCrypto';
import { FriendItem } from './FriendItem';
import { AddFriendModal } from '../Verification/AddFriendModal';

interface FriendListProps {
  onBackToDisguise?: () => void;
}

export function FriendList({ onBackToDisguise }: FriendListProps) {
  const { friends, currentFriendId, selectFriend, addFriend } = useChatStore();
  const { publicKeyBase64 } = useCrypto();
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [copied, setCopied] = useState(false);

  // 複製 ID 到剪貼簿
  const copyId = async () => {
    if (publicKeyBase64) {
      await navigator.clipboard.writeText(publicKeyBase64);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // 縮短顯示的 ID
  const shortId = publicKeyBase64
    ? `${publicKeyBase64.slice(0, 8)}...${publicKeyBase64.slice(-6)}`
    : '載入中...';

  const handleFriendAdded = (publicKey: string, isVerified: boolean) => {
    const trustLevel = isVerified ? 'verified' : 'unverified';
    const name = `好友 ${publicKey.slice(0, 8)}...`;
    addFriend(publicKey, name, trustLevel);
    setShowAddFriend(false);
  };

  return (
    <div className="h-full flex flex-col bg-dark-bg">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-dark-border">
        <h1 className="text-lg font-semibold text-white">訊息</h1>
        <div className="flex items-center gap-1">
          {/* Add Friend Button */}
          <button
            onClick={() => setShowAddFriend(true)}
            className="p-2 hover:bg-dark-700 rounded-full transition-colors"
            title="新增好友"
          >
            <svg className="w-5 h-5 text-mist-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
          </button>
          {/* Back to Disguise Button */}
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
      </div>

      {/* 我的身份卡片 */}
      <div className="px-4 py-3 border-b border-dark-border">
        <div className="flex items-center gap-3 p-3 bg-dark-700/50 rounded-xl">
          {/* 頭像 */}
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mist-500 to-purple-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-lg font-bold">我</span>
          </div>
          {/* 身份資訊 */}
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm">我的身份</p>
            <div className="flex items-center gap-2 mt-1">
              <code className="text-xs text-dark-400 font-mono truncate">
                {shortId}
              </code>
              <button
                onClick={copyId}
                className="text-mist-400 hover:text-mist-300 transition-colors flex-shrink-0"
                title="複製完整 ID"
              >
                {copied ? (
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          {/* QR Code 按鈕 */}
          <button
            onClick={() => setShowAddFriend(true)}
            className="p-2 bg-mist-500/20 hover:bg-mist-500/30 rounded-lg transition-colors"
            title="顯示我的 QR Code"
          >
            <svg className="w-5 h-5 text-mist-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </button>
        </div>
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
        {friends.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <div className="w-16 h-16 rounded-full bg-dark-700 flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <p className="text-dark-400 mb-2">尚無好友</p>
            <button
              onClick={() => setShowAddFriend(true)}
              className="text-mist-400 hover:text-mist-300 text-sm"
            >
              點擊新增好友
            </button>
          </div>
        ) : (
          friends.map(friend => (
            <FriendItem
              key={friend.id}
              friend={friend}
              isSelected={friend.id === currentFriendId}
              onClick={() => selectFriend(friend.id)}
            />
          ))
        )}
      </div>

      {/* Add Friend Modal */}
      <AddFriendModal
        isOpen={showAddFriend}
        onClose={() => setShowAddFriend(false)}
        onFriendAdded={handleFriendAdded}
      />
    </div>
  );
}
