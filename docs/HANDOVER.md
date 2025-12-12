# Mist 開發交接文檔

> 最後更新：2024-12-12
> 當前進度：Phase 2 完成，Phase 3 進行中

---

## 1. 專案進度總覽

| Phase | 名稱 | 狀態 | 完成日期 |
|-------|------|------|----------|
| Phase 1 | 基礎建設 | ✅ 完成 | - |
| Phase 2 | 端對端加密 | ✅ 完成 | 2024-12-12 |
| Phase 3 | 信任與驗證 | 🔄 進行中 | - |
| Phase 4 | 高級功能 | ⏳ 待開始 | - |
| Phase 5 | 商業化 | ⏳ 待開始 | - |
| Phase 6+ | 進階功能 | ⏳ 待開始 | - |

---

## 2. Phase 2 完成項目 (端對端加密)

### 2.1 已實作功能

| 功能 | 檔案位置 | 說明 |
|------|----------|------|
| X3DH 金鑰交換 | `rust-core/src/crypto/x3dh.rs` | 完整實作，含測試 |
| Double Ratchet | `rust-core/src/crypto/ratchet.rs` | 完整實作，雙向加密 |
| Session 管理 | `src/hooks/useCrypto.ts` | createSession / acceptSession |
| QR Code 掃描 | `src/components/Chat/AddFriendModal.tsx` | X3DH 格式 |
| 訊息持久化 | `src/services/storage.ts` | sql.js + IndexedDB |

### 2.2 加密流程

```
Alice (掃描方)                    Bob (被掃描方)
─────────────────────────────────────────────────
1. 掃描 QR Code
   取得 {pk, spk, sig}

2. X3DH.initiatorCalculate()
   → shared_secret
   → ephemeral_pub/priv

3. Session.initAsAlice()
   → chain_key_send

4. 發送 X3DH_INIT ──────────────→ 5. 收到 X3DH_INIT
                                    X3DH.responderCalculate()
                                    → shared_secret

                                 6. Session.initAsBob()
                                    → chain_key_recv

7. encrypt() ───────────────────→ 8. decrypt()
```

### 2.3 關鍵修復記錄

| 問題 | 修復 | 日期 |
|------|------|------|
| Session.initAsBob 設定錯誤的 chain_key | 改為設定 chain_key_recv | 2024-12-12 |
| Alice 生成新的 ephemeral key | 改用 X3DH 的 ephemeral key | 2024-12-12 |
| RatchetMessage 序列化問題 | 加入 toJson()/fromJson() | 2024-12-12 |
| Session 版本不兼容 | 加入 SESSION_VERSION 遷移 | 2024-12-12 |

---

## 3. Phase 3 待完成項目 (信任與驗證)

### 3.1 一次性邀請連結

**需求**：
- 生成一次性 token
- 設定過期時間
- 分享連結後可加好友
- 使用後立即失效

**建議實作位置**：
- `src/services/invite.ts` (新建)
- `src/components/Invite/` (新建)

### 3.2 分層信任機制

**需求**：
- 🟢 已驗證：QR Code 面對面掃描
- 🟡 未驗證：透過邀請連結加入

**建議修改**：
- `src/stores/chatStore.ts` - 加入 `verificationStatus` 欄位
- `src/components/Chat/` - 顯示驗證狀態圖示

### 3.3 驗證升級流程

**需求**：
- 未驗證好友可透過面對面掃碼升級
- 升級後雙方都標記為已驗證

**參考**：`src/components/Verification/QRCodeVerification.tsx`

### 3.4 WebAuthn 生物辨識

**需求**：
- 使用 WebAuthn API 綁定設備
- 私鑰保護（解鎖才能使用）

**參考資源**：
- [WebAuthn Guide](https://webauthn.guide/)
- `navigator.credentials` API

---

## 4. 重要檔案清單

### 4.1 Rust 核心 (rust-core/)

| 檔案 | 用途 |
|------|------|
| `src/crypto/x3dh.rs` | X3DH 金鑰交換 |
| `src/crypto/ratchet.rs` | Double Ratchet 加密 |
| `src/crypto/keys.rs` | 金鑰對生成 |
| `src/lib.rs` | WASM 入口 |

### 4.2 TypeScript 前端 (src/)

| 檔案 | 用途 |
|------|------|
| `hooks/useCrypto.ts` | 加密操作 Hook |
| `services/crypto.ts` | WASM 介面封裝 |
| `services/storage.ts` | 本地儲存 |
| `services/mqtt.ts` | MQTT 連線 |
| `providers/AppProvider.tsx` | 全域狀態 |
| `stores/chatStore.ts` | 聊天狀態 |
| `components/Chat/ChatWindow.tsx` | 聊天視窗 |
| `components/Chat/AddFriendModal.tsx` | 加好友（QR 掃描）|

### 4.3 WASM 輸出 (src/wasm/)

| 檔案 | 說明 |
|------|------|
| `safetalk_core.js` | JS 綁定 |
| `safetalk_core_bg.wasm` | WASM 二進位 |
| `safetalk_core.d.ts` | TypeScript 型別 |

---

## 5. 開發指令

```bash
# 前端開發
pnpm dev

# 建置 WASM（修改 Rust 後必須執行）
cd rust-core && wasm-pack build --target web --out-dir ../src/wasm

# 執行 Rust 測試
cd rust-core && cargo test

# 建置生產版本
pnpm build

# 部署到 GitHub Pages
git push  # GitHub Actions 自動部署
```

---

## 6. 測試方式

### 6.1 端對端加密測試

1. 準備兩台設備（電腦 + 手機）
2. 電腦開啟 https://graywei444.github.io/mist/
3. 手機開啟相同網址
4. 電腦清除 localStorage（DevTools > Application > Clear site data）
5. 手機清除 localStorage
6. 電腦顯示 QR Code
7. 手機掃描 QR Code 加好友
8. 手機發送訊息 → 電腦應能收到並解密
9. 電腦發送訊息 → 手機應能收到並解密

### 6.2 Rust 單元測試

```bash
cd rust-core
cargo test

# 重要測試：
# - test_x3dh_key_exchange
# - test_x3dh_without_otp
# - test_double_ratchet
# - test_full_encryption_flow
```

---

## 7. 已知問題

| 問題 | 狀態 | 說明 |
|------|------|------|
| Debug log 過多 | 待清理 | 加密模組有大量 console.log |
| Session 序列化體積大 | 待優化 | 可考慮 bincode 替代 JSON |

---

## 8. 環境資訊

### 8.1 VPS

| 項目 | 值 |
|------|------|
| IP | 31.97.71.140 |
| 主機名 | srv937047.hstgr.cloud |
| MQTT | wss://mqtt.alwaysbefound.com/mqtt |

### 8.2 GitHub

| 項目 | 值 |
|------|------|
| Repo | https://github.com/GrayWei444/mist |
| Pages | https://graywei444.github.io/mist/ |
| Actions | 自動部署 on push to master |

---

## 9. 下一步建議

1. **Phase 3 優先**：完成信任機制，這是安全性的關鍵
2. **清理 Debug Log**：移除 Rust 中的 console.log（或改為 feature flag）
3. **加入測試**：前端單元測試覆蓋率需要提升
4. **效能優化**：Session 持久化可考慮更高效的序列化方式

---

*文件版本：1.0*
*建立日期：2024-12-12*
