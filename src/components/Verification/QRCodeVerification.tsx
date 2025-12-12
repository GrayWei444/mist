/**
 * QRCodeVerification - QR Code 好友驗證元件
 *
 * 用於面對面驗證好友身份，產生和顯示驗證 QR Code
 * 使用 X3DH 格式：包含 IdentityKey + SignedPreKey
 */

import { useState, useEffect, useCallback } from 'react';
import { useCrypto } from '@hooks/useCrypto';
import { useChatStore } from '@stores/chatStore';
import QRCode from 'qrcode';

// QR Code 資料結構 (與 AddFriendModal 掃描格式一致)
interface QRCodeData {
  v: number;      // 版本號
  pk: string;     // Ed25519 公鑰 (Base64)
  spk: string;    // SignedPreKey 公鑰 (Base64)
  sig: string;    // SignedPreKey 簽名 (Base64)
  name: string;   // 用戶名稱
}

interface QRCodeVerificationProps {
  onVerified?: (publicKey: string, verificationCode: string) => void;
  onError?: (error: string) => void;
}

export function QRCodeVerification({
  onVerified: _onVerified,
  onError,
}: QRCodeVerificationProps) {
  const { identity, signedPreKey, isInitialized } = useCrypto();
  const displayName = useChatStore((state) => state.userProfile.displayName);

  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isGeneratingQR, setIsGeneratingQR] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(300); // 5 分鐘
  const [isExpired, setIsExpired] = useState(false);

  // 產生 QR Code (X3DH 格式)
  const generateQR = useCallback(async () => {
    if (!identity || !signedPreKey) {
      setError('身份或金鑰未初始化');
      return;
    }

    setIsGeneratingQR(true);
    setError(null);

    try {
      // 建立 X3DH 格式的 QR 資料
      const qrData: QRCodeData = {
        v: 1,
        pk: identity.publicKeyBase64,
        spk: signedPreKey.publicKeyBase64,
        sig: signedPreKey.signatureBase64,
        name: displayName || `用戶 ${identity.publicKeyBase64.slice(0, 6)}`,
      };

      const jsonData = JSON.stringify(qrData);

      // 產生 QR Code
      const qrCodeDataUrl = await QRCode.toDataURL(jsonData, {
        width: 280,
        margin: 2,
        color: {
          dark: '#000000', // 黑色，提高掃描成功率
          light: '#FFFFFF',
        },
        errorCorrectionLevel: 'M',
      });

      setQrCode(qrCodeDataUrl);
      setCountdown(300);
      setIsExpired(false);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : '產生 QR Code 失敗';
      setError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setIsGeneratingQR(false);
    }
  }, [identity, signedPreKey, displayName, onError]);

  // 自動產生 QR Code
  useEffect(() => {
    if (isInitialized && identity && signedPreKey && !qrCode && !isGeneratingQR) {
      generateQR();
    }
  }, [isInitialized, identity, signedPreKey, qrCode, isGeneratingQR, generateQR]);

  // 倒數計時
  useEffect(() => {
    if (!qrCode) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          setIsExpired(true);
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [qrCode]);

  const handleRefresh = async () => {
    setQrCode(null);
    await generateQR();
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 載入中
  if (!isInitialized || isGeneratingQR) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-12 h-12 border-4 border-mist-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-300">產生驗證 QR Code...</p>
      </div>
    );
  }

  // 錯誤
  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-red-400">{error}</p>
        <button
          onClick={handleRefresh}
          className="px-4 py-2 bg-mist-500 hover:bg-mist-600 text-white rounded-lg transition-colors"
        >
          重試
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* 標題 */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">我的驗證 QR Code</h3>
        <p className="text-sm text-dark-400 mt-1">讓好友掃描來驗證您的身份</p>
      </div>

      {/* QR Code */}
      <div className="relative">
        <div
          className={`
            p-4 bg-white rounded-2xl shadow-lg
            ${isExpired ? 'opacity-30' : ''}
          `}
        >
          {qrCode ? (
            <img src={qrCode} alt="Verification QR Code" className="w-[280px] h-[280px]" />
          ) : (
            <div className="w-[280px] h-[280px] bg-dark-600 animate-pulse rounded-lg" />
          )}
        </div>

        {/* 過期遮罩 */}
        {isExpired && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-dark-900/80 rounded-2xl">
            <svg className="w-12 h-12 text-dark-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-dark-300 mb-4">QR Code 已過期</p>
            <button
              onClick={handleRefresh}
              className="px-4 py-2 bg-mist-500 hover:bg-mist-600 text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新產生
            </button>
          </div>
        )}
      </div>

      {/* 公鑰縮寫顯示 */}
      {identity && !isExpired && (
        <div className="text-center">
          <p className="text-sm text-dark-400 mb-2">我的 ID</p>
          <code className="px-4 py-2 bg-dark-700 rounded-lg text-sm font-mono text-mist-400">
            {identity.publicKeyBase64.slice(0, 12)}...{identity.publicKeyBase64.slice(-8)}
          </code>
        </div>
      )}

      {/* 倒數計時 */}
      {!isExpired && (
        <div className="flex items-center gap-2 text-dark-400">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm">
            {countdown > 60
              ? `${formatTime(countdown)} 後過期`
              : <span className="text-yellow-400">{formatTime(countdown)} 後過期</span>
            }
          </span>
        </div>
      )}

      {/* 刷新按鈕 */}
      {!isExpired && (
        <button
          onClick={handleRefresh}
          className="px-4 py-2 text-dark-400 hover:text-white transition-colors flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          重新產生
        </button>
      )}
    </div>
  );
}

export default QRCodeVerification;
