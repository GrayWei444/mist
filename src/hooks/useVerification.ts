/**
 * useVerification Hook - 好友驗證 React Hook
 *
 * 提供 QR Code 驗證和邀請連結功能的 React 整合
 */

import { useState, useEffect, useCallback } from 'react';
import {
  verificationService,
  TrustLevel,
  type VerificationData,
  type InviteData,
  type FriendInfo,
} from '@services/verification';
import { Identity } from '@services/crypto';

interface VerificationState {
  friends: FriendInfo[];
  isGeneratingQR: boolean;
  qrCode: string | null;
  verificationCode: string | null;
  error: string | null;
}

/**
 * 好友驗證 Hook
 */
export function useVerification() {
  const [state, setState] = useState<VerificationState>({
    friends: [],
    isGeneratingQR: false,
    qrCode: null,
    verificationCode: null,
    error: null,
  });

  // 載入好友列表
  useEffect(() => {
    verificationService.loadFriends();
    setState((s) => ({
      ...s,
      friends: verificationService.getFriends(),
    }));
  }, []);

  /**
   * 產生驗證 QR Code
   */
  const generateQRCode = useCallback(
    async (identity: Identity, size?: number): Promise<string | null> => {
      setState((s) => ({ ...s, isGeneratingQR: true, error: null }));

      try {
        const result = await verificationService.generateQRCode(identity, size);

        setState((s) => ({
          ...s,
          isGeneratingQR: false,
          qrCode: result.qrCode,
          verificationCode: result.verificationCode,
        }));

        return result.qrCode;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to generate QR code';
        setState((s) => ({
          ...s,
          isGeneratingQR: false,
          error: errorMessage,
        }));
        return null;
      }
    },
    []
  );

  /**
   * 處理掃描到的 QR Code
   */
  const processQRCode = useCallback(
    (
      qrContent: string
    ): { success: boolean; data?: VerificationData; error?: string } => {
      setState((s) => ({ ...s, error: null }));

      const result = verificationService.processScannedQRCode(qrContent);

      if (!result.success) {
        setState((s) => ({ ...s, error: result.error ?? null }));
      }

      return result;
    },
    []
  );

  /**
   * 建立邀請連結
   */
  const createInviteLink = useCallback(
    (
      identity: Identity,
      baseUrl: string = window.location.origin
    ): { link: string; inviteCode: string } | null => {
      setState((s) => ({ ...s, error: null }));

      try {
        const result = verificationService.createInvite(identity, baseUrl);
        return { link: result.link, inviteCode: result.inviteCode };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Failed to create invite';
        setState((s) => ({ ...s, error: errorMessage }));
        return null;
      }
    },
    []
  );

  /**
   * 處理邀請連結
   */
  const processInviteLink = useCallback(
    (
      url: string
    ): { success: boolean; data?: InviteData; error?: string } => {
      setState((s) => ({ ...s, error: null }));

      const result = verificationService.processInviteLink(url);

      if (!result.success) {
        setState((s) => ({ ...s, error: result.error ?? null }));
      }

      return result;
    },
    []
  );

  /**
   * 新增已驗證好友 (透過 QR Code)
   */
  const addVerifiedFriend = useCallback(
    (publicKey: string, nickname?: string): FriendInfo => {
      const friend = verificationService.addVerifiedFriend(publicKey, nickname);
      setState((s) => ({
        ...s,
        friends: verificationService.getFriends(),
      }));
      return friend;
    },
    []
  );

  /**
   * 新增未驗證好友 (透過邀請連結)
   */
  const addUnverifiedFriend = useCallback(
    (publicKey: string, nickname?: string): FriendInfo => {
      const friend = verificationService.addUnverifiedFriend(publicKey, nickname);
      setState((s) => ({
        ...s,
        friends: verificationService.getFriends(),
      }));
      return friend;
    },
    []
  );

  /**
   * 升級好友為已驗證
   */
  const verifyFriend = useCallback((publicKey: string): boolean => {
    const success = verificationService.verifyFriend(publicKey);
    if (success) {
      setState((s) => ({
        ...s,
        friends: verificationService.getFriends(),
      }));
    }
    return success;
  }, []);

  /**
   * 移除好友
   */
  const removeFriend = useCallback((publicKey: string): boolean => {
    const success = verificationService.removeFriend(publicKey);
    if (success) {
      setState((s) => ({
        ...s,
        friends: verificationService.getFriends(),
      }));
    }
    return success;
  }, []);

  /**
   * 更新好友暱稱
   */
  const updateNickname = useCallback(
    (publicKey: string, nickname: string): boolean => {
      const success = verificationService.updateNickname(publicKey, nickname);
      if (success) {
        setState((s) => ({
          ...s,
          friends: verificationService.getFriends(),
        }));
      }
      return success;
    },
    []
  );

  /**
   * 取得好友資訊
   */
  const getFriend = useCallback((publicKey: string): FriendInfo | null => {
    return verificationService.getFriend(publicKey);
  }, []);

  /**
   * 清除 QR Code
   */
  const clearQRCode = useCallback(() => {
    setState((s) => ({
      ...s,
      qrCode: null,
      verificationCode: null,
    }));
  }, []);

  /**
   * 清除錯誤
   */
  const clearError = useCallback(() => {
    setState((s) => ({ ...s, error: null }));
  }, []);

  // 分類好友
  const verifiedFriends = state.friends.filter(
    (f) => f.trustLevel === TrustLevel.VERIFIED
  );
  const unverifiedFriends = state.friends.filter(
    (f) => f.trustLevel === TrustLevel.UNVERIFIED
  );

  return {
    // 狀態
    friends: state.friends,
    verifiedFriends,
    unverifiedFriends,
    isGeneratingQR: state.isGeneratingQR,
    qrCode: state.qrCode,
    verificationCode: state.verificationCode,
    error: state.error,

    // QR Code 操作
    generateQRCode,
    processQRCode,
    clearQRCode,

    // 邀請連結操作
    createInviteLink,
    processInviteLink,

    // 好友管理
    addVerifiedFriend,
    addUnverifiedFriend,
    verifyFriend,
    removeFriend,
    updateNickname,
    getFriend,

    // 工具
    clearError,
  };
}

export default useVerification;
