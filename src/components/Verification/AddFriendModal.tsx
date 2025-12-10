/**
 * AddFriendModal - 新增好友彈窗元件
 *
 * 整合 QR Code 驗證和邀請連結功能
 */

import { useState } from 'react';
import { QRCodeVerification } from './QRCodeVerification';
import { InviteLink } from './InviteLink';

type TabType = 'qrcode' | 'invite';

interface AddFriendModalProps {
  isOpen: boolean;
  onClose: () => void;
  onFriendAdded?: (publicKey: string, isVerified: boolean) => void;
}

export function AddFriendModal({
  isOpen,
  onClose,
  onFriendAdded,
}: AddFriendModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('qrcode');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* 背景遮罩 */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* 彈窗內容 */}
      <div className="relative w-full max-w-md mx-4 bg-dark-card rounded-2xl shadow-2xl overflow-hidden">
        {/* 標題列 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-dark-700">
          <h2 className="text-lg font-semibold text-white">新增好友</h2>
          <button
            onClick={onClose}
            className="p-2 text-dark-400 hover:text-white hover:bg-dark-700 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 標籤切換 */}
        <div className="flex border-b border-dark-700">
          <button
            onClick={() => setActiveTab('qrcode')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'qrcode'
                ? 'text-mist-400 border-b-2 border-mist-500 bg-mist-500/5'
                : 'text-dark-400 hover:text-white'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              QR Code 驗證
              <span className="text-green-400">🟢</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('invite')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium transition-colors
              ${activeTab === 'invite'
                ? 'text-mist-400 border-b-2 border-mist-500 bg-mist-500/5'
                : 'text-dark-400 hover:text-white'
              }
            `}
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              邀請連結
              <span className="text-yellow-400">🟡</span>
            </span>
          </button>
        </div>

        {/* 內容區域 */}
        <div className="max-h-[70vh] overflow-y-auto">
          {activeTab === 'qrcode' ? (
            <QRCodeVerification
              onVerified={(publicKey) => {
                onFriendAdded?.(publicKey, true);
              }}
            />
          ) : (
            <InviteLink
              onLinkCreated={(_link, code) => {
                console.log('[AddFriendModal] Invite created:', { code });
              }}
            />
          )}
        </div>

        {/* 說明區域 */}
        <div className="px-6 py-4 bg-dark-700/30 border-t border-dark-700">
          {activeTab === 'qrcode' ? (
            <div className="flex items-start gap-3">
              <span className="text-green-400 text-lg">🟢</span>
              <div className="text-sm">
                <p className="text-dark-300 font-medium">面對面驗證</p>
                <p className="text-dark-500 mt-0.5">
                  讓好友掃描您的 QR Code，建立最高信任等級的連結
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-3">
              <span className="text-yellow-400 text-lg">🟡</span>
              <div className="text-sm">
                <p className="text-dark-300 font-medium">遠端邀請</p>
                <p className="text-dark-500 mt-0.5">
                  分享連結邀請好友，之後可透過 QR Code 升級為已驗證
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default AddFriendModal;
