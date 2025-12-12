/**
 * Storage Service - 本地加密儲存
 *
 * 使用 sql.js (SQLite in WASM) + IndexedDB 實現本地持久化
 * 伺服器零知識：所有資料只存在客戶端
 */

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - sql.js doesn't have proper type declarations
import initSqlJs, { type Database } from 'sql.js';

// IndexedDB 資料庫名稱
const IDB_NAME = 'mist_storage';
const IDB_STORE = 'sqlitedb';
const IDB_KEY = 'database';

// SQL.js WASM URL
const SQL_WASM_URL = 'https://sql.js.org/dist/sql-wasm.wasm';

let db: Database | null = null;
let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;

/**
 * 初始化資料庫
 */
export async function initStorage(): Promise<void> {
  if (db) return;

  // 初始化 SQL.js
  SQL = await initSqlJs({
    locateFile: () => SQL_WASM_URL,
  });

  // 嘗試從 IndexedDB 載入現有資料庫
  const savedData = await loadFromIndexedDB();

  if (savedData) {
    db = new SQL.Database(savedData);
    console.log('[Storage] Loaded existing database from IndexedDB');
  } else {
    db = new SQL.Database();
    initSchema();
    console.log('[Storage] Created new database');
  }

  // 定期保存到 IndexedDB
  setInterval(() => {
    saveToIndexedDB();
  }, 5000);
}

/**
 * 初始化資料庫 Schema
 */
function initSchema(): void {
  if (!db) return;

  db.run(`
    -- 聯絡人
    CREATE TABLE IF NOT EXISTS contacts (
      pubkey TEXT PRIMARY KEY,
      nickname TEXT,
      avatar TEXT,
      added_at INTEGER NOT NULL,
      trust_level TEXT DEFAULT 'unverified'
    );

    -- 對話
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      peer_pubkey TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'direct',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 訊息
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_pubkey TEXT NOT NULL,
      content TEXT NOT NULL,
      msg_type TEXT NOT NULL DEFAULT 'text',
      created_at INTEGER NOT NULL,
      ttl INTEGER DEFAULT 0,
      expires_at INTEGER,
      read_at INTEGER,
      is_outgoing INTEGER DEFAULT 0,
      status TEXT DEFAULT 'sent',
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    );

    -- Double Ratchet 狀態
    CREATE TABLE IF NOT EXISTS ratchet_states (
      peer_pubkey TEXT PRIMARY KEY,
      state_blob TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    -- 建立索引
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);
    CREATE INDEX IF NOT EXISTS idx_conversations_peer ON conversations(peer_pubkey);
  `);

  saveToIndexedDB();
}

/**
 * 從 IndexedDB 載入資料庫
 */
async function loadFromIndexedDB(): Promise<Uint8Array | null> {
  return new Promise((resolve) => {
    const request = indexedDB.open(IDB_NAME, 1);

    request.onerror = () => resolve(null);

    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };

    request.onsuccess = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      const transaction = idb.transaction(IDB_STORE, 'readonly');
      const store = transaction.objectStore(IDB_STORE);
      const getRequest = store.get(IDB_KEY);

      getRequest.onsuccess = () => {
        resolve(getRequest.result || null);
      };

      getRequest.onerror = () => resolve(null);
    };
  });
}

/**
 * 保存資料庫到 IndexedDB
 */
async function saveToIndexedDB(): Promise<void> {
  if (!db) return;

  const data = db.export();
  const buffer = new Uint8Array(data);

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(IDB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onupgradeneeded = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      if (!idb.objectStoreNames.contains(IDB_STORE)) {
        idb.createObjectStore(IDB_STORE);
      }
    };

    request.onsuccess = (event) => {
      const idb = (event.target as IDBOpenDBRequest).result;
      const transaction = idb.transaction(IDB_STORE, 'readwrite');
      const store = transaction.objectStore(IDB_STORE);
      store.put(buffer, IDB_KEY);

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    };
  });
}

// ============================================
// 聯絡人操作
// ============================================

export interface Contact {
  pubkey: string;
  nickname: string;
  avatar: string;
  addedAt: number;
  trustLevel: 'verified' | 'unverified';
}

export function addContact(contact: Contact): void {
  if (!db) throw new Error('Database not initialized');

  db.run(
    `INSERT OR REPLACE INTO contacts (pubkey, nickname, avatar, added_at, trust_level)
     VALUES (?, ?, ?, ?, ?)`,
    [contact.pubkey, contact.nickname, contact.avatar, contact.addedAt, contact.trustLevel]
  );

  // 同時建立對話
  const conversationId = `conv-${contact.pubkey.slice(0, 16)}`;
  db.run(
    `INSERT OR IGNORE INTO conversations (id, peer_pubkey, type, created_at, updated_at)
     VALUES (?, ?, 'direct', ?, ?)`,
    [conversationId, contact.pubkey, contact.addedAt, contact.addedAt]
  );

  saveToIndexedDB();
}

export function getContact(pubkey: string): Contact | null {
  if (!db) return null;

  const result = db.exec(
    `SELECT pubkey, nickname, avatar, added_at, trust_level FROM contacts WHERE pubkey = ?`,
    [pubkey]
  );

  if (result.length === 0 || result[0].values.length === 0) return null;

  const row = result[0].values[0];
  return {
    pubkey: row[0] as string,
    nickname: row[1] as string,
    avatar: row[2] as string,
    addedAt: row[3] as number,
    trustLevel: row[4] as 'verified' | 'unverified',
  };
}

export function getAllContacts(): Contact[] {
  if (!db) return [];

  const result = db.exec(
    `SELECT pubkey, nickname, avatar, added_at, trust_level FROM contacts ORDER BY added_at DESC`
  );

  if (result.length === 0) return [];

  return result[0].values.map((row: unknown[]) => ({
    pubkey: row[0] as string,
    nickname: row[1] as string,
    avatar: row[2] as string,
    addedAt: row[3] as number,
    trustLevel: row[4] as 'verified' | 'unverified',
  }));
}

export function removeContact(pubkey: string): void {
  if (!db) return;

  db.run(`DELETE FROM contacts WHERE pubkey = ?`, [pubkey]);
  db.run(`DELETE FROM conversations WHERE peer_pubkey = ?`, [pubkey]);
  db.run(
    `DELETE FROM messages WHERE conversation_id IN
     (SELECT id FROM conversations WHERE peer_pubkey = ?)`,
    [pubkey]
  );

  saveToIndexedDB();
}

// ============================================
// 訊息操作
// ============================================

export interface StoredMessage {
  id: string;
  conversationId: string;
  senderPubkey: string;
  content: string;
  type: 'text' | 'image' | 'file';
  createdAt: number;
  ttl: number;
  expiresAt: number | null;
  readAt: number | null;
  isOutgoing: boolean;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
}

export function saveMessage(message: StoredMessage): void {
  if (!db) throw new Error('Database not initialized');

  db.run(
    `INSERT OR REPLACE INTO messages
     (id, conversation_id, sender_pubkey, content, msg_type, created_at, ttl, expires_at, read_at, is_outgoing, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      message.id,
      message.conversationId,
      message.senderPubkey,
      message.content,
      message.type,
      message.createdAt,
      message.ttl,
      message.expiresAt,
      message.readAt,
      message.isOutgoing ? 1 : 0,
      message.status,
    ]
  );

  // 更新對話的 updated_at
  db.run(
    `UPDATE conversations SET updated_at = ? WHERE id = ?`,
    [message.createdAt, message.conversationId]
  );

  saveToIndexedDB();
}

export function getMessages(peerPubkey: string, limit = 50, offset = 0): StoredMessage[] {
  if (!db) return [];

  const conversationId = `conv-${peerPubkey.slice(0, 16)}`;

  const result = db.exec(
    `SELECT id, conversation_id, sender_pubkey, content, msg_type, created_at, ttl, expires_at, read_at, is_outgoing, status
     FROM messages
     WHERE conversation_id = ?
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?`,
    [conversationId, limit, offset]
  );

  if (result.length === 0) return [];

  return result[0].values.map((row: unknown[]) => ({
    id: row[0] as string,
    conversationId: row[1] as string,
    senderPubkey: row[2] as string,
    content: row[3] as string,
    type: row[4] as 'text' | 'image' | 'file',
    createdAt: row[5] as number,
    ttl: row[6] as number,
    expiresAt: row[7] as number | null,
    readAt: row[8] as number | null,
    isOutgoing: (row[9] as number) === 1,
    status: row[10] as StoredMessage['status'],
  })).reverse(); // 反轉以時間順序顯示
}

export function updateMessageStatus(messageId: string, status: StoredMessage['status']): void {
  if (!db) return;

  db.run(`UPDATE messages SET status = ? WHERE id = ?`, [status, messageId]);
  saveToIndexedDB();
}

export function markMessageAsRead(messageId: string): void {
  if (!db) return;

  db.run(`UPDATE messages SET read_at = ? WHERE id = ?`, [Date.now(), messageId]);
  saveToIndexedDB();
}

export function deleteMessage(messageId: string): void {
  if (!db) return;

  db.run(`DELETE FROM messages WHERE id = ?`, [messageId]);
  saveToIndexedDB();
}

export function deleteExpiredMessages(): number {
  if (!db) return 0;

  const now = Date.now();

  // 刪除過期訊息
  db.run(`DELETE FROM messages WHERE expires_at IS NOT NULL AND expires_at < ?`, [now]);

  // 刪除閱後即焚訊息（已讀超過 30 秒）
  db.run(
    `DELETE FROM messages WHERE ttl = -1 AND read_at IS NOT NULL AND read_at < ?`,
    [now - 30000]
  );

  const changes = db.getRowsModified();
  if (changes > 0) {
    saveToIndexedDB();
    console.log(`[Storage] Deleted ${changes} expired messages`);
  }

  return changes;
}

// ============================================
// Ratchet 狀態操作
// ============================================

export function saveRatchetState(peerPubkey: string, stateBlob: string): void {
  if (!db) return;

  db.run(
    `INSERT OR REPLACE INTO ratchet_states (peer_pubkey, state_blob, updated_at)
     VALUES (?, ?, ?)`,
    [peerPubkey, stateBlob, Date.now()]
  );

  saveToIndexedDB();
}

export function getRatchetState(peerPubkey: string): string | null {
  if (!db) return null;

  const result = db.exec(
    `SELECT state_blob FROM ratchet_states WHERE peer_pubkey = ?`,
    [peerPubkey]
  );

  if (result.length === 0 || result[0].values.length === 0) return null;

  return result[0].values[0][0] as string;
}

// ============================================
// 工具函式
// ============================================

export function getConversationIdForPeer(peerPubkey: string): string {
  return `conv-${peerPubkey.slice(0, 16)}`;
}

export function isInitialized(): boolean {
  return db !== null;
}

export async function clearAllData(): Promise<void> {
  if (!db) return;

  db.run(`DELETE FROM messages`);
  db.run(`DELETE FROM conversations`);
  db.run(`DELETE FROM contacts`);
  db.run(`DELETE FROM ratchet_states`);

  await saveToIndexedDB();
  console.log('[Storage] All data cleared');
}

// 啟動時自動清理過期訊息
export function startCleanupTask(): void {
  // 每分鐘檢查一次
  setInterval(() => {
    deleteExpiredMessages();
  }, 60000);

  // 立即執行一次
  deleteExpiredMessages();
}

export default {
  initStorage,
  isInitialized,
  clearAllData,
  startCleanupTask,
  // Contacts
  addContact,
  getContact,
  getAllContacts,
  removeContact,
  // Messages
  saveMessage,
  getMessages,
  updateMessageStatus,
  markMessageAsRead,
  deleteMessage,
  deleteExpiredMessages,
  getConversationIdForPeer,
  // Ratchet
  saveRatchetState,
  getRatchetState,
};
