/**
 * BiometricAuth - WebAuthn 生物辨識認證元件
 */

import { useState, useEffect } from 'react';
import { useWebAuthn } from '@hooks/useWebAuthn';

interface BiometricAuthProps {
  userId: string;
  userName?: string;
  onAuthenticated?: () => void;
  onError?: (error: string) => void;
}

export function BiometricAuth({
  userId,
  userName = 'Mist User',
  onAuthenticated,
  onError,
}: BiometricAuthProps) {
  const {
    isSupported,
    isAvailable,
    isChecking,
    hasCredential,
    isAuthenticated,
    error,
    register,
    authenticate,
    clearError,
  } = useWebAuthn();

  const [isProcessing, setIsProcessing] = useState(false);

  // 通知認證成功
  useEffect(() => {
    if (isAuthenticated && onAuthenticated) {
      onAuthenticated();
    }
  }, [isAuthenticated, onAuthenticated]);

  // 通知錯誤
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  const handleRegister = async () => {
    setIsProcessing(true);
    clearError();
    await register(userId, userName);
    setIsProcessing(false);
  };

  const handleAuthenticate = async () => {
    setIsProcessing(true);
    clearError();
    await authenticate();
    setIsProcessing(false);
  };

  // 檢查中
  if (isChecking) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-12 h-12 border-4 border-mist-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-dark-300">檢查裝置支援...</p>
      </div>
    );
  }

  // 不支援 WebAuthn
  if (!isSupported) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <p className="text-dark-300">您的瀏覽器不支援生物辨識認證</p>
        <p className="text-sm text-dark-400">請使用支援 WebAuthn 的現代瀏覽器</p>
      </div>
    );
  }

  // 沒有平台認證器
  if (!isAvailable) {
    return (
      <div className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <p className="text-dark-300">未偵測到生物辨識裝置</p>
        <p className="text-sm text-dark-400">請確認您的裝置支援指紋或臉部辨識</p>
      </div>
    );
  }

  // 已認證
  if (isAuthenticated) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center">
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-green-400 font-medium">認證成功</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      {/* 圖示 */}
      <div className="w-20 h-20 rounded-full bg-mist-500/20 flex items-center justify-center">
        <svg className="w-10 h-10 text-mist-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      </div>

      {/* 標題 */}
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white">
          {hasCredential ? '生物辨識登入' : '設定生物辨識'}
        </h3>
        <p className="text-sm text-dark-400 mt-1">
          {hasCredential
            ? '使用指紋或臉部辨識來解鎖'
            : '註冊您的生物特徵以快速安全登入'}
        </p>
      </div>

      {/* 錯誤訊息 */}
      {error && (
        <div className="w-full px-4 py-3 bg-red-500/20 rounded-lg">
          <p className="text-sm text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* 按鈕 */}
      {hasCredential ? (
        <button
          onClick={handleAuthenticate}
          disabled={isProcessing}
          className={`
            w-full px-6 py-3 rounded-lg font-medium
            transition-all duration-200
            ${isProcessing
              ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
              : 'bg-mist-500 hover:bg-mist-600 text-white'
            }
          `}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              驗證中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
              </svg>
              使用生物辨識登入
            </span>
          )}
        </button>
      ) : (
        <button
          onClick={handleRegister}
          disabled={isProcessing}
          className={`
            w-full px-6 py-3 rounded-lg font-medium
            transition-all duration-200
            ${isProcessing
              ? 'bg-dark-600 text-dark-400 cursor-not-allowed'
              : 'bg-mist-500 hover:bg-mist-600 text-white'
            }
          `}
        >
          {isProcessing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              註冊中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              註冊生物辨識
            </span>
          )}
        </button>
      )}
    </div>
  );
}

export default BiometricAuth;
