# 資料庫切換指南

本專案支援三種資料庫後端：SQLite、PostgreSQL 和 MySQL。不同資料庫的資料型別會有所差異，系統會自動處理這些差異。

## 資料庫型別差異

### 欄位型別對照表

| 欄位 | SQLite | PostgreSQL | MySQL |
|------|--------|------------|-------|
| `date` | String | DateTime | DateTime |
| `meeting_time` | String? | DateTime? | DateTime? |
| `last_updated` | String | DateTime | DateTime |
| `committee_names` | String? | String[]? | Json? |

### 自動化處理

系統透過以下方式自動處理差異：

1. **Schema 自動更新**: `scripts/updatePrismaSchema.js` 會根據 `DB_BACKEND` 環境變數自動調整 Prisma schema
2. **型別統一**: 前端使用 Union types 支援多種資料庫格式
3. **格式化函數**: 提供統一的格式化函數處理不同型別的資料

## 切換資料庫步驟

### 1. 更新環境變數

編輯 `.env` 檔案，設定 `DB_BACKEND`：

```bash
# SQLite (預設)
DB_BACKEND=sqlite
DATABASE_URL="file:../db/ivod_test.db"

# PostgreSQL
DB_BACKEND=postgresql
DATABASE_URL="postgresql://user:password@localhost:5432/ivod_db"

# MySQL
DB_BACKEND=mysql
DATABASE_URL="mysql://user:password@localhost:3306/ivod_db"
```

### 2. 更新 Prisma Schema

```bash
npm run prisma:prepare  # 自動更新 schema
npm run prisma:generate # 重新生成客戶端
```

### 3. 驗證切換

```bash
npm run dev  # 啟動開發伺服器測試
```

## 開發注意事項

### 新增欄位時

如果需要新增資料庫欄位且不同資料庫型別不同，請：

1. 更新 `scripts/updatePrismaSchema.js` 中的處理邏輯
2. 更新 `types.ts` 中的介面定義（使用 Union types）
3. 在 `lib/utils.ts` 中提供格式化函數
4. 更新相關測試

### 測試不同資料庫

```bash
# 測試 SQLite
DB_BACKEND=sqlite npm run test

# 測試 PostgreSQL schema
DB_BACKEND=postgresql node scripts/updatePrismaSchema.js

# 測試 MySQL schema  
DB_BACKEND=mysql node scripts/updatePrismaSchema.js
```

## 技術實作細節

### updatePrismaSchema.js

腳本會根據 `DB_BACKEND` 環境變數：

1. 更新 `datasource.provider`
2. 調整欄位型別：
   - SQLite: 時間戳使用 `String`，委員會使用 `String`
   - PostgreSQL: 時間戳使用 `DateTime`，委員會使用 `String[]`
   - MySQL: 時間戳使用 `DateTime`，委員會使用 `Json`

### 格式化函數

- `formatTimestamp()`: 統一時間戳顯示格式
- `normalizeTimestamp()`: 標準化時間戳為 ISO 格式
- `formatCommitteeNames()`: 處理委員會名稱的不同格式
- `getDbBackend()`: 取得當前資料庫後端類型

這個設計確保了在不同資料庫之間切換時，前端程式碼無需修改，所有差異都在底層自動處理。