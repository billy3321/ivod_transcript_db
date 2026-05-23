# Dependency Upgrade Evaluation — 2026-05

## 已執行的升級

### Patch / Minor（within current major，零風險）

| Package | From | To |
|---|---|---|
| @elastic/elasticsearch | 8.18.2 | 8.19.1 |
| @tanstack/react-query | 5.77.0 | 5.100.14 |
| autoprefixer | 10.4.21 | 10.5.0 |
| dotenv | 16.5.0 | 16.6.1 |
| hls.js | 1.6.4 | 1.6.16 |
| mysql2 | 3.14.1 | 3.22.3 |
| pg | 8.16.0 | 8.21.0 |
| @tailwindcss/postcss | 4.1.7 | 4.3.0 |
| tailwindcss | 4.1.7 | 4.3.0 |
| ts-jest | 29.3.4 | 29.4.11 |

### Major（評估後執行）

| Package | From | To | 評估結果 |
|---|---|---|---|
| `typescript` | 4.9.5 | 5.x | 升級成功；無 production source TS error；測試與 build 全通過 |
| `react-cookie-consent` | 9.0.0 | 10.0.1 | 升級成功（Task 3.1 已做）；API 相容 |
| `sqlite3` | 5.1.7 | 6.0.1 | 升級成功（Task 3.1 已做）；native binding 重建 OK |

## 暫不升級的 Major Bumps（理由）

### eslint 8 → 9
- ESLint 9 強制 flat config（`eslint.config.js`）migration
- 目前用 `.eslintrc` + `eslint-config-next@13`
- 風險：migration 需要時間、可能影響 `next lint` 行為
- **決策**：暫不升；等 eslint-config-next 對 flat config 支援更穩定

### eslint-config-next 13 → 16
- 與 ESLint 9 / flat config 綁定
- **決策**：與 eslint 一起評估

### next 15 → 16
- 主版本變動含 Server Components 行為變更、App Router 預設等
- 本專案使用 Pages Router；升 16 主要 break point 是 dependency 行為
- **決策**：暫不升；目前 15.5.18 patches 已修補大部分 CVE

### react 18 → 19
- React 19 含許多 breaking changes（useFormStatus、act 行為、cleanup timing 等）
- 套件相容性：@testing-library/react 13 仍是 React 18 系。Migration 需先升 testing-library 到 16
- **決策**：暫不升；風險/收益比不佳

### prisma 4 → 5/6/7
- 見 `docs/security/prisma-upgrade-evaluation.md`（Task 3.2）

### zod 3 → 4
- v4 是大幅 API 重構
- 多處使用 Zod schemas（MCP handler、search params）
- **決策**：暫不升；等社群與 examples 成熟

### jest 29 → 30
- 主要影響 jest-environment-jsdom、@types/jest
- testing-library 升級的 dependency
- **決策**：暫不升

### cypress 14 → 15
- 主要是 dev/test 工具
- **決策**：暫不升（已不在 npm audit 高風險清單）

## 驗證指令

```bash
cd app
npm run test:ci    # 全測試
npm run build      # production build
npx tsc --noEmit   # TS 編譯
npm run lint       # ESLint
```
