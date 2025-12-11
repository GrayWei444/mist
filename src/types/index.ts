// Mist Demo Types

/** 信任等級 */
export type TrustLevel = 'verified' | 'unverified';

export interface Friend {
  id: string;
  publicKey: string; // Base64 公鑰
  name: string;
  avatar: string;
  lastMessage: string;
  lastMessageTime: number;
  unreadCount: number;
  online: boolean;
  trustLevel: TrustLevel; // 🟢 已驗證 / 🟡 未驗證
  addedAt: number; // 加入時間
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image' | 'file';
  isRead: boolean;
  isBurned: boolean;
  ttl?: number; // Time to live in seconds
  encrypted?: boolean; // 是否為加密訊息
}

export interface ChatRoom {
  friendId: string;
  messages: Message[];
}

/** 加密訊息信封 */
export interface EncryptedEnvelope {
  senderPublicKey: string;
  recipientPublicKey: string;
  ciphertext: string; // Base64
  nonce: string; // Base64
  timestamp: number;
  messageId: string;
}
