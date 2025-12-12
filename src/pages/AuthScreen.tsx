/**
 * AuthScreen - PIN/生物辨識驗證頁面
 *
 * 用於進入聊天前的身份驗證
 * - 首次使用：設定 PIN 碼
 * - 之後使用：驗證 PIN 碼
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { authService } from '../services/auth';
import { useChatStore } from '../stores/chatStore';

interface AuthScreenProps {
  onSuccess: () => void;
  onBack: () => void;
}

type AuthMode = 'loading' | 'setup' | 'confirm' | 'name' | 'verify';

export function AuthScreen({ onSuccess, onBack }: AuthScreenProps) {
  const [mode, setMode] = useState<AuthMode>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { setDisplayName: saveDisplayName } = useChatStore();

  const PIN_LENGTH = 6;
  const MAX_ATTEMPTS = 5;

  // 檢查是否已設定 PIN
  useEffect(() => {
    const checkAuth = async () => {
      const hasPin = await authService.hasPin();
      setMode(hasPin ? 'verify' : 'setup');
      setAttempts(authService.getFailedAttempts());
    };
    checkAuth();
  }, []);

  // 自動聚焦輸入框
  useEffect(() => {
    if (mode === 'name') {
      nameInputRef.current?.focus();
    } else if (mode !== 'loading') {
      inputRef.current?.focus();
    }
  }, [mode]);

  // 處理 PIN 輸入
  const handlePinChange = useCallback((value: string) => {
    // 只允許數字
    const numericValue = value.replace(/\D/g, '').slice(0, PIN_LENGTH);

    if (mode === 'setup') {
      setPin(numericValue);
      setError('');
    } else if (mode === 'confirm') {
      setConfirmPin(numericValue);
      setError('');
    } else if (mode === 'verify') {
      setPin(numericValue);
      setError('');
    }
  }, [mode]);

  // 處理設定 PIN
  const handleSetup = useCallback(async () => {
    if (pin.length !== PIN_LENGTH) {
      setError(`請輸入 ${PIN_LENGTH} 位數密碼`);
      return;
    }
    setMode('confirm');
  }, [pin]);

  // 處理確認 PIN
  const handleConfirm = useCallback(async () => {
    if (confirmPin !== pin) {
      setError('密碼不一致，請重新輸入');
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setConfirmPin('');
      return;
    }

    try {
      await authService.setPin(pin);
      // 進入名稱設定
      setMode('name');
      setError('');
    } catch (err) {
      setError('設定失敗，請重試');
    }
  }, [pin, confirmPin]);

  // 處理名稱設定
  const handleNameSubmit = useCallback(() => {
    const trimmedName = displayName.trim();
    if (!trimmedName) {
      setError('請輸入您的名稱');
      return;
    }
    if (trimmedName.length > 20) {
      setError('名稱不能超過 20 個字');
      return;
    }
    saveDisplayName(trimmedName);
    onSuccess();
  }, [displayName, saveDisplayName, onSuccess]);

  // 處理驗證 PIN
  const handleVerify = useCallback(async () => {
    if (pin.length !== PIN_LENGTH) {
      return;
    }

    const isValid = await authService.verifyPin(pin);

    if (isValid) {
      onSuccess();
    } else {
      const remaining = MAX_ATTEMPTS - authService.getFailedAttempts();
      setError(remaining > 0
        ? `密碼錯誤，還剩 ${remaining} 次機會`
        : '已鎖定，請稍後再試'
      );
      setShake(true);
      setTimeout(() => setShake(false), 500);
      setPin('');
      setAttempts(authService.getFailedAttempts());
    }
  }, [pin, onSuccess]);

  // 當 PIN 輸入完成時自動提交
  useEffect(() => {
    if (mode === 'setup' && pin.length === PIN_LENGTH) {
      handleSetup();
    } else if (mode === 'confirm' && confirmPin.length === PIN_LENGTH) {
      handleConfirm();
    } else if (mode === 'verify' && pin.length === PIN_LENGTH) {
      handleVerify();
    }
  }, [mode, pin, confirmPin, handleSetup, handleConfirm, handleVerify]);

  // 返回上一步
  const handleBack = useCallback(() => {
    if (mode === 'name') {
      // 名稱設定不能返回，只能完成
      return;
    } else if (mode === 'confirm') {
      setMode('setup');
      setConfirmPin('');
      setError('');
    } else {
      onBack();
    }
  }, [mode, onBack]);

  // 渲染 PIN 點點
  const renderPinDots = (value: string) => {
    return (
      <div className={`flex gap-3 ${shake ? 'animate-shake' : ''}`}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={`
              w-4 h-4 rounded-full transition-all duration-200
              ${i < value.length
                ? 'bg-mist-400 scale-110'
                : 'bg-dark-600 border-2 border-dark-500'
              }
            `}
          />
        ))}
      </div>
    );
  };

  // 渲染數字鍵盤
  const renderKeypad = (currentValue: string, onChange: (v: string) => void) => {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'];

    return (
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        {keys.map((key, i) => {
          if (key === '') {
            return <div key={i} />;
          }

          if (key === 'del') {
            return (
              <button
                key={i}
                onClick={() => onChange(currentValue.slice(0, -1))}
                className="h-16 flex items-center justify-center text-dark-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z" />
                </svg>
              </button>
            );
          }

          return (
            <button
              key={i}
              onClick={() => onChange(currentValue + key)}
              disabled={currentValue.length >= PIN_LENGTH}
              className="h-16 rounded-full bg-dark-700 hover:bg-dark-600 text-white text-2xl font-medium transition-colors disabled:opacity-50"
            >
              {key}
            </button>
          );
        })}
      </div>
    );
  };

  // 載入中
  if (mode === 'loading') {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-mist-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 帳號已鎖定
  if (attempts >= MAX_ATTEMPTS) {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-6">
        <div className="w-20 h-20 rounded-full bg-red-500/20 flex items-center justify-center mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m0 0v2m0-2h2m-2 0H8m13 0a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 className="text-xl font-semibold text-white mb-2">帳號已鎖定</h2>
        <p className="text-dark-400 text-center mb-6">
          錯誤次數過多，請 5 分鐘後再試
        </p>
        <button
          onClick={onBack}
          className="text-mist-400 hover:text-mist-300"
        >
          返回
        </button>
      </div>
    );
  }

  // 名稱設定頁面
  if (mode === 'name') {
    return (
      <div className="min-h-screen bg-dark-bg flex flex-col">
        {/* Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          {/* Icon */}
          <div className="w-20 h-20 rounded-full bg-mist-500/20 flex items-center justify-center mb-8">
            <svg className="w-10 h-10 text-mist-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-semibold text-white mb-2">設定您的名稱</h1>
          <p className="text-dark-400 mb-8 text-center">
            這個名稱會在加好友時顯示給對方
          </p>

          {/* Name Input */}
          <div className="w-full max-w-xs mb-6">
            <input
              ref={nameInputRef}
              type="text"
              value={displayName}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameSubmit();
                }
              }}
              placeholder="輸入您的名稱"
              maxLength={20}
              className="w-full px-4 py-3 bg-dark-700 border border-dark-600 rounded-xl text-white text-center text-lg placeholder:text-dark-500 focus:outline-none focus:border-mist-500 transition-colors"
            />
            <p className="text-dark-500 text-xs text-center mt-2">
              {displayName.length}/20 字
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <p className="text-red-400 text-sm mb-4">{error}</p>
          )}

          {/* Submit Button */}
          <button
            onClick={handleNameSubmit}
            disabled={!displayName.trim()}
            className="px-8 py-3 bg-gradient-to-r from-mist-600 to-purple-600 hover:from-mist-700 hover:to-purple-700 disabled:from-dark-600 disabled:to-dark-600 text-white rounded-xl font-medium transition-all disabled:cursor-not-allowed"
          >
            完成設定
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col">
      {/* Header */}
      <div className="flex items-center p-4">
        <button
          onClick={handleBack}
          className="p-2 text-dark-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 pb-20">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-mist-500/20 flex items-center justify-center mb-8">
          <svg className="w-10 h-10 text-mist-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-2xl font-semibold text-white mb-2">
          {mode === 'setup' && '設定密碼'}
          {mode === 'confirm' && '確認密碼'}
          {mode === 'verify' && '輸入密碼'}
        </h1>
        <p className="text-dark-400 mb-8 text-center">
          {mode === 'setup' && '設定 6 位數密碼來保護您的訊息'}
          {mode === 'confirm' && '請再次輸入密碼確認'}
          {mode === 'verify' && '請輸入您的密碼'}
        </p>

        {/* PIN Dots */}
        <div className="mb-8">
          {mode === 'confirm'
            ? renderPinDots(confirmPin)
            : renderPinDots(pin)
          }
        </div>

        {/* Error Message */}
        {error && (
          <p className="text-red-400 text-sm mb-4">{error}</p>
        )}

        {/* Hidden input for keyboard support */}
        <input
          ref={inputRef}
          type="tel"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={PIN_LENGTH}
          value={mode === 'confirm' ? confirmPin : pin}
          onChange={(e) => handlePinChange(e.target.value)}
          className="sr-only"
          autoComplete="off"
        />

        {/* Keypad */}
        {renderKeypad(
          mode === 'confirm' ? confirmPin : pin,
          handlePinChange
        )}
      </div>
    </div>
  );
}

export default AuthScreen;
