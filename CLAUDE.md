# CLAUDE.md - Mist 專案指南

本文件供 AI 助手（如 Claude Code）了解專案架構與開發規範。

---

## 0. 最高優先級規則

### 0.1 禁止自動回滾 ⚠️

**絕對禁止未經用戶同意的任何回滾操作：**

❌ 禁止行為：
- 遇到錯誤就自動回滾到舊版本
- 未經用戶同意就還原檔案
- 自動執行 `git reset` / `git checkout` / `git clean`
- 刪除用戶剛寫的代碼
- 自作主張「修復」用戶的修改

✅ 正確的錯誤處理：
1. ⏸️ 立即停止當前操作
2. 📝 清楚說明錯誤內容和位置
3. 💡 提供 3-5 個修復建議
4. ⏳ 等待用戶明確選擇
5. 🔄 只有在用戶明確同意後才執行修復

### 0.2 任務範圍原則

**只做用戶要求的事，不多也不少：**

❌ 禁止行為：
- 自作主張重構「順便看到的」代碼
- 未被要求就添加新功能
- 修改不相關的檔案
- 「順便優化」其他部分

✅ 正確做法：
- 專注於用戶明確要求的任務
- 如發現其他問題，先報告並等待指示
- 保持最小改動原則

### 0.3 Token 交接程序

當接近 Token 上限時，必須執行以下交接程序：

```
📋 交接清單：
1. 當前任務進度（完成/進行中/未開始）
2. 已修改的檔案列表
3. 未完成的步驟
4. 已知的問題或錯誤
5. 下一步建議
```

交接格式範例：
```markdown
## 🔄 Session 交接

### ✅ 已完成
- [x] 建立 ChatWindow 元件
- [x] 實作訊息加密

### 🔄 進行中
- [ ] WebRTC 連線建立（完成 60%）

### 📁 已修改檔案
- `src/components/chat/ChatWindow.tsx` - 新增
- `src/services/crypto.ts` - 修改第 45-80 行

### ⚠️ 已知問題
- WebRTC ICE candidate 收集未完成

### 💡 下一步
1. 完成 ICE candidate 處理
2. 測試 P2P 連線
```

---

## 1. 專案概述

Mist 是一款端到端加密的 PWA 通訊應用，強調「零信任」與「去中心化」。

### 核心設計原則

1. **伺服器零知識**：伺服器只負責信令轉發，不儲存任何使用者資料或訊息
2. **客戶端運算**：所有加解密、資料庫操作都在客戶端 Rust WASM 執行
3. **P2P 優先**：訊息透過 WebRTC 直接傳輸，伺服器不經手
4. **強制銷毀**：訊息刪除邏輯在 Rust 層強制執行，UI 層無法阻止

---

## 2. 程式碼規範

### 2.1 TypeScript / React 規範

#### 命名規則

| 類型 | 命名方式 | 範例 |
|------|----------|------|
| 元件 | PascalCase | `ChatWindow.tsx`, `MessageBubble.tsx` |
| Hook | camelCase + use 前綴 | `useWebRTC.ts`, `useCrypto.ts` |
| 服務 | camelCase | `cryptoService.ts`, `mqttClient.ts` |
| 常數 | SCREAMING_SNAKE_CASE | `MAX_GROUP_SIZE`, `DEFAULT_TTL` |
| 介面 | PascalCase + I 前綴（可選） | `IMessage`, `UserProfile` |
| 型別 | PascalCase | `MessageType`, `ConnectionState` |
| 函式 | camelCase + 動詞開頭 | `sendMessage()`, `encryptData()` |
| 變數 | camelCase | `messageList`, `currentUser` |
| 私有成員 | _ 前綴 | `_internalState` |

#### 函式命名動詞規範

```typescript
// 取得資料
getUser(), fetchMessages(), retrieveKey()

// 設定資料
setName(), updateProfile(), assignRole()

// 布林判斷（is/has/can/should 開頭）
isConnected(), hasPermission(), canSend(), shouldRetry()

// 事件處理（handle/on 開頭）
handleClick(), onMessageReceived()

// 轉換（to/from/parse/format 開頭）
toString(), fromJSON(), parseMessage(), formatDate()

// 驗證
validateInput(), checkPermission(), verifySignature()

// 生命週期
initConnection(), destroySession(), cleanupResources()
```

#### React 元件規範

```tsx
// ✅ 正確：函式元件 + TypeScript
interface ChatWindowProps {
  conversationId: string;
  onClose: () => void;
}

export function ChatWindow({ conversationId, onClose }: ChatWindowProps) {
  // Hook 放最上面
  const { t } = useTranslation('chat');
  const [messages, setMessages] = useState<Message[]>([]);

  // useEffect 次之
  useEffect(() => {
    // ...
  }, [conversationId]);

  // 事件處理函式
  const handleSend = useCallback(() => {
    // ...
  }, []);

  // 最後 return JSX
  return (
    <div className="flex flex-col h-full">
      {/* ... */}
    </div>
  );
}
```

#### 檔案結構規範

```
src/components/chat/
├── index.ts              # 統一匯出
├── ChatWindow.tsx        # 主元件
├── ChatWindow.test.tsx   # 測試
├── MessageBubble.tsx     # 子元件
├── MessageInput.tsx      # 子元件
└── types.ts              # 型別定義
```

### 2.2 Rust 規範

#### 命名規則

| 類型 | 命名方式 | 範例 |
|------|----------|------|
| 模組 | snake_case | `double_ratchet.rs`, `key_exchange.rs` |
| 結構體 | PascalCase | `RatchetState`, `EncryptedMessage` |
| 特性 | PascalCase | `Encryptable`, `Serializable` |
| 函式 | snake_case | `encrypt_message()`, `derive_key()` |
| 常數 | SCREAMING_SNAKE_CASE | `MAX_CHUNK_SIZE`, `KEY_LENGTH` |
| 變數 | snake_case | `message_count`, `public_key` |
| 生命週期 | 短小寫 | `'a`, `'static` |

#### Rust 程式碼範例

```rust
// ✅ 正確的 Rust 風格
use wasm_bindgen::prelude::*;

const MAX_MESSAGE_SIZE: usize = 65536;

#[wasm_bindgen]
pub struct EncryptedMessage {
    ciphertext: Vec<u8>,
    nonce: [u8; 12],
}

impl EncryptedMessage {
    pub fn new(plaintext: &[u8], key: &[u8; 32]) -> Result<Self, CryptoError> {
        // 實作...
    }

    pub fn decrypt(&self, key: &[u8; 32]) -> Result<Vec<u8>, CryptoError> {
        // 實作...
    }
}
```

### 2.3 CSS / TailwindCSS 規範

```tsx
// ✅ 正確：使用 Tailwind utility classes
<div className="flex flex-col items-center gap-4 p-4">

// ✅ 正確：超過 3 個 class 時換行
<button
  className={`
    px-4 py-2 rounded-lg
    bg-primary-600 hover:bg-primary-700
    text-white font-medium
    transition-colors duration-200
  `}
>

// ❌ 避免：在 TSX 中寫內聯樣式
<div style={{ display: 'flex', padding: '16px' }}>
```

### 2.4 通用程式碼規範

#### 註解規範

```typescript
// ✅ 好的註解：解釋「為什麼」
// 使用 ChaCha20 而非 AES 因為不需要硬體加速也有好效能
const cipher = new ChaCha20Poly1305(key);

// ❌ 壞的註解：解釋「是什麼」（代碼本身已說明）
// 加密訊息
const encrypted = cipher.encrypt(message);
```

#### 錯誤處理

```typescript
// ✅ 正確：具體的錯誤類型
class EncryptionError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'EncryptionError';
  }
}

// ✅ 正確：提供有意義的錯誤訊息
throw new EncryptionError(
  'Failed to derive key: invalid salt length',
  'ERR_INVALID_SALT'
);
```

#### Import 順序

```typescript
// 1. Node 內建模組
import path from 'path';

// 2. 外部套件
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

// 3. 內部模組（絕對路徑）
import { CryptoService } from '@/services/crypto';
import { useWebRTC } from '@/hooks/useWebRTC';

// 4. 相對路徑模組
import { MessageBubble } from './MessageBubble';
import type { Message } from './types';
```

#### 程式碼長度限制

| 項目 | 限制 |
|------|------|
| 單行 | 最大 100 字元 |
| 函式 | 最大 50 行 |
| 檔案 | 最大 300 行（超過請拆分） |
| 函式參數 | 最多 4 個（超過請用物件） |
| 巢狀層級 | 最多 3 層 |

---

## 3. Git 與 GitHub 規範

### 3.1 Commit 訊息格式

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Type 類型

| Type | 說明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 修復 bug |
| `docs` | 文件更新 |
| `style` | 程式碼格式（不影響邏輯） |
| `refactor` | 重構（不新增功能、不修 bug） |
| `perf` | 效能優化 |
| `test` | 測試相關 |
| `chore` | 建置工具、依賴更新 |
| `security` | 安全性修復 |

#### 範例

```
feat(chat): add message encryption with Double Ratchet

- Implement X3DH key exchange
- Add ChaCha20-Poly1305 encryption
- Store ratchet state in IndexedDB

Closes #123
```

### 3.2 分支命名

```
<type>/<issue-number>-<short-description>
```

範例：
- `feat/42-add-voice-call`
- `fix/58-message-decrypt-error`
- `refactor/71-optimize-webrtc`

主要分支：
- `main` - 穩定版本
- `develop` - 開發分支
- `release/*` - 發布分支

### 3.3 禁止的 Git 操作

❌ **絕對禁止**（除非用戶明確要求）：

| 操作 | 風險 |
|------|------|
| `git push --force` | 覆蓋遠端歷史 |
| `git reset --hard` | 丟失未提交修改 |
| `git clean -fd` | 刪除未追蹤檔案 |
| `git checkout .` | 丟失工作區修改 |
| 修改已 push 的 commit | 破壞協作歷史 |

### 3.4 Pull Request 規範

```markdown
## 概述
簡述這個 PR 做了什麼

## 改動類型
- [ ] 新功能
- [ ] Bug 修復
- [ ] 重構
- [ ] 文件更新

## 改動檔案
- `src/...` - 說明

## 測試
- [ ] 單元測試通過
- [ ] E2E 測試通過
- [ ] 手動測試項目：
  - [ ] ...

## 截圖（如有 UI 改動）

## 相關 Issue
Closes #123
```

### 3.5 .gitignore 原則

必須忽略：
- `node_modules/` - 依賴
- `dist/`, `build/` - 建置產物
- `.env`, `.env.local` - 環境變數
- `*.pem`, `*.key` - 金鑰檔案
- `credentials.json`, `secrets.json` - 機密資料

---

## 4. 技術棧

| 層級 | 技術 | 用途 |
|------|------|------|
| UI | React 18 + TypeScript + Vite | PWA 前端 |
| 樣式 | TailwindCSS | UI 樣式 |
| 核心 | Rust + wasm-pack | 加解密、資料庫、網路協定 |
| 儲存 | sql.js + IndexedDB | 本地加密儲存 |
| 通訊 | WebRTC | P2P 傳輸 |
| 信令 | MQTT over WSS | 控制指令交換 |
| 推播 | Web Push API | 通知（不含訊息內文） |
| 後端 | Docker (Caddy + EMQX + Coturn) | 基礎設施 |
| VPS 管理 | Hostinger API (MCP) | 遠端伺服器管理 |

---

## 5. VPS 部署資訊

### 伺服器

| 項目 | 值 |
|------|------|
| **VPS ID** | `937047` |
| **IP** | `31.97.71.140` |
| **主機名** | `srv937047.hstgr.cloud` |
| **OS** | Ubuntu 24.04 with Docker |

### 域名

| 域名 | 用途 |
|------|------|
| `mqtt.alwaysbefound.com` | MQTT WebSocket (WSS) |

### Docker 服務

| 容器 | 用途 | 端口 |
|------|------|------|
| `mist-emqx` | MQTT Broker | 1883, 8083, 18083 |
| `mist-coturn` | STUN/TURN | 3478, 5349 |
| `mist-caddy-mqtt` | 反向代理 | 443 |

### 連線配置

```typescript
// MQTT (src/services/mqtt.ts)
broker: 'wss://mqtt.alwaysbefound.com/mqtt'

// TURN (src/services/webrtc.ts)
turn: 'turn:31.97.71.140:3478'
turns: 'turns:31.97.71.140:5349'
credential: 'mist' / 'mist_turn_2024'
```

### MCP 管理指令

透過 Hostinger API MCP 可執行：
- `VPS_getVirtualMachinesV1` - 查看 VPS 列表
- `VPS_getProjectListV1` - 查看 Docker 專案
- `VPS_getFirewallDetailsV1` - 查看防火牆規則
- `VPS_createFirewallRuleV1` - 新增防火牆規則
- `VPS_syncFirewallV1` - 同步防火牆

---

## 6. 目錄結構

```
mist/
├── src/                    # React 前端原始碼
│   ├── components/         # UI 元件
│   │   ├── chat/           # 聊天相關元件
│   │   ├── contacts/       # 聯絡人相關元件
│   │   ├── auth/           # 認證相關元件
│   │   └── common/         # 共用元件
│   ├── hooks/              # 自訂 React Hooks
│   ├── services/           # 業務邏輯服務
│   │   ├── crypto.ts       # WASM 加解密介面
│   │   ├── webrtc.ts       # WebRTC 管理
│   │   ├── mqtt.ts         # MQTT 連線管理
│   │   └── storage.ts      # 儲存抽象層
│   ├── stores/             # Zustand 狀態管理
│   ├── workers/            # Web Workers
│   │   └── wasm.worker.ts  # WASM 執行環境
│   ├── wasm/               # Rust WASM 綁定
│   ├── types/              # TypeScript 型別定義
│   ├── locales/            # i18n 語言檔
│   └── utils/              # 工具函式
├── rust-core/              # Rust 核心邏輯
│   ├── src/
│   │   ├── crypto/         # 加解密模組
│   │   ├── storage/        # 資料庫操作
│   │   ├── network/        # 網路協定
│   │   └── lib.rs          # WASM 入口
│   ├── Cargo.toml
│   └── tests/
├── server/                 # Docker 部署設定
│   ├── docker-compose.yml
│   ├── caddy/
│   ├── emqx/
│   └── coturn/
├── docs/                   # 技術文件
├── public/                 # 靜態資源
└── tests/                  # 測試
```

---

## 7. 開發指令

```bash
# 安裝依賴
pnpm install

# 開發模式（前端）
pnpm dev

# 建置 Rust WASM
cd rust-core && wasm-pack build --target web

# 建置生產版本
pnpm build

# 執行測試
pnpm test

# 執行 Lint
pnpm lint

# 格式化程式碼
pnpm format

# 啟動 Docker 服務
cd server && docker-compose up -d
```

---

## 8. 安全規範

### 8.1 絕對禁止

| 項目 | 說明 |
|------|------|
| ❌ Log 私鑰 | 任何形式的私鑰都不能出現在 log |
| ❌ Log 明文訊息 | 加密前的訊息內容禁止 log |
| ❌ 硬編碼密鑰 | 密鑰必須從安全來源取得 |
| ❌ 信任客戶端 | 所有輸入都要驗證 |
| ❌ 暴露內網 IP | WebRTC SDP 必須過濾 |

### 8.2 必須執行

| 項目 | 做法 |
|------|------|
| ✅ 輸入驗證 | 公鑰格式、訊息長度、檔案類型 |
| ✅ 使用 WSS | MQTT 連線必須加密 |
| ✅ 清零敏感資料 | 使用後立即覆寫記憶體 |
| ✅ 錯誤訊息脫敏 | 不暴露系統內部資訊 |

### 8.3 加密標準

| 用途 | 演算法 |
|------|--------|
| 金鑰交換 | X3DH (Curve25519) |
| 訊息加密 | Double Ratchet + AES-256-GCM |
| 檔案加密 | ChaCha20-Poly1305 |
| 雜湊 | SHA-256 / BLAKE3 |
| 簽章 | Ed25519 |

---

## 9. 重要設計決策

### 9.1 訊息生命週期控制

訊息刪除邏輯在 Rust WASM 層強制執行，UI 層無法攔截：

```rust
// rust-core/src/storage/destroy.rs
pub fn cleanup_expired_messages(db: &Database) {
    let now = current_timestamp();

    // TTL 到期
    db.execute("DELETE FROM messages WHERE expires_at < ?", [now]);

    // 閱後即焚（已讀超過 30 秒）
    db.execute(
        "DELETE FROM messages WHERE ttl = -1 AND read_at < ?",
        [now - 30]
    );
}
```

### 9.2 金鑰管理

- 私鑰永遠不離開客戶端
- 私鑰儲存在 IndexedDB，由 WebAuthn 生物辨識保護
- 公鑰是唯一的使用者識別碼

### 9.3 群組限制

- 最大 8 人（WebRTC Full Mesh 效能考量）
- 每人維護 N-1 條連線
- 8 人 = 28 條連線，是行動裝置的合理上限

---

## 10. 資料庫 Schema

```sql
-- 聯絡人
CREATE TABLE contacts (
    pubkey TEXT PRIMARY KEY,
    nickname TEXT,
    avatar_hash TEXT,
    added_at INTEGER NOT NULL,
    verified INTEGER DEFAULT 0
);

-- 對話
CREATE TABLE conversations (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,  -- 'direct' | 'group'
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- 訊息
CREATE TABLE messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_pubkey TEXT NOT NULL,
    ciphertext BLOB NOT NULL,
    created_at INTEGER NOT NULL,
    ttl INTEGER NOT NULL,        -- 秒數，0=永久，-1=閱後即焚
    expires_at INTEGER,          -- created_at + ttl
    read_at INTEGER,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

-- 金鑰（Double Ratchet 狀態）
CREATE TABLE ratchet_states (
    peer_pubkey TEXT PRIMARY KEY,
    state_blob BLOB NOT NULL,
    updated_at INTEGER NOT NULL
);
```

---

## 11. 測試要求

| 類型 | 覆蓋率要求 | 工具 |
|------|------------|------|
| Rust 單元測試 | > 80% | `cargo test` |
| TypeScript 單元測試 | > 70% | Vitest |
| E2E 測試 | 關鍵路徑 | Playwright |
| 加密功能 | KAT 測試 | 自訂 |

---

## 12. 多語系 (i18n)

使用 react-i18next，所有 UI 文字必須放到語言檔。

支援語系：`zh-TW`（預設）、`en`、`zh-CN`、`ja`

```tsx
import { useTranslation } from 'react-i18next';

function Component() {
  const { t } = useTranslation('chat');
  return <h1>{t('title')}</h1>;
}
```

詳見 [docs/I18N.md](docs/I18N.md)

---

## 13. 好友系統

採用「分層信任」機制，平衡安全性與便利性：

| 等級 | 符號 | 加入方式 | 說明 |
|------|------|----------|------|
| 已驗證 | 🟢 | QR Code 面對面 | 最高信任 |
| 未驗證 | 🟡 | 一次性邀請連結 | 可之後升級 |

### 加好友方式

1. **一次性邀請連結**：線上分享，使用後立即失效
2. **QR Code 面對面**：直接建立已驗證關係

### 驗證升級

見面時掃描對方的驗證 QR Code，即可從「未驗證」升級為「已驗證」

詳見 [docs/FRIEND_SYSTEM.md](docs/FRIEND_SYSTEM.md)

---

## 14. 金流設計

| 地區 | 服務商 | 說明 |
|------|--------|------|
| 台灣 | 綠界 ECPay | 信用卡、ATM、超商 |
| 國際 | LemonSqueezy | 全球信用卡、自動稅務 |

詳見 [docs/PAYMENT.md](docs/PAYMENT.md)

---

## 15. 相關文件

- [技術架構](docs/ARCHITECTURE.md)
- [系統設計](docs/SYSTEM_DESIGN.md)
- [好友系統](docs/FRIEND_SYSTEM.md)
- [檔案加密設計](docs/FILE_ENCRYPTION.md)
- [多語系設計](docs/I18N.md)
- [金流設計](docs/PAYMENT.md)

---

## 16. 常見問題

### Q: 為什麼不用 Flutter？
A: Flutter Web 與 Rust WASM 的整合工具鏈不成熟，React + wasm-bindgen 更穩定。

### Q: 為什麼群組上限是 8 人？
A: WebRTC Full Mesh 架構，每人需維護 N-1 條連線。8 人 = 28 條連線，是行動裝置效能的合理上限。

### Q: 為什麼用 sql.js 而不是 IndexedDB 直接存？
A: sql.js 提供完整 SQL 查詢能力，方便複雜查詢（如訊息搜尋、過期清理）。IndexedDB 是 NoSQL，查詢能力弱。

### Q: 伺服器能看到什麼？
A: 只能看到：誰在線上、誰跟誰建立連線。看不到：訊息內容、檔案內容、使用者真實身份。
