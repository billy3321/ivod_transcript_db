# IVOD 逐字稿檢索系統

本儲存庫包含兩個子專案，分別負責從台灣立法院 IVOD 服務擷取逐字稿並提供網頁瀏覽與搜尋：

## 一、爬蟲專案 (crawler)

### 1.1 概覽
本子專案負責從「台灣立法院 IVOD 服務」擷取逐字稿，並寫入關聯式資料庫（SQLite/PostgreSQL/MySQL）與 Elasticsearch。

### 1.2 專案結構
```
crawler/
├── ivod/               # 核心套件：crawler.py, core.py, tasks.py, db.py
├── ivod_full.py        # 全量抓取 wrapper
├── ivod_incremental.py # 增量更新 wrapper
├── ivod_retry.py       # 失敗重抓 wrapper
├── ivod_es.py          # Elasticsearch 索引更新腳本
├── integration_test.py # 一鍵跑整合測試
├── .env(.example)、openssl.cnf、requirements*.txt
└── tests/              # pytest tests: core/、crawler/、db/、tasks/
```
### 1.3 使用範例
```
# 首次或重置：全量拉取
./ivod_full.py
# 定期 (每日)：增量更新
./ivod_incremental.py
# 重新補抓失敗紀錄
./ivod_retry.py
```

### 1.4 部署與排程
- Ubuntu 上建立專用帳號、git clone、venv、pip install、logs 目錄等
- Cron 定時：每日02:00增量、03:00重試，月初04:00全量
```
0 2 * * * … python ivod_incremental.py >> logs/incremental.log 2>&1
0 3 * * * … python ivod_retry.py >> logs/retry.log 2>&1
0 4 1 * * … python ivod_full.py >> logs/full.log 2>&1
```

### 1.5 Elasticsearch 索引
- 安裝中文分詞插件：analysis-ik / analysis-smartcn
- .env 中設定 ES 連線與索引名稱
- 執行 `./ivod_es.py` 更新索引

### 1.6 測試 (pytest)
- 使用 pytest，dev dependencies 在 `requirements-dev.txt`
- 單元測試放在 `tests/core/`、`tests/crawler/`、`tests/db/`、`tests/tasks/`
- 建議將整合測試標上 `@pytest.mark.integration`；可用 Docker Compose 啟起測試 DB/ES
- 一鍵整合測試：
```
cd crawler && TEST_SQLITE_PATH=../db/ivod_test.db python integration_test.py
```
- 執行所有測試並收集 coverage：
```
pytest --cov=ivod_core --cov=ivod_tasks --cov-report=term-missing
```

詳細使用與開發說明請參考 [crawler/README.md](crawler/README.md)。

## 二、Web 應用 (app)

### 2.1 概覽
本子專案基於 Next.js + React + TypeScript，提供 IVOD 逐字稿的列表檢視、全文搜尋與逐筆細節顯示。

### 2.2 技術棧
- Next.js (React + TypeScript)
- Node.js API Routes
- Prisma ORM（支援 PostgreSQL / MySQL / SQLite）
- Elasticsearch 全文字搜尋；搭配 bodybuilder 建 Query DSL
- 可選：Searchkit、Tailwind CSS、React Query

### 2.3 專案結構
```
app/
├── pages/                      # Next.js 頁面路由
│   ├── index.tsx               # IVOD 列表 + 搜尋
│   ├── ivod/[id].tsx           # 單筆 IVOD 細節
│   └── api/                    # 後端 API 路由：ivods 列表/細節 & search
├── components/                 # UI 元件：List, SearchForm, Pagination, TranscriptViewer...
│   └── VideoDownloader.tsx     # 影片下載元件
├── lib/                        # client setup：db.ts (Prisma), elastic.ts (ES)
├── scripts/                    # 測試腳本與實用工具
└── prisma/schema.prisma        # Prisma schema 定義 IVODTranscript model
```

### 2.4 影片下載功能 (2025-08)
**核心功能**：直接在瀏覽器內下載 IVOD 影片檔案，無需伺服器額外儲存。

**主要特色**：
- **串流式下載技術**：採用分批處理與記憶體串流，大幅減少記憶體使用
- **智慧解析 M3U8**：自動解析播放列表並處理巢狀結構
- **跨平台相容性**：支援所有主流瀏覽器，並可在行動裝置上運作
- **優異記憶體效率**：實測記憶體效率比率達 17:1（下載 12.45MB 影片僅使用 0.73MB 記憶體）

**技術實作**：
- **批次下載**：每批處理 5 個影片片段，避免記憶體溢位
- **串流處理**：使用 ReadableStream 與 TransformStream API 進行即時數據處理
- **MP4 轉換**：整合 FFmpeg WebAssembly 進行即時格式轉換
- **錯誤處理**：完整的網路失敗重試機制與進度追蹤
- **檔案格式**：影片以 MP4 格式儲存，具有最佳跨平台相容性
- **安全性**：完全在客戶端處理，不經過伺服器，保護使用者隱私

**使用方式**：
在 IVOD 詳細頁面中，若該筆記錄包含 `video_url` 欄位，將自動顯示「下載影片」按鈕。點擊後即可開始串流下載。

**效能表現**：
- 支援大型影片檔案（測試 180MB 以上）
- 記憶體使用優化，適合在記憶體受限的環境運行
- 下載進度即時顯示，包含百分比與已下載大小

### 2.5 本地開發流程
```
cd app
npm install
cp .env.example .env
# 若用 SQLite：mkdir -p ../db
# 編輯 .env 設定 DATABASE_URL、DB_PROVIDER、ES 參數
npx prisma generate
npx prisma migrate dev --name init
npm run dev  # http://localhost:3000
```

### 2.6 部署與生產
```
npm run build
npm start
```
支援部署至 Vercel、Docker 或 Ubuntu+nginx+systemd。

### 2.7 測試與驗證
- **Unit Tests**：Jest + React Testing Library，測試放在 `app/__tests__`
- **E2E Tests**：Cypress，spec 放在 `cypress/integration`
- **資料庫測試**：`npm run db:test` - 測試資料庫連線與相容性
- **Elasticsearch 測試**：`npm run es:test` - 測試 ES 連線與功能
- **環境控制**：可透過 `ENABLE_ELASTICSEARCH=false` 停用 ES 搜尋功能

詳細使用與開發說明請參考 [app/README.md](app/README.md)。

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.