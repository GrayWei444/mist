# Mist

> 朦朧之中，只有你我

Mist 是一款注重隱私的端到端加密通訊應用，採用 PWA 技術實現跨平台支援。

## Demo

**Live Demo**: https://graywei444.github.io/mist/

> 長按太陽圖示 3 秒進入聊天介面

### Phase 0 Demo 功能展示

| 功能 | 說明 |
|------|------|
| 偽裝模式 | 天氣 App 外觀，隱藏真實用途 |
| 訊息模糊 | 預設模糊，長按顯示內容 |
| 閱後即焚 | 點擊火焰按鈕立即銷毀 |
| TTL 自動銷毀 | 查看後倒數自動消失 |
| 圖片訊息 | 支援圖片附件 |
| PWA 安裝 | 可安裝至手機桌面 |

## 核心理念

- **零信任 (Zero Trust)**：伺服器不儲存金鑰、不儲存訊息、不認識使用者
- **去中心化 (Decentralized)**：以公鑰為唯一 ID，P2P 直接傳輸
- **物理接觸驗證**：信任建立在面對面之上

## 技術架構

```
┌─────────────────────────────────────────────────────────┐
│                    React PWA (UI)                       │
│              TypeScript + Vite + TailwindCSS            │
└─────────────────────────────────────────────────────────┘
                          │
                    Web Worker
                          │
┌─────────────────────────────────────────────────────────┐
│                   Rust WASM Core                        │
│  - E2EE 加解密 (X3DH, Double Ratchet)                   │
│  - 訊息生命週期控制 (TTL/閱後即焚/遠端刪除)              │
│  - 檔案分片與 Hash                                      │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────────────────────────────────────┐
│              sql.js + IndexedDB (本地儲存)               │
└─────────────────────────────────────────────────────────┘
```

## 平台支援

| 平台 | 安裝 | 推播通知 | 本地儲存 |
|------|------|----------|----------|
| Android Chrome | ✅ | ✅ | ✅ |
| iOS Safari 16.4+ | ✅ | ✅ | ✅ |
| Windows Chrome/Edge | ✅ | ✅ | ✅ |
| macOS Chrome | ✅ | ✅ | ✅ |
| macOS Safari Sonoma+ | ✅ | ✅ | ✅ |

## 功能特色

### 隱私與安全
- **生物辨識鎖**：App 啟動需 FaceID/指紋驗證
- **分層信任好友系統**：一次性邀請連結 + QR Code 面對面驗證
- **防窺視設計**：預設模糊、長按顯影、浮水印保護
- **訊息生命週期控制**：TTL 自動銷毀、閱後即焚、遠端刪除

### 通訊功能
- **文字訊息**：端到端加密，P2P 傳輸
- **語音通話**：WebRTC 加密通話
- **檔案傳輸**：群組內 Mesh 分享，降低發送者負擔
- **群組聊天**：最多 8 人 Full Mesh

## 快速開始

```bash
# 安裝依賴
pnpm install

# 開發模式
pnpm dev

# 建置
pnpm build

# 預覽
pnpm preview
```

## 專案結構

```
mist/
├── src/
│   ├── components/     # React 元件
│   ├── hooks/          # React Hooks
│   ├── services/       # 業務邏輯服務
│   ├── stores/         # 狀態管理
│   ├── workers/        # Web Workers
│   └── wasm/           # Rust WASM 綁定
├── rust-core/          # Rust 核心邏輯
│   ├── src/
│   │   ├── crypto/     # 加解密模組
│   │   ├── storage/    # 資料庫操作
│   │   ├── network/    # 網路協定
│   │   └── lib.rs
│   └── Cargo.toml
├── server/             # Docker 部署設定
│   ├── docker-compose.yml
│   ├── caddy/
│   ├── emqx/
│   └── coturn/
└── docs/               # 技術文件
    ├── ARCHITECTURE.md
    └── SYSTEM_DESIGN.md
```

## 文件

- [技術架構](docs/ARCHITECTURE.md)
- [系統設計](docs/SYSTEM_DESIGN.md)
- [好友系統](docs/FRIEND_SYSTEM.md)
- [檔案加密設計](docs/FILE_ENCRYPTION.md)
- [多語系設計](docs/I18N.md)
- [金流設計](docs/PAYMENT.md)

## 開發路線圖

- [x] **Phase 0: 技術驗證** - 已完成 (2024-12-09)
  - UI/UX 概念驗證
  - PWA 安裝與離線支援
  - 訊息生命週期控制 Demo
- [x] **Phase 1: 基礎通訊** - 已完成 (2024-12-10)
  - [x] 後端基礎設施 (VPS + Docker)
    - EMQX MQTT Broker (WebSocket 信令)
    - Coturn STUN/TURN Server (NAT 穿透)
    - Caddy SSL 反向代理
  - [x] Rust WASM 加密核心
    - Ed25519 身份金鑰 (簽章)
    - X25519 金鑰交換
    - X3DH 初始金鑰協商
    - Double Ratchet 前向保密
    - AES-256-GCM 對稱加密
  - [x] 前端 WASM 整合
  - [x] MQTT 連線服務
  - [x] WebRTC P2P 連線
- [ ] Phase 2: 安全與信任
- [ ] Phase 3: 高級功能
- [ ] Phase 4: 商業化

## 授權

Private - All Rights Reserved
