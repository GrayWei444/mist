/**
 * Auth Service - PIN 碼驗證服務
 *
 * 處理 PIN 碼的設定、驗證與安全儲存
 * 使用 PBKDF2 派生密鑰來驗證 PIN
 */

// 儲存鍵名
const STORAGE_KEYS = {
  PIN_HASH: 'mist_pin_hash',
  PIN_SALT: 'mist_pin_salt',
  FAILED_ATTEMPTS: 'mist_failed_attempts',
  LOCKOUT_UNTIL: 'mist_lockout_until',
};

// 配置
const CONFIG = {
  PIN_LENGTH: 6,
  MAX_ATTEMPTS: 5,
  LOCKOUT_DURATION: 5 * 60 * 1000, // 5 分鐘
  PBKDF2_ITERATIONS: 100000,
  HASH_LENGTH: 32,
};

/**
 * 將 ArrayBuffer 轉換為 Base64 字串
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * 將 Base64 字串轉換為 ArrayBuffer
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * 使用 PBKDF2 派生密鑰
 */
async function deriveKey(pin: string, salt: ArrayBuffer): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const pinData = encoder.encode(pin);

  // 導入 PIN 作為密鑰材料
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    pinData,
    'PBKDF2',
    false,
    ['deriveBits']
  );

  // 使用 PBKDF2 派生位元
  const derivedBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: CONFIG.PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    CONFIG.HASH_LENGTH * 8
  );

  return derivedBits;
}

/**
 * 生成隨機鹽值
 */
function generateSalt(): ArrayBuffer {
  return crypto.getRandomValues(new Uint8Array(16)).buffer;
}

/**
 * 安全比較兩個 ArrayBuffer
 */
function secureCompare(a: ArrayBuffer, b: ArrayBuffer): boolean {
  const viewA = new Uint8Array(a);
  const viewB = new Uint8Array(b);

  if (viewA.length !== viewB.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < viewA.length; i++) {
    result |= viewA[i] ^ viewB[i];
  }

  return result === 0;
}

/**
 * Auth 服務
 */
class AuthService {
  /**
   * 檢查是否已設定 PIN
   */
  async hasPin(): Promise<boolean> {
    const hash = localStorage.getItem(STORAGE_KEYS.PIN_HASH);
    const salt = localStorage.getItem(STORAGE_KEYS.PIN_SALT);
    return !!(hash && salt);
  }

  /**
   * 設定 PIN 碼
   */
  async setPin(pin: string): Promise<void> {
    if (pin.length !== CONFIG.PIN_LENGTH) {
      throw new Error(`PIN must be ${CONFIG.PIN_LENGTH} digits`);
    }

    if (!/^\d+$/.test(pin)) {
      throw new Error('PIN must contain only digits');
    }

    // 生成鹽值
    const salt = generateSalt();

    // 派生密鑰雜湊
    const hash = await deriveKey(pin, salt);

    // 儲存
    localStorage.setItem(STORAGE_KEYS.PIN_HASH, arrayBufferToBase64(hash));
    localStorage.setItem(STORAGE_KEYS.PIN_SALT, arrayBufferToBase64(salt));

    // 重置失敗計數
    this.resetFailedAttempts();

    console.log('[Auth] PIN set successfully');
  }

  /**
   * 驗證 PIN 碼
   */
  async verifyPin(pin: string): Promise<boolean> {
    // 檢查是否被鎖定
    if (this.isLockedOut()) {
      console.warn('[Auth] Account is locked out');
      return false;
    }

    const storedHash = localStorage.getItem(STORAGE_KEYS.PIN_HASH);
    const storedSalt = localStorage.getItem(STORAGE_KEYS.PIN_SALT);

    if (!storedHash || !storedSalt) {
      console.error('[Auth] No PIN set');
      return false;
    }

    try {
      const salt = base64ToArrayBuffer(storedSalt);
      const hash = await deriveKey(pin, salt);
      const expectedHash = base64ToArrayBuffer(storedHash);

      const isValid = secureCompare(hash, expectedHash);

      if (isValid) {
        this.resetFailedAttempts();
        console.log('[Auth] PIN verified successfully');
        return true;
      } else {
        this.incrementFailedAttempts();
        console.warn('[Auth] Invalid PIN');
        return false;
      }
    } catch (error) {
      console.error('[Auth] Verification error:', error);
      return false;
    }
  }

  /**
   * 取得失敗次數
   */
  getFailedAttempts(): number {
    const attempts = localStorage.getItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    return attempts ? parseInt(attempts, 10) : 0;
  }

  /**
   * 增加失敗次數
   */
  private incrementFailedAttempts(): void {
    const attempts = this.getFailedAttempts() + 1;
    localStorage.setItem(STORAGE_KEYS.FAILED_ATTEMPTS, attempts.toString());

    if (attempts >= CONFIG.MAX_ATTEMPTS) {
      const lockoutUntil = Date.now() + CONFIG.LOCKOUT_DURATION;
      localStorage.setItem(STORAGE_KEYS.LOCKOUT_UNTIL, lockoutUntil.toString());
      console.warn('[Auth] Account locked due to too many failed attempts');
    }
  }

  /**
   * 重置失敗次數
   */
  private resetFailedAttempts(): void {
    localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
  }

  /**
   * 檢查是否被鎖定
   */
  isLockedOut(): boolean {
    const lockoutUntil = localStorage.getItem(STORAGE_KEYS.LOCKOUT_UNTIL);
    if (!lockoutUntil) {
      return false;
    }

    const lockoutTime = parseInt(lockoutUntil, 10);
    if (Date.now() >= lockoutTime) {
      // 鎖定已過期，重置
      this.resetFailedAttempts();
      return false;
    }

    return true;
  }

  /**
   * 取得鎖定剩餘時間（毫秒）
   */
  getLockoutRemaining(): number {
    const lockoutUntil = localStorage.getItem(STORAGE_KEYS.LOCKOUT_UNTIL);
    if (!lockoutUntil) {
      return 0;
    }

    const remaining = parseInt(lockoutUntil, 10) - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * 清除所有認證資料（危險操作）
   */
  async clearAll(): Promise<void> {
    localStorage.removeItem(STORAGE_KEYS.PIN_HASH);
    localStorage.removeItem(STORAGE_KEYS.PIN_SALT);
    localStorage.removeItem(STORAGE_KEYS.FAILED_ATTEMPTS);
    localStorage.removeItem(STORAGE_KEYS.LOCKOUT_UNTIL);
    console.log('[Auth] All auth data cleared');
  }

  /**
   * 變更 PIN 碼
   */
  async changePin(oldPin: string, newPin: string): Promise<boolean> {
    const isValid = await this.verifyPin(oldPin);
    if (!isValid) {
      return false;
    }

    await this.setPin(newPin);
    return true;
  }

  /**
   * 使用 PIN 派生加密金鑰（用於加密私鑰）
   */
  async deriveEncryptionKey(pin: string): Promise<CryptoKey> {
    const storedSalt = localStorage.getItem(STORAGE_KEYS.PIN_SALT);
    if (!storedSalt) {
      throw new Error('No PIN set');
    }

    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    const salt = base64ToArrayBuffer(storedSalt);

    // 導入 PIN 作為密鑰材料
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      pinData,
      'PBKDF2',
      false,
      ['deriveKey']
    );

    // 派生 AES-GCM 金鑰
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: CONFIG.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );

    return key;
  }
}

// 單例導出
export const authService = new AuthService();
export default authService;
