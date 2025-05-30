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
├── lib/                        # client setup：db.ts (Prisma), elastic.ts (ES)
└── prisma/schema.prisma        # Prisma schema 定義 IVODTranscript model
```

### 2.4 本地開發流程
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

### 2.5 部署與生產
```
npm run build
npm start
```
支援部署至 Vercel、Docker 或 Ubuntu+nginx+systemd。

### 2.6 測試 (Unit / E2E)
- Unit Tests：Jest + React Testing Library，測試放在 `app/__tests__`
- E2E Tests：Cypress，spec 放在 `cypress/integration`
- `package.json` 已定義 `test`、`test:ci`、`cypress:open`、`cypress:run`

詳細使用與開發說明請參考 [app/README.md](app/README.md)。

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.