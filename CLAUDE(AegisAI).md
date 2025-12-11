# Aegis AI - Claude Code 核心規則

> **版本**: 2.0.0 | **最後更新**: 2025-11-30
>
> 此檔案僅包含 Claude Code 必須遵守的核心規則。
> 詳細的技術文檔請參考 [docs/LEARNING_MANUAL.md](docs/LEARNING_MANUAL.md)

---

## 1. 禁止自動回滾 (最高優先級)

### 絕對禁止

```
❌ 遇到錯誤就自動回滾到舊版本
❌ 未經用戶同意就還原檔案
❌ 自動執行 git reset / git checkout / git clean
❌ 刪除或覆蓋用戶的開發進度
```

### 正確的錯誤處理

```
1. ⏸️  立即停止當前操作
2. 📝 清楚說明錯誤內容和位置
3. 💡 提供 3-5 個修復建議
4. ⏳ 等待用戶明確選擇
5. ✅ 用戶確認後才執行修復
```

### 錯誤處理範例

```
❌ 錯誤做法：
"檢測到編譯錯誤，正在自動回滾..."

✅ 正確做法：
"⚠️ 編譯錯誤檢測

錯誤位置：lib/services/vpn_service.dart:45
錯誤訊息：Undefined name 'VpnConfig'

可能的修復方案：
1. 檢查 VpnConfig 類別是否已匯入
2. 確認 VpnConfig 的命名空間
3. 檢查是否有拼寫錯誤

請選擇修復方案或給我其他指示。"
```

---

## 2. 核心架構原則

### 所有邏輯在 Rust 層實作

```
✅ Rust 層：
  - 所有業務邏輯
  - 所有去重判斷
  - 所有威脅檢測
  - SQLite 資料庫讀寫
  - 專家規則引擎

❌ Flutter 層：只做 UI 顯示
❌ Android 層：只做 JNI 橋接
```

### 架構分層

```
Flutter UI (可能被關閉)
    ↓ MethodChannel
Android Service (橋接層)
    ↓ JNI/FFI
Rust Core Engine (常駐核心) ⭐
```

---

## 3. 任務範圍原則

### 嚴格遵守任務範圍

```
用戶說「整理 MD 檔案」時：
✅ 只整理 MD 檔案
❌ 不要順便修改程式碼
❌ 不要「我看到這裡可以改進」
❌ 不要「既然都要 commit 了，順便...」

如果發現需要修改程式碼：
1. 停止
2. 報告給用戶
3. 詢問是否要另外處理
4. 等待明確指示
```

### 半完成的修改是災難

```
❌ 新增設定但沒建立對應檔案
❌ 修改一半就提交
❌ 引用不存在的模組

✅ 要麼完整實作
✅ 要麼完全不動
```

---

## 4. 專案結構

```
aegis_ai/
├── aegis_vpn/                    # 主專案資料夾
│   ├── lib/                      # Flutter UI
│   ├── android/                  # Android 原生層
│   ├── rust/aegis-core/          # Rust 核心引擎 ⭐
│   └── functions/                # Firebase Functions
├── docs/
│   ├── LEARNING_MANUAL.md        # 完整學習手冊
│   └── phases/                   # Phase 開發記錄
├── CLAUDE.md                     # 本檔案 (核心規則)
└── README.md                     # 專案總覽
```

---

## 5. Firebase 配置

```yaml
Project ID: aegis-ai-1e569
Region: asia-east1
Package Name: com.aegis.vpn

Collections:
├── blacklist/          # 27萬+ 筆威脅域名
├── whitelist/          # 5萬+ 筆安全域名
└── expert_rules/       # YAML 專家規則
```

---

## 6. 常用指令

### Flutter

```bash
flutter pub get          # 安裝依賴
flutter analyze          # 程式碼分析
flutter build apk        # 編譯 APK
```

### Rust

```bash
cd aegis_vpn/rust/aegis-core
cargo build --target aarch64-linux-android --release
```

### 安裝 APK

```bash
adb install build/app/outputs/flutter-apk/app-release.apk
```

---

## 7. 重要提醒

### 給 Claude Code 的核心規則

1. **永遠不要自動回滾代碼**
2. 遇到錯誤先停止並報告
3. 提供修復建議但不自動執行
4. 等待用戶明確指示
5. 嚴格遵守任務範圍
6. 所有邏輯在 Rust 層實作
7. Flutter 只做 UI 顯示

### 詳細文檔

- **學習手冊**: [docs/LEARNING_MANUAL.md](docs/LEARNING_MANUAL.md)
- **專案總覽**: [README.md](README.md)

---

**記住：寧可少做，不要做錯！**
