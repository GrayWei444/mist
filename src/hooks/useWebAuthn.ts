/**
 * useWebAuthn Hook - 生物辨識認證 React Hook
 *
 * 提供 WebAuthn 生物辨識認證的 React 整合
 */

import { useState, useEffect, useCallback } from 'react';
import {
  webauthnService,
  type StoredCredential,
  type AuthResult,
} from '@services/webauthn';

interface WebAuthnState {
  isSupported: boolean;
  isAvailable: boolean;
  isChecking: boolean;
  hasCredential: boolean;
  credential: StoredCredential | null;
  isAuthenticated: boolean;
  error: string | null;
}

/**
 * WebAuthn 生物辨識認證 Hook
 */
export function useWebAuthn() {
  const [state, setState] = useState<WebAuthnState>({
    isSupported: false,
    isAvailable: false,
    isChecking: true,
    hasCredential: false,
    credential: null,
    isAuthenticated: false,
    error: null,
  });

  // 檢查可用性
  useEffect(() => {
    async function checkAvailability() {
      const isSupported = webauthnService.isSupported;
      let isAvailable = false;

      if (isSupported) {
        isAvailable = await webauthnService.checkAvailability();
      }

      setState((s) => ({
        ...s,
        isSupported,
        isAvailable,
        isChecking: false,
        hasCredential: webauthnService.hasCredential,
        credential: webauthnService.credential,
      }));
    }

    checkAvailability();
  }, []);

  /**
   * 註冊新的生物辨識憑證
   */
  const register = useCallback(
    async (userId: string, userName?: string): Promise<boolean> => {
      setState((s) => ({ ...s, error: null }));

      try {
        const credential = await webauthnService.register(userId, userName);

        setState((s) => ({
          ...s,
          hasCredential: true,
          credential,
        }));

        return true;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Registration failed';
        setState((s) => ({ ...s, error: errorMessage }));
        return false;
      }
    },
    []
  );

  /**
   * 使用生物辨識進行認證
   */
  const authenticate = useCallback(async (): Promise<AuthResult> => {
    setState((s) => ({ ...s, error: null }));

    const result = await webauthnService.authenticate();

    if (result.success) {
      setState((s) => ({
        ...s,
        isAuthenticated: true,
      }));
    } else {
      setState((s) => ({
        ...s,
        error: result.error || 'Authentication failed',
      }));
    }

    return result;
  }, []);

  /**
   * 登出 (重置認證狀態)
   */
  const logout = useCallback(() => {
    setState((s) => ({
      ...s,
      isAuthenticated: false,
    }));
  }, []);

  /**
   * 刪除憑證
   */
  const deleteCredential = useCallback(() => {
    webauthnService.delete();
    setState((s) => ({
      ...s,
      hasCredential: false,
      credential: null,
      isAuthenticated: false,
    }));
  }, []);

  /**
   * 清除錯誤
   */
  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  return {
    // 狀態
    isSupported: state.isSupported,
    isAvailable: state.isAvailable,
    isChecking: state.isChecking,
    hasCredential: state.hasCredential,
    credential: state.credential,
    isAuthenticated: state.isAuthenticated,
    error: state.error,

    // 操作
    register,
    authenticate,
    logout,
    deleteCredential,
    clearError,
  };
}

export default useWebAuthn;
