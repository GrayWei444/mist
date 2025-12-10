/**
 * InviteLink - 邀請連結元件
 *
 * 產生一次性邀請連結供分享
 */

import { useState, useCallback } from 'react';
import { useVerification } from '@hooks/useVerification';
import { useCrypto } from '@hooks/useCrypto';

interface InviteLinkProps {
  onLinkCreated?: (link: string, inviteCode: string) => void;
  onError?: (error: string) => void;
}

export function InviteLink({ onLinkCreated, onError }: InviteLinkProps) {
  const { createInviteLink, error, clearError } = useVerification();
  const { identity, isInitialized } = useCrypto();

  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateLink = useCallback(() => {
    if (!identity) {
      onError?.('身份未初始化');
      return;
    }

    setIsCreating(true);
    clearError();

    try {
      const result = createInviteLink(identity);
      if (result) {
        setInviteLink(result.link);
        setInviteCode(result.inviteCode);
        onLinkCreated?.(result.link, result.inviteCode);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '建立連結失敗';
      onError?.(errorMsg);
    } finally {
      setIsCreating(false);
    }
  }, [identity, createInviteLink, clearError, onLinkCreated, onError]);

  const handleCopy = async () => {
    if (!inviteLink) return;

    try {
      await navigator.clipboard.writeText(inviteLink);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleShare = async () => {
    if (!inviteLink) return;

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mist 邀請',
          text: '加我為好友！',
          url: inviteLink,
        });
      } catch {
        // User cancelled or share failed
        handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const handleReset = () => {
    setInviteLink(null);
    setInviteCode(null);
    setIsCopied(false);
    clearError();
  };

  // 尚未初始化
  if (!isInitialized) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-12 h-12 border-4 border-mist-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-300">載入中...</p>
      </div>
    );
  }

  // 尚未建立連結
  if (!inviteLink) {
    return (
      <div className="flex flex-col items-center gap-6 p-6">
        {/* 圖示 */}
        <div className="w-20 h-20 rounded-full bg-mist-500/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-mist-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
        </div>

        {/* 說明 */}
        <div className="text-center">
          <h3 className="text-lg font-semibold text-white">建立邀請連結</h3>
          <p className="text-sm text-dark-400 mt-2 max-w-xs">
            產生一次性連結邀請好友。連結使用後將自動失效，24 小時後過期。
          </p>
        </div>

        {/* 信任提示 */}
        <div className="flex items-center gap-2 px-4 py-2 bg-yellow-500/10 rounded-lg">
          <span className="text-yellow-400">🟡</span>
          <span className="text-sm text-yellow-400/80">
            透過連結加入的好友標記為「未驗證」
          </span>
        </div>

        {/* 錯誤 */}
        {error && (
          <div className="w-full px-4 py-3 bg-red-500/20 rounded-lg">
            <p className="text-sm text-red-400 text-center">{error}</p>
          </div>
        )}

        {/* 建立按鈕 */}
        <button
          onClick={handleCreateLink}
          disabled={isCreating}
          className={`
            w-full px-6 py-3 rounded-lg font-medium
            transition-all duration-200
            ${isCreating
              ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
              : 'bg-mist-500 hover:bg-mist-600 text-white'
            }
          `}
        >
          {isCreating ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              建立中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              建立邀請連結
            </span>
          )}
        </button>
      </div>
    );
  }

  // 已建立連結
  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* 成功圖示 */}
      <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
        <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      {/* 標題 */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">邀請連結已建立</h3>
        <p className="text-sm text-dark-400 mt-1">分享此連結給您的好友</p>
      </div>

      {/* 連結顯示 */}
      <div className="w-full">
        <div className="flex items-center gap-2 p-3 bg-dark-700 rounded-lg">
          <input
            type="text"
            value={inviteLink}
            readOnly
            className="flex-1 bg-transparent text-sm text-dark-300 outline-none truncate"
          />
          <button
            onClick={handleCopy}
            className={`
              px-3 py-1.5 rounded text-sm font-medium transition-colors
              ${isCopied
                ? 'bg-green-500/20 text-green-400'
                : 'bg-dark-600 hover:bg-dark-500 text-dark-300'
              }
            `}
          >
            {isCopied ? '已複製' : '複製'}
          </button>
        </div>
      </div>

      {/* 邀請碼 */}
      {inviteCode && (
        <div className="text-center">
          <p className="text-xs text-dark-500 mb-1">邀請碼</p>
          <code className="px-3 py-1 bg-dark-700 rounded text-mist-400 font-mono">
            {inviteCode}
          </code>
        </div>
      )}

      {/* 警告 */}
      <div className="w-full px-4 py-3 bg-dark-700/50 rounded-lg">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-dark-400">
            <p className="font-medium text-dark-300">注意事項</p>
            <ul className="mt-1 space-y-1">
              <li>• 連結僅能使用一次</li>
              <li>• 24 小時後自動失效</li>
              <li>• 請勿公開分享此連結</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 操作按鈕 */}
      <div className="flex gap-3 w-full">
        <button
          onClick={handleShare}
          className="flex-1 px-4 py-3 bg-mist-500 hover:bg-mist-600 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          分享
        </button>
        <button
          onClick={handleReset}
          className="px-4 py-3 bg-dark-600 hover:bg-dark-500 text-dark-300 rounded-lg font-medium transition-colors"
        >
          建立新連結
        </button>
      </div>
    </div>
  );
}

export default InviteLink;
