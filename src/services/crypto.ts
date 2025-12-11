/**
 * Crypto Service - WASM 加密模組封裝
 *
 * 提供 TypeScript 友好的介面來使用 Rust WASM 加密功能
 */

import init, {
  IdentityKeyPair,
  X25519KeyPair,
  X3DH,
  X3DHSenderOutput,
  X3DHInitialMessage,
  RatchetSession,
  RatchetMessage,
  AesGcmCipher,
  EncryptedMessage,
  aesEncrypt,
  aesDecrypt,
  signPreKey,
  createPreKeyBundleJson,
  randomBytes,
  base64Encode,
  base64Decode,
  version,
} from '../wasm/pkg/safetalk_core';

// Re-export types
export type {
  X3DHSenderOutput,
  X3DHInitialMessage,
  RatchetMessage,
  EncryptedMessage,
};

// WASM 初始化狀態
let wasmInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 初始化 WASM 模組
 * 必須在使用任何加密功能前調用
 */
export async function initCrypto(): Promise<void> {
  if (wasmInitialized) return;

  if (initPromise) {
    await initPromise;
    return;
  }

  initPromise = (async () => {
    await init();
    wasmInitialized = true;
    console.log(`[Crypto] WASM initialized, version: ${version()}`);
  })();

  await initPromise;
}

/**
 * 確保 WASM 已初始化
 */
function ensureInitialized(): void {
  if (!wasmInitialized) {
    throw new Error('Crypto module not initialized. Call initCrypto() first.');
  }
}

// ============================================
// 金鑰管理
// ============================================

/**
 * 身份金鑰對 (Ed25519)
 * 用於簽章和身份驗證，長期使用
 */
export class Identity {
  private keyPair: IdentityKeyPair;

  private constructor(keyPair: IdentityKeyPair) {
    this.keyPair = keyPair;
  }

  /**
   * 生成新的身份金鑰對
   */
  static generate(): Identity {
    ensureInitialized();
    return new Identity(new IdentityKeyPair());
  }

  /**
   * 從私鑰還原
   */
  static fromPrivateKey(privateKey: Uint8Array): Identity {
    ensureInitialized();
    return new Identity(IdentityKeyPair.fromBytes(privateKey));
  }

  /**
   * 取得公鑰 (Base64)
   */
  get publicKeyBase64(): string {
    return this.keyPair.publicKeyBase64();
  }

  /**
   * 取得公鑰位元組
   */
  get publicKey(): Uint8Array {
    return this.keyPair.publicKeyBytes();
  }

  /**
   * 取得私鑰位元組 (敏感！僅用於備份)
   */
  get privateKey(): Uint8Array {
    return this.keyPair.privateKeyBytes();
  }

  /**
   * 簽署訊息
   */
  sign(message: Uint8Array): Uint8Array {
    return this.keyPair.sign(message);
  }

  /**
   * 驗證簽章
   */
  static verify(publicKey: Uint8Array, message: Uint8Array, signature: Uint8Array): boolean {
    ensureInitialized();
    return IdentityKeyPair.verifySignature(publicKey, message, signature);
  }

  /**
   * 釋放資源
   */
  free(): void {
    this.keyPair.free();
  }
}

/**
 * 預簽署金鑰 (Signed PreKey)
 * 中期使用的 X25519 金鑰，附帶身份金鑰簽章
 */
export class SignedPreKey {
  private keyPair: X25519KeyPair;
  public readonly id: number;
  public readonly signature: Uint8Array;
  public readonly timestamp: number;

  private constructor(
    keyPair: X25519KeyPair,
    id: number,
    signature: Uint8Array,
    timestamp: number
  ) {
    this.keyPair = keyPair;
    this.id = id;
    this.signature = signature;
    this.timestamp = timestamp;
  }

  /**
   * 生成新的簽署預金鑰
   */
  static generate(identity: Identity, id: number): SignedPreKey {
    ensureInitialized();
    const keyPair = new X25519KeyPair();
    const publicKey = keyPair.publicKeyBytes();
    const signature = signPreKey(identity.privateKey, publicKey);
    const timestamp = Date.now();
    return new SignedPreKey(keyPair, id, signature, timestamp);
  }

  /**
   * 從私鑰還原
   */
  static fromPrivateKey(
    privateKey: Uint8Array,
    id: number,
    signature: Uint8Array,
    timestamp: number
  ): SignedPreKey {
    ensureInitialized();
    const keyPair = X25519KeyPair.fromBytes(privateKey);
    return new SignedPreKey(keyPair, id, signature, timestamp);
  }

  get publicKey(): Uint8Array {
    return this.keyPair.publicKeyBytes();
  }

  get publicKeyBase64(): string {
    return this.keyPair.publicKeyBase64();
  }

  get signatureBase64(): string {
    return toBase64(this.signature);
  }

  get privateKey(): Uint8Array {
    return this.keyPair.privateKeyBytes();
  }

  free(): void {
    this.keyPair.free();
  }
}

/**
 * 一次性預金鑰 (One-Time PreKey)
 * 用完即丟的 X25519 金鑰
 */
export class OneTimePreKey {
  private keyPair: X25519KeyPair;
  public readonly id: number;

  private constructor(keyPair: X25519KeyPair, id: number) {
    this.keyPair = keyPair;
    this.id = id;
  }

  /**
   * 生成新的一次性預金鑰
   */
  static generate(id: number): OneTimePreKey {
    ensureInitialized();
    return new OneTimePreKey(new X25519KeyPair(), id);
  }

  /**
   * 從私鑰還原
   */
  static fromPrivateKey(privateKey: Uint8Array, id: number): OneTimePreKey {
    ensureInitialized();
    return new OneTimePreKey(X25519KeyPair.fromBytes(privateKey), id);
  }

  get publicKey(): Uint8Array {
    return this.keyPair.publicKeyBytes();
  }

  get publicKeyBase64(): string {
    return this.keyPair.publicKeyBase64();
  }

  get privateKey(): Uint8Array {
    return this.keyPair.privateKeyBytes();
  }

  free(): void {
    this.keyPair.free();
  }
}

// ============================================
// PreKeyBundle
// ============================================

export interface PreKeyBundleData {
  identityKey: Uint8Array;
  signedPreKey: {
    id: number;
    publicKey: Uint8Array;
    signature: Uint8Array;
    timestamp: number;
  };
  oneTimePreKey?: {
    id: number;
    publicKey: Uint8Array;
  };
}

/**
 * 建立 PreKeyBundle JSON
 */
export function createPreKeyBundle(data: PreKeyBundleData): string {
  ensureInitialized();
  return createPreKeyBundleJson(
    data.identityKey,
    data.signedPreKey.id,
    data.signedPreKey.publicKey,
    data.signedPreKey.signature,
    BigInt(data.signedPreKey.timestamp),
    data.oneTimePreKey?.id ?? null,
    data.oneTimePreKey?.publicKey ?? null
  );
}

// ============================================
// X3DH 金鑰交換
// ============================================

export interface X3DHResult {
  sharedSecret: Uint8Array;
  ephemeralPublicKey: Uint8Array;
  usedOneTimePrekeyId?: number;
}

/**
 * X3DH 發起者計算共享密鑰
 */
export function x3dhInitiator(
  senderIdentity: Identity,
  recipientIdentityPublic: Uint8Array,
  recipientSignedPrekeyPublic: Uint8Array,
  recipientSignedPrekeySignature: Uint8Array,
  recipientOneTimePrekeyPublic?: Uint8Array,
  recipientOneTimePrekeyId?: number
): X3DHResult {
  ensureInitialized();

  const output = X3DH.initiatorCalculate(
    senderIdentity.privateKey,
    recipientIdentityPublic,
    recipientSignedPrekeyPublic,
    recipientSignedPrekeySignature,
    recipientOneTimePrekeyPublic ?? null,
    recipientOneTimePrekeyId ?? null
  );

  return {
    sharedSecret: output.sharedSecret,
    ephemeralPublicKey: output.ephemeralPublicKey,
    usedOneTimePrekeyId: output.usedOneTimePrekeyId,
  };
}

/**
 * X3DH 接收者計算共享密鑰
 */
export function x3dhResponder(
  recipientIdentity: Identity,
  recipientSignedPrekey: SignedPreKey,
  recipientOneTimePrekey: OneTimePreKey | null,
  senderIdentityPublic: Uint8Array,
  senderEphemeralPublic: Uint8Array
): Uint8Array {
  ensureInitialized();

  return X3DH.responderCalculate(
    recipientIdentity.privateKey,
    recipientSignedPrekey.privateKey,
    recipientOneTimePrekey?.privateKey ?? null,
    senderIdentityPublic,
    senderEphemeralPublic
  );
}

/**
 * 建立 X3DH 初始訊息
 */
export function createX3DHMessage(
  senderIdentityPublic: Uint8Array,
  ephemeralPublic: Uint8Array,
  oneTimePrekeyId?: number
): X3DHInitialMessage {
  ensureInitialized();
  return X3DH.createInitialMessage(
    senderIdentityPublic,
    ephemeralPublic,
    oneTimePrekeyId ?? null
  );
}

// ============================================
// Double Ratchet 會話
// ============================================

/**
 * Double Ratchet 會話管理器
 */
export class Session {
  private session: RatchetSession;

  private constructor(session: RatchetSession) {
    this.session = session;
  }

  /**
   * 發起者建立會話 (Alice)
   */
  static initAsAlice(sharedSecret: Uint8Array, remotePublicKey: Uint8Array): Session {
    ensureInitialized();
    return new Session(RatchetSession.initAsAlice(sharedSecret, remotePublicKey));
  }

  /**
   * 接收者建立會話 (Bob)
   */
  static initAsBob(
    sharedSecret: Uint8Array,
    signedPrekeyPrivate: Uint8Array,
    signedPrekeyPublic: Uint8Array
  ): Session {
    ensureInitialized();
    return new Session(
      RatchetSession.initAsBob(sharedSecret, signedPrekeyPrivate, signedPrekeyPublic)
    );
  }

  /**
   * 從序列化狀態還原
   */
  static deserialize(bytes: Uint8Array): Session {
    ensureInitialized();
    return new Session(RatchetSession.deserialize(bytes));
  }

  /**
   * 加密訊息
   */
  encrypt(plaintext: string | Uint8Array): RatchetMessage {
    const data = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;
    return this.session.encrypt(data);
  }

  /**
   * 解密訊息
   */
  decrypt(message: RatchetMessage): Uint8Array {
    return this.session.decrypt(message);
  }

  /**
   * 解密訊息為字串
   */
  decryptToString(message: RatchetMessage): string {
    const bytes = this.decrypt(message);
    return new TextDecoder().decode(bytes);
  }

  /**
   * 序列化會話狀態
   */
  serialize(): Uint8Array {
    return this.session.serialize();
  }

  /**
   * 取得我方當前 DH 公鑰
   */
  get myPublicKey(): Uint8Array {
    return this.session.myPublicKey;
  }

  /**
   * 取得我方當前 DH 公鑰 (Base64)
   */
  get myPublicKeyBase64(): string {
    return this.session.myPublicKeyBase64;
  }

  /**
   * 釋放資源
   */
  free(): void {
    this.session.free();
  }
}

// ============================================
// AES-256-GCM 加密
// ============================================

/**
 * AES-256-GCM 加密器
 */
export class AesCipher {
  private cipher: AesGcmCipher;

  constructor(key: Uint8Array) {
    ensureInitialized();
    if (key.length !== 32) {
      throw new Error('AES key must be 32 bytes');
    }
    this.cipher = new AesGcmCipher(key);
  }

  /**
   * 加密資料
   */
  encrypt(plaintext: string | Uint8Array): EncryptedMessage {
    const data = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;
    return this.cipher.encrypt(data);
  }

  /**
   * 加密資料 (附帶關聯資料)
   */
  encryptWithAad(plaintext: string | Uint8Array, aad: Uint8Array): EncryptedMessage {
    const data = typeof plaintext === 'string'
      ? new TextEncoder().encode(plaintext)
      : plaintext;
    return this.cipher.encryptWithAad(data, aad);
  }

  /**
   * 解密資料
   */
  decrypt(encrypted: EncryptedMessage): Uint8Array {
    return this.cipher.decrypt(encrypted);
  }

  /**
   * 解密資料為字串
   */
  decryptToString(encrypted: EncryptedMessage): string {
    const bytes = this.decrypt(encrypted);
    return new TextDecoder().decode(bytes);
  }

  /**
   * 解密資料 (附帶關聯資料)
   */
  decryptWithAad(encrypted: EncryptedMessage, aad: Uint8Array): Uint8Array {
    return this.cipher.decryptWithAad(encrypted, aad);
  }

  free(): void {
    this.cipher.free();
  }
}

/**
 * 快速加密函式
 */
export function quickEncrypt(key: Uint8Array, plaintext: string | Uint8Array): EncryptedMessage {
  ensureInitialized();
  const data = typeof plaintext === 'string'
    ? new TextEncoder().encode(plaintext)
    : plaintext;
  return aesEncrypt(key, data);
}

/**
 * 快速解密函式
 */
export function quickDecrypt(key: Uint8Array, encrypted: EncryptedMessage): Uint8Array {
  ensureInitialized();
  return aesDecrypt(key, encrypted);
}

// ============================================
// 工具函式
// ============================================

/**
 * 生成隨機位元組
 */
export function generateRandomBytes(length: number): Uint8Array {
  ensureInitialized();
  return randomBytes(length);
}

/**
 * 生成隨機 AES 金鑰 (32 bytes)
 */
export function generateAesKey(): Uint8Array {
  return generateRandomBytes(32);
}

/**
 * Base64 編碼
 */
export function toBase64(data: Uint8Array): string {
  ensureInitialized();
  return base64Encode(data);
}

/**
 * Base64 解碼
 */
export function fromBase64(data: string): Uint8Array {
  ensureInitialized();
  return base64Decode(data);
}

/**
 * 取得 WASM 版本
 */
export function getCryptoVersion(): string {
  ensureInitialized();
  return version();
}

// ============================================
// 預設導出
// ============================================

export default {
  initCrypto,
  Identity,
  SignedPreKey,
  OneTimePreKey,
  createPreKeyBundle,
  x3dhInitiator,
  x3dhResponder,
  createX3DHMessage,
  Session,
  AesCipher,
  quickEncrypt,
  quickDecrypt,
  generateRandomBytes,
  generateAesKey,
  toBase64,
  fromBase64,
  getCryptoVersion,
};
