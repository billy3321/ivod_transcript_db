# 調試模式使用說明

## 問題
在開發過程中，Next.js 的 Fast Refresh 功能會在出現錯誤時自動重新載入頁面，導致開發者無法看清楚錯誤訊息，影響除錯效率。

## 解決方案

我們提供了三種不同級別的調試模式：

### 1. 正常開發模式（預設）
```bash
npm run dev
```
- ✅ 完整的 Fast Refresh 功能
- ✅ 自動重新載入
- ✅ 最佳開發體驗

### 2. 部分禁用模式
```bash
# 設定環境變數後使用 npm run dev
DISABLE_FAST_REFRESH=true npm run dev
```
- ❌ 禁用 React Fast Refresh
- ✅ 保留 CSS HMR
- ⚠️ 減少自動重新載入但不完全禁用

### 3. 完全無HMR模式（推薦用於調試）
```bash
npm run dev:no-hmr
```
- ❌ 完全禁用所有 HMR 和 Fast Refresh
- ❌ 沒有 WebSocket 連接
- ❌ 不會自動重新載入
- ✅ 錯誤會保持在螢幕上
- ✅ 最佳除錯體驗
- ✅ 使用自定義開發伺服器

## 使用建議

### 除錯時
```bash
# 使用完全禁用模式
npm run dev:no-hmr
```

### 一般開發時
```bash
# 使用正常模式
npm run dev
```

## 其他除錯技巧

### 1. 瀏覽器控制台設定
- 開啟瀏覽器開發者工具（F12）
- 在 Console 標籤中點擊設定圖標
- 勾選 "Preserve log" 選項
- 即使頁面重新載入，錯誤訊息也會保留

### 2. 手動控制
- 在有錯誤時按 `Ctrl+C` 停止開發伺服器
- 查看錯誤訊息
- 修復後重新啟動 `npm run dev`

### 3. 錯誤邊界組件
應用程式已包含 `ErrorBoundary` 組件，會：
- 捕獲 React 錯誤
- 顯示友善的錯誤介面
- 在開發模式下顯示詳細的錯誤堆疊
- 提供重試和重新載入選項

## 環境變數控制

在 `.env` 中設定：

```bash
# 部分禁用 Fast Refresh
DISABLE_FAST_REFRESH=true

# 完全禁用所有 HMR（不建議在 .env 中設定，請使用 npm run dev:no-hmr）
# DISABLE_ALL_HMR=true
```

## 注意事項

- `npm run dev:no-hmr` 適合除錯，但開發效率較低
- 修復錯誤後建議切換回 `npm run dev` 以獲得更好的開發體驗
- 在生產環境中這些設定不會生效