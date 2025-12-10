/**
 * Verification Service - 好友驗證系統
 *
 * 提供 QR Code 驗證和一次性邀請連結功能
 * 實現分層信任機制
 */

import QRCode from 'qrcode';
import { Identity, toBase64, fromBase64, generateRandomBytes } from './crypto';

// 信任等級
export enum TrustLevel {
  UNVERIFIED = 'unverified', // 🟡 未驗證 (透過邀請連結)
  VERIFIED = 'verified', // 🟢 已驗證 (面對面 QR Code)
}

// 驗證資料結構
export interface VerificationData {
  // 公鑰 (Base64)
  publicKey: string;
  // 驗證碼 (用於配對確認)
  verificationCode: string;
  // 時間戳記
  timestamp: number;
  // 簽章 (Base64)
  signature: string;
}

// 邀請連結資料
export interface InviteData {
  // 邀請者公鑰 (Base64)
  inviterPublicKey: string;
  // 一次性邀請碼
  inviteCode: string;
  // 過期時間
  expiresAt: number;
  // 簽章 (Base64)
  signature: string;
}

// 好友資訊
export interface FriendInfo {
  publicKey: string;
  nickname?: string;
  avatar?: string;
  trustLevel: TrustLevel;
  addedAt: number;
  verifiedAt?: number;
}

// 邀請連結有效期 (24 小時)
const INVITE_EXPIRY = 24 * 60 * 60 * 1000;

// QR Code 有效期 (5 分鐘)
const QR_CODE_EXPIRY = 5 * 60 * 1000;

/**
 * 產生驗證碼 (6 位數字)
 */
function generateVerificationCode(): string {
  const bytes = generateRandomBytes(3);
  const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return String(num % 1000000).padStart(6, '0');
}

/**
 * 產生邀請碼 (16 字元)
 */
function generateInviteCode(): string {
  const bytes = generateRandomBytes(12);
  return toBase64(bytes).replace(/[+/=]/g, '').slice(0, 16);
}

/**
 * 建立驗證資料 (用於 QR Code)
 */
export function createVerificationData(identity: Identity): VerificationData {
  const publicKey = identity.publicKeyBase64;
  const verificationCode = generateVerificationCode();
  const timestamp = Date.now();

  // 簽署驗證資料
  const dataToSign = `${publicKey}:${verificationCode}:${timestamp}`;
  const signature = toBase64(identity.sign(new TextEncoder().encode(dataToSign)));

  return {
    publicKey,
    verificationCode,
    timestamp,
    signature,
  };
}

/**
 * 驗證驗證資料
 */
export function verifyVerificationData(
  data: VerificationData,
  expectedPublicKey?: Uint8Array
): boolean {
  try {
    // 檢查是否過期
    if (Date.now() - data.timestamp > QR_CODE_EXPIRY) {
      console.warn('[Verification] QR code expired');
      return false;
    }

    // 驗證簽章
    const publicKey = fromBase64(data.publicKey);
    const dataToVerify = `${data.publicKey}:${data.verificationCode}:${data.timestamp}`;
    const signature = fromBase64(data.signature);

    const isValid = Identity.verify(
      publicKey,
      new TextEncoder().encode(dataToVerify),
      signature
    );

    if (!isValid) {
      console.warn('[Verification] Invalid signature');
      return false;
    }

    // 如果提供了預期公鑰，進行比對
    if (expectedPublicKey) {
      const receivedKey = fromBase64(data.publicKey);
      if (toBase64(receivedKey) !== toBase64(expectedPublicKey)) {
        console.warn('[Verification] Public key mismatch');
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error('[Verification] Verification failed:', error);
    return false;
  }
}

/**
 * 產生驗證 QR Code (Base64 Data URL)
 */
export async function generateVerificationQRCode(
  identity: Identity,
  size: number = 256
): Promise<{ qrCode: string; verificationCode: string; data: VerificationData }> {
  const data = createVerificationData(identity);
  const jsonData = JSON.stringify(data);

  // 產生 QR Code
  const qrCode = await QRCode.toDataURL(jsonData, {
    width: size,
    margin: 2,
    color: {
      dark: '#A855F7', // Mist 紫色
      light: '#FFFFFF',
    },
    errorCorrectionLevel: 'M',
  });

  return {
    qrCode,
    verificationCode: data.verificationCode,
    data,
  };
}

/**
 * 解析 QR Code 資料
 */
export function parseQRCodeData(qrContent: string): VerificationData | null {
  try {
    const data = JSON.parse(qrContent) as VerificationData;

    // 驗證必要欄位
    if (!data.publicKey || !data.verificationCode || !data.timestamp || !data.signature) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * 建立一次性邀請連結
 */
export function createInviteLink(identity: Identity, baseUrl: string): {
  link: string;
  inviteCode: string;
  data: InviteData;
} {
  const inviterPublicKey = identity.publicKeyBase64;
  const inviteCode = generateInviteCode();
  const expiresAt = Date.now() + INVITE_EXPIRY;

  // 簽署邀請資料
  const dataToSign = `${inviterPublicKey}:${inviteCode}:${expiresAt}`;
  const signature = toBase64(identity.sign(new TextEncoder().encode(dataToSign)));

  const data: InviteData = {
    inviterPublicKey,
    inviteCode,
    expiresAt,
    signature,
  };

  // 建立連結
  const params = new URLSearchParams({
    invite: toBase64(new TextEncoder().encode(JSON.stringify(data))),
  });
  const link = `${baseUrl}?${params.toString()}`;

  return { link, inviteCode, data };
}

/**
 * 解析邀請連結
 */
export function parseInviteLink(url: string): InviteData | null {
  try {
    const urlObj = new URL(url);
    const inviteParam = urlObj.searchParams.get('invite');

    if (!inviteParam) {
      return null;
    }

    const jsonData = new TextDecoder().decode(fromBase64(inviteParam));
    const data = JSON.parse(jsonData) as InviteData;

    // 驗證必要欄位
    if (!data.inviterPublicKey || !data.inviteCode || !data.expiresAt || !data.signature) {
      return null;
    }

    return data;
  } catch {
    return null;
  }
}

/**
 * 驗證邀請連結
 */
export function verifyInviteLink(data: InviteData): boolean {
  try {
    // 檢查是否過期
    if (Date.now() > data.expiresAt) {
      console.warn('[Verification] Invite link expired');
      return false;
    }

    // 驗證簽章
    const publicKey = fromBase64(data.inviterPublicKey);
    const dataToVerify = `${data.inviterPublicKey}:${data.inviteCode}:${data.expiresAt}`;
    const signature = fromBase64(data.signature);

    const isValid = Identity.verify(
      publicKey,
      new TextEncoder().encode(dataToVerify),
      signature
    );

    if (!isValid) {
      console.warn('[Verification] Invalid invite signature');
      return false;
    }

    return true;
  } catch (error) {
    console.error('[Verification] Invite verification failed:', error);
    return false;
  }
}

// ============================================
// Verification Service Class
// ============================================

/**
 * 驗證服務類別
 */
class VerificationService {
  private friends: Map<string, FriendInfo> = new Map();
  private usedInviteCodes: Set<string> = new Set();

  /**
   * 產生驗證 QR Code
   */
  async generateQRCode(identity: Identity, size?: number) {
    return generateVerificationQRCode(identity, size);
  }

  /**
   * 處理掃描到的 QR Code
   */
  processScannedQRCode(qrContent: string): {
    success: boolean;
    data?: VerificationData;
    error?: string;
  } {
    const data = parseQRCodeData(qrContent);

    if (!data) {
      return { success: false, error: 'Invalid QR code format' };
    }

    if (!verifyVerificationData(data)) {
      return { success: false, error: 'Verification failed' };
    }

    return { success: true, data };
  }

  /**
   * 建立邀請連結
   */
  createInvite(identity: Identity, baseUrl: string) {
    return createInviteLink(identity, baseUrl);
  }

  /**
   * 處理邀請連結
   */
  processInviteLink(url: string): {
    success: boolean;
    data?: InviteData;
    error?: string;
  } {
    const data = parseInviteLink(url);

    if (!data) {
      return { success: false, error: 'Invalid invite link' };
    }

    // 檢查是否已使用過
    if (this.usedInviteCodes.has(data.inviteCode)) {
      return { success: false, error: 'Invite code already used' };
    }

    if (!verifyInviteLink(data)) {
      return { success: false, error: 'Invite verification failed' };
    }

    // 標記為已使用
    this.usedInviteCodes.add(data.inviteCode);

    return { success: true, data };
  }

  /**
   * 新增好友 (透過 QR Code 驗證)
   */
  addVerifiedFriend(publicKey: string, nickname?: string): FriendInfo {
    const friend: FriendInfo = {
      publicKey,
      nickname,
      trustLevel: TrustLevel.VERIFIED,
      addedAt: Date.now(),
      verifiedAt: Date.now(),
    };

    this.friends.set(publicKey, friend);
    this.saveFriends();

    return friend;
  }

  /**
   * 新增好友 (透過邀請連結)
   */
  addUnverifiedFriend(publicKey: string, nickname?: string): FriendInfo {
    const friend: FriendInfo = {
      publicKey,
      nickname,
      trustLevel: TrustLevel.UNVERIFIED,
      addedAt: Date.now(),
    };

    this.friends.set(publicKey, friend);
    this.saveFriends();

    return friend;
  }

  /**
   * 升級好友為已驗證
   */
  verifyFriend(publicKey: string): boolean {
    const friend = this.friends.get(publicKey);
    if (!friend) {
      return false;
    }

    friend.trustLevel = TrustLevel.VERIFIED;
    friend.verifiedAt = Date.now();
    this.saveFriends();

    return true;
  }

  /**
   * 取得好友列表
   */
  getFriends(): FriendInfo[] {
    return Array.from(this.friends.values());
  }

  /**
   * 取得好友資訊
   */
  getFriend(publicKey: string): FriendInfo | null {
    return this.friends.get(publicKey) ?? null;
  }

  /**
   * 移除好友
   */
  removeFriend(publicKey: string): boolean {
    const result = this.friends.delete(publicKey);
    if (result) {
      this.saveFriends();
    }
    return result;
  }

  /**
   * 更新好友暱稱
   */
  updateNickname(publicKey: string, nickname: string): boolean {
    const friend = this.friends.get(publicKey);
    if (!friend) {
      return false;
    }

    friend.nickname = nickname;
    this.saveFriends();
    return true;
  }

  /**
   * 載入好友列表
   */
  loadFriends(): void {
    try {
      const data = localStorage.getItem('mist_friends');
      if (data) {
        const friends = JSON.parse(data) as FriendInfo[];
        this.friends = new Map(friends.map((f) => [f.publicKey, f]));
      }
    } catch (error) {
      console.error('[Verification] Failed to load friends:', error);
    }
  }

  /**
   * 儲存好友列表
   */
  private saveFriends(): void {
    try {
      const friends = Array.from(this.friends.values());
      localStorage.setItem('mist_friends', JSON.stringify(friends));
    } catch (error) {
      console.error('[Verification] Failed to save friends:', error);
    }
  }
}

// 單例導出
export const verificationService = new VerificationService();

export default verificationService;
