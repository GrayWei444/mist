/**
 * WebAuthn Service - 生物辨識認證
 *
 * 使用 WebAuthn API 提供生物辨識認證功能
 * 支援指紋、Face ID 等裝置原生認證方式
 */

// WebAuthn 設定
const WEBAUTHN_CONFIG = {
  // 應用程式資訊
  rpName: 'Mist',
  rpId: typeof window !== 'undefined' ? window.location.hostname : 'localhost',
  // 認證器要求
  authenticatorAttachment: 'platform' as AuthenticatorAttachment, // 使用裝置內建認證器
  userVerification: 'required' as UserVerificationRequirement,
  // 超時設定 (毫秒)
  timeout: 60000,
};

// 憑證儲存鍵
const CREDENTIAL_STORAGE_KEY = 'mist_webauthn_credential';

// 憑證資訊
export interface StoredCredential {
  credentialId: string; // Base64
  publicKey: string; // Base64 (COSE 格式)
  userId: string;
  createdAt: number;
  lastUsed: number;
}

// 認證結果
export interface AuthResult {
  success: boolean;
  userId?: string;
  error?: string;
}

/**
 * 檢查瀏覽器是否支援 WebAuthn
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  );
}

/**
 * 檢查裝置是否有可用的生物辨識認證器
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

/**
 * 產生隨機 Challenge
 */
function generateChallenge(): Uint8Array {
  const challenge = new Uint8Array(32);
  crypto.getRandomValues(challenge);
  return challenge;
}

/**
 * ArrayBuffer 轉 Base64
 */
function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Base64 轉 ArrayBuffer
 */
function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 註冊新的生物辨識憑證
 *
 * @param userId - 使用者 ID (公鑰 Base64)
 * @param userName - 使用者顯示名稱
 */
export async function registerCredential(
  userId: string,
  userName: string = 'Mist User'
): Promise<StoredCredential> {
  if (!isWebAuthnSupported()) {
    throw new Error('WebAuthn is not supported in this browser');
  }

  const available = await isPlatformAuthenticatorAvailable();
  if (!available) {
    throw new Error('No platform authenticator available');
  }

  const challenge = generateChallenge();
  const userIdBytes = new TextEncoder().encode(userId);

  // 建立憑證選項
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rp: {
      name: WEBAUTHN_CONFIG.rpName,
      id: WEBAUTHN_CONFIG.rpId,
    },
    user: {
      id: userIdBytes.buffer as ArrayBuffer,
      name: userName,
      displayName: userName,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' }, // ES256
      { alg: -257, type: 'public-key' }, // RS256
    ],
    authenticatorSelection: {
      authenticatorAttachment: WEBAUTHN_CONFIG.authenticatorAttachment,
      userVerification: WEBAUTHN_CONFIG.userVerification,
      residentKey: 'preferred',
    },
    timeout: WEBAUTHN_CONFIG.timeout,
    attestation: 'none', // 不需要 attestation
  };

  try {
    // 呼叫 WebAuthn API 建立憑證
    const credential = (await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions,
    })) as PublicKeyCredential;

    if (!credential) {
      throw new Error('Failed to create credential');
    }

    const response = credential.response as AuthenticatorAttestationResponse;

    // 儲存憑證資訊
    const storedCredential: StoredCredential = {
      credentialId: bufferToBase64(credential.rawId),
      publicKey: bufferToBase64(response.getPublicKey()!),
      userId,
      createdAt: Date.now(),
      lastUsed: Date.now(),
    };

    // 儲存到 localStorage
    saveCredential(storedCredential);

    console.log('[WebAuthn] Credential registered successfully');
    return storedCredential;
  } catch (error) {
    console.error('[WebAuthn] Registration failed:', error);
    throw error;
  }
}

/**
 * 使用生物辨識進行認證
 */
export async function authenticate(): Promise<AuthResult> {
  if (!isWebAuthnSupported()) {
    return { success: false, error: 'WebAuthn is not supported' };
  }

  const storedCredential = loadCredential();
  if (!storedCredential) {
    return { success: false, error: 'No registered credential found' };
  }

  const challenge = generateChallenge();

  // 建立認證選項
  const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
    challenge: challenge.buffer as ArrayBuffer,
    rpId: WEBAUTHN_CONFIG.rpId,
    allowCredentials: [
      {
        id: base64ToBuffer(storedCredential.credentialId),
        type: 'public-key',
        transports: ['internal'],
      },
    ],
    userVerification: WEBAUTHN_CONFIG.userVerification,
    timeout: WEBAUTHN_CONFIG.timeout,
  };

  try {
    // 呼叫 WebAuthn API 進行認證
    const assertion = (await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions,
    })) as PublicKeyCredential;

    if (!assertion) {
      return { success: false, error: 'Authentication cancelled' };
    }

    // 更新最後使用時間
    storedCredential.lastUsed = Date.now();
    saveCredential(storedCredential);

    console.log('[WebAuthn] Authentication successful');
    return {
      success: true,
      userId: storedCredential.userId,
    };
  } catch (error) {
    console.error('[WebAuthn] Authentication failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Authentication failed',
    };
  }
}

/**
 * 檢查是否已註冊憑證
 */
export function hasRegisteredCredential(): boolean {
  return loadCredential() !== null;
}

/**
 * 取得已儲存的憑證
 */
export function getStoredCredential(): StoredCredential | null {
  return loadCredential();
}

/**
 * 刪除已註冊的憑證
 */
export function deleteCredential(): void {
  localStorage.removeItem(CREDENTIAL_STORAGE_KEY);
  console.log('[WebAuthn] Credential deleted');
}

/**
 * 儲存憑證到 localStorage
 */
function saveCredential(credential: StoredCredential): void {
  try {
    localStorage.setItem(CREDENTIAL_STORAGE_KEY, JSON.stringify(credential));
  } catch (error) {
    console.error('[WebAuthn] Failed to save credential:', error);
  }
}

/**
 * 從 localStorage 載入憑證
 */
function loadCredential(): StoredCredential | null {
  try {
    const data = localStorage.getItem(CREDENTIAL_STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('[WebAuthn] Failed to load credential:', error);
    return null;
  }
}

// ============================================
// WebAuthn Service Class
// ============================================

/**
 * WebAuthn 服務類別
 */
class WebAuthnService {
  private _isSupported: boolean | null = null;
  private _isAvailable: boolean | null = null;

  /**
   * 檢查是否支援
   */
  get isSupported(): boolean {
    if (this._isSupported === null) {
      this._isSupported = isWebAuthnSupported();
    }
    return this._isSupported;
  }

  /**
   * 檢查平台認證器是否可用
   */
  async checkAvailability(): Promise<boolean> {
    if (this._isAvailable === null) {
      this._isAvailable = await isPlatformAuthenticatorAvailable();
    }
    return this._isAvailable;
  }

  /**
   * 註冊憑證
   */
  async register(userId: string, userName?: string): Promise<StoredCredential> {
    return registerCredential(userId, userName);
  }

  /**
   * 認證
   */
  async authenticate(): Promise<AuthResult> {
    return authenticate();
  }

  /**
   * 是否已註冊
   */
  get hasCredential(): boolean {
    return hasRegisteredCredential();
  }

  /**
   * 取得憑證
   */
  get credential(): StoredCredential | null {
    return getStoredCredential();
  }

  /**
   * 刪除憑證
   */
  delete(): void {
    deleteCredential();
  }
}

// 單例導出
export const webauthnService = new WebAuthnService();

export default webauthnService;
