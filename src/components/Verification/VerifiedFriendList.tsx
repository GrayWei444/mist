/**
 * VerifiedFriendList - 已驗證好友列表元件
 *
 * 顯示好友列表與信任等級
 */

import { useState } from 'react';
import { useVerification } from '@hooks/useVerification';
import { TrustLevel, type FriendInfo } from '@services/verification';

interface VerifiedFriendListProps {
  onSelectFriend?: (friend: FriendInfo) => void;
  onVerifyFriend?: (friend: FriendInfo) => void;
}

export function VerifiedFriendList({
  onSelectFriend,
  onVerifyFriend,
}: VerifiedFriendListProps) {
  const {
    friends,
    verifiedFriends,
    unverifiedFriends,
    removeFriend,
    updateNickname,
  } = useVerification();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNickname, setEditNickname] = useState('');
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all');

  const filteredFriends =
    filter === 'all'
      ? friends
      : filter === 'verified'
      ? verifiedFriends
      : unverifiedFriends;

  const handleStartEdit = (friend: FriendInfo) => {
    setEditingId(friend.publicKey);
    setEditNickname(friend.nickname || '');
  };

  const handleSaveNickname = (publicKey: string) => {
    if (editNickname.trim()) {
      updateNickname(publicKey, editNickname.trim());
    }
    setEditingId(null);
    setEditNickname('');
  };

  const handleRemove = (publicKey: string) => {
    if (confirm('確定要移除這位好友嗎？')) {
      removeFriend(publicKey);
    }
  };

  const formatDate = (timestamp: number): string => {
    return new Date(timestamp).toLocaleDateString('zh-TW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const truncateKey = (key: string): string => {
    return `${key.slice(0, 6)}...${key.slice(-4)}`;
  };

  // 空列表
  if (friends.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 px-6">
        <div className="w-20 h-20 rounded-full bg-dark-700 flex items-center justify-center">
          <svg className="w-10 h-10 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        <p className="text-dark-400 text-center">
          尚無好友<br />
          <span className="text-sm">透過 QR Code 或邀請連結加入好友</span>
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 篩選標籤 */}
      <div className="flex gap-2 p-4 border-b border-dark-700">
        <button
          onClick={() => setFilter('all')}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium transition-colors
            ${filter === 'all'
              ? 'bg-mist-500 text-white'
              : 'bg-dark-700 text-dark-400 hover:text-white'
            }
          `}
        >
          全部 ({friends.length})
        </button>
        <button
          onClick={() => setFilter('verified')}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1
            ${filter === 'verified'
              ? 'bg-green-500/20 text-green-400'
              : 'bg-dark-700 text-dark-400 hover:text-white'
            }
          `}
        >
          <span>🟢</span>
          已驗證 ({verifiedFriends.length})
        </button>
        <button
          onClick={() => setFilter('unverified')}
          className={`
            px-3 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1
            ${filter === 'unverified'
              ? 'bg-yellow-500/20 text-yellow-400'
              : 'bg-dark-700 text-dark-400 hover:text-white'
            }
          `}
        >
          <span>🟡</span>
          未驗證 ({unverifiedFriends.length})
        </button>
      </div>

      {/* 好友列表 */}
      <div className="flex-1 overflow-y-auto">
        {filteredFriends.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-dark-400">
            沒有符合條件的好友
          </div>
        ) : (
          <div className="divide-y divide-dark-700">
            {filteredFriends.map((friend) => (
              <div
                key={friend.publicKey}
                className="p-4 hover:bg-dark-700/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  {/* 頭像 */}
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-mist-400 to-mist-600 flex items-center justify-center text-white font-medium">
                      {(friend.nickname || truncateKey(friend.publicKey))[0].toUpperCase()}
                    </div>
                    {/* 信任等級標記 */}
                    <span
                      className="absolute -bottom-1 -right-1 text-sm"
                      title={friend.trustLevel === TrustLevel.VERIFIED ? '已驗證' : '未驗證'}
                    >
                      {friend.trustLevel === TrustLevel.VERIFIED ? '🟢' : '🟡'}
                    </span>
                  </div>

                  {/* 資訊 */}
                  <div className="flex-1 min-w-0">
                    {/* 名稱 */}
                    {editingId === friend.publicKey ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={editNickname}
                          onChange={(e) => setEditNickname(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveNickname(friend.publicKey);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="flex-1 px-2 py-1 bg-dark-600 rounded text-white text-sm outline-none focus:ring-1 focus:ring-mist-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveNickname(friend.publicKey)}
                          className="p-1 text-green-400 hover:text-green-300"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1 text-dark-400 hover:text-white"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-white truncate">
                          {friend.nickname || truncateKey(friend.publicKey)}
                        </span>
                        <button
                          onClick={() => handleStartEdit(friend)}
                          className="p-1 text-dark-500 hover:text-dark-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                      </div>
                    )}

                    {/* 公鑰 */}
                    <p className="text-xs text-dark-500 font-mono mt-0.5">
                      {truncateKey(friend.publicKey)}
                    </p>

                    {/* 日期資訊 */}
                    <div className="flex items-center gap-3 mt-1 text-xs text-dark-400">
                      <span>加入於 {formatDate(friend.addedAt)}</span>
                      {friend.verifiedAt && (
                        <span className="text-green-400/80">
                          驗證於 {formatDate(friend.verifiedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 操作按鈕 */}
                  <div className="flex items-center gap-1">
                    {/* 未驗證好友顯示升級按鈕 */}
                    {friend.trustLevel === TrustLevel.UNVERIFIED && (
                      <button
                        onClick={() => onVerifyFriend?.(friend)}
                        className="p-2 text-yellow-400 hover:bg-yellow-500/10 rounded-lg transition-colors"
                        title="升級為已驗證"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                      </button>
                    )}

                    {/* 聊天按鈕 */}
                    <button
                      onClick={() => onSelectFriend?.(friend)}
                      className="p-2 text-mist-400 hover:bg-mist-500/10 rounded-lg transition-colors"
                      title="開始聊天"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                    </button>

                    {/* 移除按鈕 */}
                    <button
                      onClick={() => handleRemove(friend.publicKey)}
                      className="p-2 text-dark-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="移除好友"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VerifiedFriendList;
