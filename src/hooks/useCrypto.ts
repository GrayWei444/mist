/**
 * useCrypto Hook - 加密功能 React Hook
 *
 * 提供 WASM 加密模組的 React 整合
 */

import { useState, useEffect, useCallback, useRef } from 'react';
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
  version: string | null;
}

// Session 儲存 key
const SESSIONS_STORAGE_KEY = 'mist_sessions';

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
    version: null,
  });

  // 使用 ref 存儲 sessions，避免 React state 更新延遲問題
  // 這樣 session 的存取是同步的，不會有 race condition
  const sessionsRef = useRef<Map<string, Session>>(new Map());

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

        // 還原 sessions
        restoreSessions(sessionsRef);

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

      // 儲存會話到 ref（同步，立即可用）
      const recipientKeyBase64 = toBase64(recipientIdentityPublic);
      sessionsRef.current.set(recipientKeyBase64, session);
      console.log('[useCrypto] Session created (as Alice) for:', recipientKeyBase64.slice(0, 16) + '...');
      console.log('[useCrypto] Total sessions:', sessionsRef.current.size);

      // 持久化 session
      saveSession(recipientKeyBase64, session);

      return {
        session,
        x3dhResult,
      };
    },
    [state.identity, state.signedPreKey]
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

      // 儲存會話到 ref（同步，立即可用）
      const senderKeyBase64 = toBase64(senderIdentityPublic);
      sessionsRef.current.set(senderKeyBase64, session);
      console.log('[useCrypto] Session created (as Bob) for:', senderKeyBase64.slice(0, 16) + '...');
      console.log('[useCrypto] Total sessions:', sessionsRef.current.size);

      // 持久化 session
      saveSession(senderKeyBase64, session);

      return session;
    },
    [state.identity, state.signedPreKey, state.oneTimePreKeys]
  );

  /**
   * 加密訊息
   */
  const encrypt = useCallback(
    (recipientPublicKeyBase64: string, plaintext: string): RatchetMessage => {
      const session = sessionsRef.current.get(recipientPublicKeyBase64);
      if (!session) {
        console.error('[useCrypto] No session for encrypt. Looking for:', recipientPublicKeyBase64.slice(0, 16) + '...');
        console.error('[useCrypto] Available sessions:', Array.from(sessionsRef.current.keys()).map(k => k.slice(0, 16) + '...'));
        throw new Error('No session with this recipient');
      }
      const encrypted = session.encrypt(plaintext);
      // 加密後更新持久化（ratchet 狀態已改變）
      saveSession(recipientPublicKeyBase64, session);
      return encrypted;
    },
    [] // 不依賴 state，使用 ref
  );

  /**
   * 解密訊息
   */
  const decrypt = useCallback(
    (senderPublicKeyBase64: string, message: RatchetMessage): string => {
      console.log('[useCrypto] decrypt() called for:', senderPublicKeyBase64.slice(0, 16) + '...');
      console.log('[useCrypto] Current sessions count:', sessionsRef.current.size);
      console.log('[useCrypto] Session keys:', Array.from(sessionsRef.current.keys()).map(k => k.slice(0, 16) + '...'));

      const session = sessionsRef.current.get(senderPublicKeyBase64);
      if (!session) {
        console.error('[useCrypto] No session for decrypt. Looking for:', senderPublicKeyBase64.slice(0, 16) + '...');
        console.error('[useCrypto] Available sessions:', Array.from(sessionsRef.current.keys()).map(k => k.slice(0, 16) + '...'));
        throw new Error('No session with this sender');
      }

      console.log('[useCrypto] Session found, attempting decrypt...');
      try {
        const decrypted = session.decryptToString(message);
        console.log('[useCrypto] Decrypt successful!');
        // 解密後更新持久化（ratchet 狀態已改變）
        saveSession(senderPublicKeyBase64, session);
        return decrypted;
      } catch (err) {
        console.error('[useCrypto] Decrypt FAILED:', err);
        console.error('[useCrypto] Session myPublicKey:', session.myPublicKeyBase64?.slice(0, 16) + '...');
        throw err;
      }
    },
    [] // 不依賴 state，使用 ref
  );

  /**
   * 清除所有金鑰
   */
  const clearKeys = useCallback(() => {
    // 釋放記憶體
    state.identity?.free();
    state.signedPreKey?.free();
    state.oneTimePreKeys.forEach((k) => k.free());
    sessionsRef.current.forEach((s) => s.free());

    // 清除儲存
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SESSIONS_STORAGE_KEY);

    // 清空 sessions ref
    sessionsRef.current = new Map();

    setState((s) => ({
      ...s,
      identity: null,
      signedPreKey: null,
      oneTimePreKeys: [],
    }));
  }, [state.identity, state.signedPreKey, state.oneTimePreKeys]);

  // 自動初始化
  useEffect(() => {
    initialize();

    // 清理函式
    return () => {
      state.identity?.free();
      state.signedPreKey?.free();
      state.oneTimePreKeys.forEach((k) => k.free());
      sessionsRef.current.forEach((s) => s.free());
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

// ============================================
// Session 儲存輔助函式
// ============================================

interface StoredSessions {
  [publicKeyBase64: string]: string; // Base64 encoded serialized session
}

function saveSession(publicKeyBase64: string, session: Session): void {
  try {
    const serialized = session.serialize();
    const base64 = toBase64(serialized);

    const stored = loadAllSessions();
    stored[publicKeyBase64] = base64;
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(stored));
    console.log('[useCrypto] Session saved for:', publicKeyBase64.slice(0, 16) + '...');
  } catch (error) {
    console.error('[useCrypto] Failed to save session:', error);
  }
}

function loadAllSessions(): StoredSessions {
  try {
    const data = localStorage.getItem(SESSIONS_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('[useCrypto] Failed to load sessions:', error);
    return {};
  }
}

function restoreSessions(sessionsRef: React.MutableRefObject<Map<string, Session>>): void {
  try {
    const stored = loadAllSessions();
    const entries = Object.entries(stored);

    if (entries.length === 0) {
      console.log('[useCrypto] No stored sessions to restore');
      return;
    }

    for (const [publicKeyBase64, base64Data] of entries) {
      try {
        const bytes = fromBase64(base64Data);
        const session = Session.deserialize(bytes);
        sessionsRef.current.set(publicKeyBase64, session);
        console.log('[useCrypto] Session restored for:', publicKeyBase64.slice(0, 16) + '...');
      } catch (err) {
        console.error('[useCrypto] Failed to restore session for:', publicKeyBase64.slice(0, 16), err);
        // 移除損壞的 session
        const stored = loadAllSessions();
        delete stored[publicKeyBase64];
        localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(stored));
      }
    }

    console.log('[useCrypto] Restored', sessionsRef.current.size, 'sessions');
  } catch (error) {
    console.error('[useCrypto] Failed to restore sessions:', error);
  }
}

export default useCrypto;
