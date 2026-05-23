# Prisma 4 → 5/6/7 升級評估

## 現況

- 目前版本：`@prisma/client@4.16.2`、`prisma@4.16.2`
- 最新版本：7.8.0（2026-05）
- 主要 API 使用：
  - `prisma.iVODTranscript.findMany/findUnique/findFirst/count` — 標準 CRUD
  - `prisma.$queryRaw` 搭配 `Prisma.sql`、`Prisma.join`、`Prisma.raw`、`Prisma.empty`（`lib/universal-search.ts`）
  - `prisma.$queryRaw\`SELECT 1\`` healthcheck（`lib/health.ts`）

## 本專案受影響的 Prisma 4 → 5 breaking changes

依 Prisma 5.0 release notes 與 upgrade guide：

| Breaking change | 本專案是否受影響 | 行動 |
|---|---|---|
| `rejectOnNotFound` 移除 | ❌ 未使用 | 無 |
| JSON Protocol 預設改 | ❌ 不需處理（client 自動） | 無 |
| 移除 `Array Scalar Field` 預設行為改變 | ⚠️ committee_names PostgreSQL 是 `String[]` | 需驗證行為仍正確 |
| `$queryRaw` 與 `Prisma.sql` 行為 | ✅ 已使用 type-safe 方式 | 維持運作 |
| Node.js 14 不再支援 | ✅ 已 Node 18+ | 無 |
| Field reference / nested filter changes | ❌ 未使用 | 無 |
| 移除 `Array<...>` find 行為 | ❌ 未使用 | 無 |

### Prisma 5 → 6 breaking changes（額外）

| Breaking change | 本專案是否受影響 | 行動 |
|---|---|---|
| Node.js 16 不再支援，需 18.18+ | ✅ 已 Node 18+ | 無 |
| `Buffer` 改用 `Uint8Array` | ❌ 未直接使用 Buffer 型別 | 無 |
| `NotFoundError` 取代於 `findUniqueOrThrow` | ❌ 未使用 `findUniqueOrThrow` | 無 |
| 預設使用 Wasm engine（serverless） | ⚠️ 可選；非 serverless 部署可關閉 | 測試後確認 |

### Prisma 6 → 7 breaking changes（額外）

- `prisma generate` 預設改 ESM
- 部分 utility API 重整
- 必須 Node.js 20+

本專案目前環境（PM2 + Node 18+）需先評估 PM2/cluster mode 與 ESM 相容性。

## 建議升級路徑

### 階段 1：4 → 5（建議近期執行）
- 風險低，主要影響為內部行為改進
- 預期測試全通過、build 通過
- **驗收**：所有 `__tests__/lib/universal-search.test.ts`、`__tests__/ivods-api.test.ts`、`__tests__/health-api.test.ts` 通過

### 階段 2：5 → 6（評估 Wasm engine 影響後）
- Wasm engine 可能影響部署 image 大小、cold start
- 對非 serverless 部署影響小

### 階段 3：6 → 7（先確認 Node 20+ 部署完成）

## 試升步驟（手動執行，不在本 PR 範圍）

```bash
cd app
# Backup current state
git checkout -b prisma-5-upgrade

# 升 4 → 5
npm install @prisma/client@5 prisma@5
npm run prisma:generate
npm run test:ci
npm run build

# 驗證：跑 search/ivod 相關所有測試
npm test -- --testPathPattern="universal-search|ivods|search|health"

# 三後端驗證
DB_BACKEND=sqlite npm run test:ci
DB_BACKEND=mysql npm run test:ci
# PostgreSQL 需要實際 PG instance
```

## 結論

**短期建議**：執行階段 1（4 → 5），預期 1 PR 可完成。
**中期**：評估階段 2 與 6。
**長期**：等 Node 20+ 部署 ready 再上 7。

本 PR 範圍**不直接執行升級**（依原 plan Task 3.2 要求），僅提供評估報告作為後續決策依據。
