# IVOD 搜尋邏輯完整說明

## 概述

IVOD 搜尋系統實作了一個複雜的雙層搜尋架構，滿足以下 6 個核心需求：

## 1. 非即時搜尋 ✅

**需求**: 搜尋不會自動觸發，必須手動按下搜尋按鈕才開始

**實作方式**:
- 搜尋框輸入時僅更新 `searchQuery` state
- 進階搜尋欄位變更時僅更新 `advancedInput` state  
- 搜尋只在以下情況觸發：
  - 點擊「搜尋」按鈕
  - 按下 Enter 鍵
- `handleSearch()` 更新 `filters` state → 觸發 `useEffect` → 執行實際搜尋

**檔案位置**: `pages/index.tsx` (lines 217-234)

## 2. 上方搜尋進階語法支援 ✅

**需求**: 主搜尋框支援 AND、OR、引號、括弧等複雜語法

**支援語法**:
- **引號搜尋**: `"完整會議"` - 精確詞組匹配
- **布林運算**: `預算 AND 教育`, `王委員 OR 李委員`
- **括弧分組**: `(預算 OR 教育) AND 委員會`
- **欄位搜尋**: `title:"會議名稱"`, `speaker:"立委姓名"`
- **排除搜尋**: `-詞彙`, `-"詞組"`
- **複合查詢**: `(speaker:"王委員" OR speaker:"李委員") AND "預算" -"國防"`

**搜尋模式**:
- **搜尋全部欄位**: 搜尋標題、會議、發言人、委員會、逐字稿
- **僅搜尋逐字稿**: 只搜尋 ai_transcript 和 ly_transcript

**檔案位置**: 
- `lib/searchParser.ts` - 進階語法解析
- `pages/api/search.ts` - 搜尋 API 實作

## 3. 下方進階搜尋使用 LIKE 模糊搜尋 ✅

**需求**: 進階搜尋表單使用 LIKE 查詢進行部分匹配

**實作細節**:
- **會議名稱**、**立委姓名**、**委員會** 使用 `LIKE %pattern%` 查詢
- 當任何字串欄位篩選器存在時自動觸發通用搜尋
- 跨 SQLite、PostgreSQL、MySQL 所有後端運作
- 範例: "社會福利" 可以匹配 "社會福利及衛生環境委員會"

**觸發條件**:
```typescript
function shouldUseUniversalSearch(params) {
  const { meeting_name, speaker, committee } = params;
  return !!(meeting_name || speaker || committee);
}
```

**檔案位置**:
- `lib/universal-search.ts` - 通用搜尋實作
- `pages/api/ivods.ts` - API 整合 (lines 45-53)

## 4. 上方與下方搜尋可結合或分開運作 ✅

**需求**: 兩個搜尋區域可以一起使用或獨立使用

**運作邏輯**:
- **結合使用**: 上方搜尋(q) + 下方篩選器 → 組合 WHERE 條件
- **僅上方**: 只有 q 參數 → 標準欄位搜尋或僅逐字稿搜尋
- **僅下方**: 只有進階篩選器 → LIKE 模糊匹配
- **日期範圍**: 相容於上方和下方搜尋

**搜尋流程**:
1. 檢查是否為僅逐字稿模式 → 使用 `/api/search` 然後 `/api/ivods`
2. 檢查是否需要通用搜尋 → 使用 LIKE 查詢進行部分匹配  
3. 否則 → 使用標準 Prisma 查詢

**檔案位置**: 
- `pages/index.tsx` (lines 154-211) - 搜尋流程
- `pages/api/ivods.ts` - API 邏輯

## 5. Elasticsearch 優先，資料庫 Fallback ✅

**需求**: 逐字稿搜尋優先使用 ES，不可用時切換到資料庫

**ES 整合**:
- **啟用檢查**: `ENABLE_ELASTICSEARCH !== 'false'`
- **主要**: 對逐字稿搜尋使用 ES 與進階查詢建構
- **備援**: 自動切換到資料庫並使用等效 WHERE 條件
- **優雅降級**: 記錄失敗並繼續使用資料庫搜尋
- **進階語法**: ES 和 DB 都完全支援布林邏輯、欄位搜尋、排除

**備援指示器**:
- `/api/search` 使用資料庫時回傳 `{ fallback: true }`
- 記錄 ES 失敗以便監控
- 無論後端如何都維持相同搜尋行為

**檔案位置**:
- `pages/api/search.ts` (lines 38-85) - ES 邏輯
- `lib/searchParser.ts` - 查詢建構

## 6. 資料庫後端相容性 ✅

**需求**: 搜尋功能在 SQLite、MySQL、PostgreSQL 正確運作

**資料庫特定處理**:

### MySQL:
- 不支援 `mode: 'insensitive'` → 使用基本 `contains`
- JSON 欄位使用 `string_contains` → 部分匹配受限 → 使用通用搜尋
- 委員會欄位 → LIKE 查詢以正確部分匹配

### PostgreSQL:
- 陣列欄位對 committee_names 使用 `has` 運算子
- 完整支援 `mode: 'insensitive'` 大小寫不敏感
- 支援 JSON 操作

### SQLite:
- 僅基本 `contains` 查詢
- 無大小寫不敏感模式
- 基於字串的 committee_names 欄位

**通用搜尋優勢**:
- 在所有後端提供一致的基於 LIKE 的部分匹配
- 繞過 MySQL JSON 欄位限制
- 無論資料庫選擇都維持相同行為

**檔案位置**:
- `lib/utils.ts` - createContainsCondition
- `lib/universal-search.ts` - LIKE 實作

## 測試驗證

**快速驗證**: `scripts/quick-search-verification.js`
**完整測試**: `scripts/test-complete-search-logic.js`

測試涵蓋:
- 非即時搜尋行為
- 所有進階語法模式
- LIKE 模糊匹配
- 結合搜尋操作
- ES/DB 切換行為
- 跨資料庫相容性

## 關鍵檔案

| 檔案 | 功能 |
|------|------|
| `pages/index.tsx` | 前端搜尋介面與狀態管理 |
| `pages/api/search.ts` | 逐字稿搜尋 API (ES + DB fallback) |
| `pages/api/ivods.ts` | IVOD 列表搜尋 API (通用搜尋整合) |
| `lib/searchParser.ts` | 進階語法解析器 |
| `lib/universal-search.ts` | LIKE 基於的通用搜尋 |
| `lib/utils.ts` | 資料庫相容性工具 |

## 確保未來記住的重點

1. **絕對不要自動觸發搜尋** - 用戶必須手動啟動
2. **上方搜尋支援複雜語法** - 完整的布林邏輯和欄位搜尋
3. **下方搜尋使用 LIKE** - 模糊匹配對所有字串欄位
4. **可以結合或分開** - 彈性的搜尋組合
5. **ES 優先但有備援** - 確保搜尋永遠可用
6. **跨資料庫支援** - 處理每個 DB 的特殊性

這個搜尋系統設計為強健、彈性且用戶友善，適應各種搜尋需求和技術環境。