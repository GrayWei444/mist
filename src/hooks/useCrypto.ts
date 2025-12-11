/**
 * useCrypto Hook - 加密功能 React Hook
 *
 * 提供 WASM 加密模組的 React 整合
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initCrypto,
  Identity,
  SignedPreKey,
  OneTimePreKey,
  Session,
  createPreKeyBundle,
  x3dhInitiator,
  x3dhResponder,
  getCryptoVersion,
  toBase64,
  fromBase64,
  type PreKeyBundleData,
  type RatchetMessage,
} from '@services/crypto';

// 金鑰儲存類型
interface StoredKeys {
  identity: {
    publicKey: string; // Base64
    privateKey: string; // Base64
  };
  signedPreKey: {
    id: number;
    publicKey: string;
    privateKey: string;
    signature: string;
    timestamp: number;
  };
  oneTimePreKeys: Array<{
    id: number;
    publicKey: string;
    privateKey: string;
  }>;
}

// Hook 狀態
interface CryptoState {
  initialized: boolean;
  loading: boolean;
  error: Error | null;
  identity: Identity | null;
  signedPreKey: SignedPreKey | null;
  oneTimePreKeys: OneTimePreKey[];
  sessions: Map<string, Session>;
  version: string | null;
}

// IndexedDB 儲存鍵
const STORAGE_KEY = 'mist_keys';

/**
 * 加密功能 Hook
 */
export function useCrypto() {
  const [state, setState] = useState<CryptoState>({
    initialized: false,
    loading: true,
    error: null,
    identity: null,
    signedPreKey: null,
    oneTimePreKeys: [],
    sessions: new Map(),
    version: null,
  });

  /**
   * 初始化加密模組
   */
  const initialize = useCallback(async () => {
    try {
      setState((s) => ({ ...s, loading: true, error: null }));

      // 初始化 WASM
      await initCrypto();

      // 嘗試從 localStorage 載入已存在的金鑰
      const storedKeys = loadKeys();

      if (storedKeys) {
        // 還原金鑰
        const identity = Identity.fromPrivateKey(fromBase64(storedKeys.identity.privateKey));
        const signedPreKey = SignedPreKey.fromPrivateKey(
          fromBase64(storedKeys.signedPreKey.privateKey),
          storedKeys.signedPreKey.id,
          fromBase64(storedKeys.signedPreKey.signature),
          storedKeys.signedPreKey.timestamp
        );
        const oneTimePreKeys = storedKeys.oneTimePreKeys.map((k) =>
          OneTimePreKey.fromPrivateKey(fromBase64(k.privateKey), k.id)
        );

        setState((s) => ({
          ...s,
          initialized: true,
          loading: false,
          identity,
          signedPreKey,
          oneTimePreKeys,
          version: getCryptoVersion(),
        }));
      } else {
        setState((s) => ({
          ...s,
          initialized: true,
          loading: false,
          version: getCryptoVersion(),
        }));
      }
    } catch (error) {
      setState((s) => ({
        ...s,
        loading: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }));
    }
  }, []);

  /**
   * 生成新的身份金鑰
   */
  const generateIdentity = useCallback(() => {
    if (!state.initialized) {
      throw new Error('Crypto not initialized');
    }

    // 生成金鑰
    const identity = Identity.generate();
    const signedPreKey = SignedPreKey.generate(identity, 1);
    const oneTimePreKeys = Array.from({ length: 10 }, (_, i) =>
      OneTimePreKey.generate(i + 1)
    );

    // 儲存金鑰
    saveKeys({
      identity: {
        publicKey: identity.publicKeyBase64,
        privateKey: toBase64(identity.privateKey),
      },
      signedPreKey: {
        id: signedPreKey.id,
        publicKey: signedPreKey.publicKeyBase64,
        privateKey: toBase64(signedPreKey.privateKey),
        signature: toBase64(signedPreKey.signature),
        timestamp: signedPreKey.timestamp,
      },
      oneTimePreKeys: oneTimePreKeys.map((k) => ({
        id: k.id,
        publicKey: k.publicKeyBase64,
        privateKey: toBase64(k.privateKey),
      })),
    });

    setState((s) => ({
      ...s,
      identity,
      signedPreKey,
      oneTimePreKeys,
    }));

    return identity.publicKeyBase64;
  }, [state.initialized]);

  /**
   * 取得 PreKeyBundle
   */
  const getPreKeyBundle = useCallback((): string | null => {
    const { identity, signedPreKey, oneTimePreKeys } = state;
    if (!identity || !signedPreKey) {
      return null;
    }

    const oneTimePreKey = oneTimePreKeys[0]; // 使用第一個可用的 OTP

    const bundleData: PreKeyBundleData = {
      identityKey: identity.publicKey,
      signedPreKey: {
        id: signedPreKey.id,
        publicKey: signedPreKey.publicKey,
        signature: signedPreKey.signature,
        timestamp: signedPreKey.timestamp,
      },
      oneTimePreKey: oneTimePreKey
        ? {
            id: oneTimePreKey.id,
            publicKey: oneTimePreKey.publicKey,
          }
        : undefined,
    };

    return createPreKeyBundle(bundleData);
  }, [state]);

  /**
   * 建立與對方的會話 (作為發起者)
   */
  const createSession = useCallback(
    (
      recipientIdentityPublic: Uint8Array,
      recipientSignedPrekeyPublic: Uint8Array,
      recipientSignedPrekeySignature: Uint8Array,
      recipientOneTimePrekeyPublic?: Uint8Array,
      recipientOneTimePrekeyId?: number
    ) => {
      const { identity, signedPreKey } = state;
      if (!identity || !signedPreKey) {
        throw new Error('Identity not initialized');
      }

      // 執行 X3DH
      const x3dhResult = x3dhInitiator(
        identity,
        recipientIdentityPublic,
        recipientSignedPrekeyPublic,
        recipientSignedPrekeySignature,
        recipientOneTimePrekeyPublic,
        recipientOneTimePrekeyId
      );

      // 建立 Double Ratchet 會話
      const session = Session.initAsAlice(
        x3dhResult.sharedSecret,
        recipientSignedPrekeyPublic
      );

      // 儲存會話
      const recipientKeyBase64 = toBase64(recipientIdentityPublic);
      setState((s) => {
        const newSessions = new Map(s.sessions);
        newSessions.set(recipientKeyBase64, session);
        return { ...s, sessions: newSessions };
      });

      return {
        session,
        x3dhResult,
      };
    },
    [state]
  );

  /**
   * 接受對方建立的會話 (作為接收者)
   */
  const acceptSession = useCallback(
    (
      senderIdentityPublic: Uint8Array,
      senderEphemeralPublic: Uint8Array,
      usedOneTimePrekeyId?: number
    ) => {
      const { identity, signedPreKey, oneTimePreKeys } = state;
      if (!identity || !signedPreKey) {
        throw new Error('Identity not initialized');
      }

      // 找到使用的 OTP
      let usedOTP: OneTimePreKey | null = null;
      if (usedOneTimePrekeyId !== undefined) {
        const otpIndex = oneTimePreKeys.findIndex(
          (k) => k.id === usedOneTimePrekeyId
        );
        if (otpIndex >= 0) {
          usedOTP = oneTimePreKeys[otpIndex];
          // 從列表中移除已使用的 OTP
          setState((s) => ({
            ...s,
            oneTimePreKeys: s.oneTimePreKeys.filter(
              (k) => k.id !== usedOneTimePrekeyId
            ),
          }));
        }
      }

      // 執行 X3DH
      const sharedSecret = x3dhResponder(
        identity,
        signedPreKey,
        usedOTP,
        senderIdentityPublic,
        senderEphemeralPublic
      );

      // 建立 Double Ratchet 會話（傳入 Alice 的臨時公鑰以支援雙向通訊）
      const session = Session.initAsBob(
        sharedSecret,
        signedPreKey.privateKey,
        signedPreKey.publicKey,
        senderEphemeralPublic
      );

      // 儲存會話
      const senderKeyBase64 = toBase64(senderIdentityPublic);
      setState((s) => {
        const newSessions = new Map(s.sessions);
        newSessions.set(senderKeyBase64, session);
        return { ...s, sessions: newSessions };
      });

      return session;
    },
    [state]
  );

  /**
   * 加密訊息
   */
  const encrypt = useCallback(
    (recipientPublicKeyBase64: string, plaintext: string): RatchetMessage => {
      const session = state.sessions.get(recipientPublicKeyBase64);
      if (!session) {
        throw new Error('No session with this recipient');
      }
      return session.encrypt(plaintext);
    },
    [state.sessions]
  );

  /**
   * 解密訊息
   */
  const decrypt = useCallback(
    (senderPublicKeyBase64: string, message: RatchetMessage): string => {
      const session = state.sessions.get(senderPublicKeyBase64);
      if (!session) {
        throw new Error('No session with this sender');
      }
      return session.decryptToString(message);
    },
    [state.sessions]
  );

  /**
   * 清除所有金鑰
   */
  const clearKeys = useCallback(() => {
    // 釋放記憶體
    state.identity?.free();
    state.signedPreKey?.free();
    state.oneTimePreKeys.forEach((k) => k.free());
    state.sessions.forEach((s) => s.free());

    // 清除儲存
    localStorage.removeItem(STORAGE_KEY);

    setState((s) => ({
      ...s,
      identity: null,
      signedPreKey: null,
      oneTimePreKeys: [],
      sessions: new Map(),
    }));
  }, [state]);

  // 自動初始化
  useEffect(() => {
    initialize();

    // 清理函式
    return () => {
      state.identity?.free();
      state.signedPreKey?.free();
      state.oneTimePreKeys.forEach((k) => k.free());
      state.sessions.forEach((s) => s.free());
    };
  }, []);

  return {
    // 狀態
    initialized: state.initialized,
    isInitialized: state.initialized, // 別名
    loading: state.loading,
    error: state.error,
    version: state.version,
    hasIdentity: !!state.identity,
    identity: state.identity, // 暴露完整身份物件 (用於驗證簽章)
    signedPreKey: state.signedPreKey, // 暴露 SignedPreKey (用於 QR Code)
    publicKeyBase64: state.identity?.publicKeyBase64 ?? null,

    // 金鑰管理
    generateIdentity,
    getPreKeyBundle,
    clearKeys,

    // 會話管理
    createSession,
    acceptSession,

    // 加解密
    encrypt,
    decrypt,
  };
}

// ============================================
// 金鑰儲存輔助函式
// ============================================

function saveKeys(keys: StoredKeys): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(keys));
  } catch (error) {
    console.error('Failed to save keys:', error);
  }
}

function loadKeys(): StoredKeys | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Failed to load keys:', error);
    return null;
  }
}

export default useCrypto;
