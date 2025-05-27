# Next.js 快取管理指南

## 🗂️ Next.js 快取類型

Next.js 有多層快取機制，了解這些有助於除錯和效能調整：

### 1. **Build Cache** (`.next/` 目錄)
- **位置**: `.next/cache/webpack/`
- **內容**: Webpack 編譯快取、頁面建置結果
- **影響**: 編譯速度、頁面渲染

### 2. **Server-Side Cache**
- **位置**: `.next/server/pages/`
- **內容**: 預渲染的 HTML 頁面
- **影響**: SSR 頁面載入速度

### 3. **Static Cache**
- **位置**: `.next/static/`
- **內容**: CSS、JavaScript 檔案
- **影響**: 前端資源載入

### 4. **Node Modules Cache**
- **位置**: `node_modules/.cache/`
- **內容**: npm 套件快取
- **影響**: 安裝速度

## 🧹 快取清理指令

### 基本清理
```bash
# 清理 Next.js 建置快取
npm run clean

# 等同於
rm -rf .next
```

### 深度清理
```bash
# 清理所有快取（包括 node_modules 快取）
npm run clean:all

# 等同於
rm -rf .next node_modules/.cache .cache
```

### 完整重置
```bash
# 清理快取並重新生成 Prisma
npm run clean:hard

# 等同於
rm -rf .next node_modules/.cache .cache && npm run prisma:generate
```

### 全新開始
```bash
# 完全重新安裝（最徹底）
npm run fresh-start

# 等同於
rm -rf .next node_modules/.cache .cache && npm install && npm run prisma:generate
```

## 🎯 什麼時候需要清理快取？

### 必須清理的情況：
- ✅ **修改 `next.config.js`** 後
- ✅ **修改 Webpack 配置** 後
- ✅ **升級 Next.js 版本** 後
- ✅ **修改 TypeScript 配置** 後
- ✅ **Prisma schema 變更** 後

### 可能需要清理的情況：
- ⚠️ **頁面顯示舊內容**
- ⚠️ **CSS 樣式不更新**
- ⚠️ **建置錯誤難以解決**
- ⚠️ **hot reload 異常**

### 不需要清理的情況：
- ❌ **一般程式碼修改**
- ❌ **新增 React 組件**
- ❌ **修改 API 路由內容**

## 🔄 開發流程建議

### 日常開發
```bash
# 正常啟動開發伺服器
npm run dev

# 遇到問題時除錯
npm run dev:no-hmr
```

### 遇到快取問題
```bash
# 1. 先嘗試基本清理
npm run clean && npm run dev

# 2. 如果還有問題，深度清理
npm run clean:all && npm run dev

# 3. 最後手段：完全重置
npm run fresh-start && npm run dev
```

### 部署前準備
```bash
# 確保乾淨的建置
npm run clean
npm run build
npm run start
```

## 🚀 效能影響

### 清理後的首次啟動時間：
- **`npm run clean`**: +10-30秒
- **`npm run clean:all`**: +30-60秒  
- **`npm run fresh-start`**: +2-5分鐘

### 清理的好處：
- ✅ **解決快取相關錯誤**
- ✅ **確保最新程式碼運行**
- ✅ **釋放磁碟空間**
- ✅ **解決編譯問題**

## 🔍 特定快取問題處理

### CSS 樣式不更新
```bash
npm run clean
# 然後檢查 Tailwind 配置
```

### API 路由快取問題
```bash
# API 路由通常不會快取，但如果有問題：
curl -H "Cache-Control: no-cache" http://localhost:3000/api/ivods
```

### Prisma 相關問題
```bash
npm run clean:hard  # 會重新生成 Prisma client
```

### 靜態資源問題
```bash
# 強制瀏覽器重新載入
Ctrl+F5 (Windows) 或 Cmd+Shift+R (Mac)
```

## 🛠️ 進階快取控制

### 禁用特定快取（開發時）
```javascript
// next.config.js
module.exports = {
  // 禁用快取 (開發除錯用)
  ...(process.env.NODE_ENV === 'development' && {
    generateEtags: false,
    compress: false,
    experimental: {
      optimizeCss: false,
    }
  })
}
```

### 檢查快取大小
```bash
# 檢查 .next 目錄大小
du -sh .next

# 檢查 node_modules 快取大小  
du -sh node_modules/.cache
```

## 📝 最佳實踐

1. **定期清理**: 每週執行一次 `npm run clean`
2. **版本升級後**: 必須執行 `npm run clean:all`
3. **CI/CD**: 部署時自動執行清理
4. **團隊協作**: 共享清理指令，確保環境一致

## ⚡ 快速參考

| 問題類型 | 推薦指令 | 執行時間 |
|---------|----------|----------|
| 一般快取問題 | `npm run clean` | ~30秒 |
| 深層快取問題 | `npm run clean:all` | ~1分鐘 |
| Prisma 問題 | `npm run clean:hard` | ~1分鐘 |
| 完全重置 | `npm run fresh-start` | ~3分鐘 |

記住：清理快取是解決 Next.js 開發問題的重要工具！