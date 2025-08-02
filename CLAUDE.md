# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dual-component system for scraping and serving Taiwan Legislative Yuan IVOD (Internet Video on Demand) transcripts:

1. **Crawler Component** (`crawler/`): Python-based scraper that extracts transcripts from IVOD service and stores them in relational databases (SQLite/PostgreSQL/MySQL) and Elasticsearch
2. **Web Application** (`app/`): Next.js React application providing search and browsing interface for transcripts

## Architecture

### Crawler Architecture (`crawler/`)
- **Core Module**: `ivod/core.py` - Database setup, ORM models, HTTP/scraping utilities
- **Task Workflows**: `ivod/tasks.py` - Main execution workflows (full/incremental/retry)
- **Entry Points**: `ivod_full.py`, `ivod_incremental.py`, `ivod_retry.py` - CLI wrappers
- **Database Models**: Single `IVODTranscript` model with status tracking for processing states
- **Multi-backend Support**: SQLite, PostgreSQL, MySQL via SQLAlchemy
- **Elasticsearch Integration**: Full-text search indexing with Chinese analysis support

### Web Application Architecture (`app/`)
- **Framework**: Next.js with TypeScript, API routes for backend logic
- **Database**: Prisma ORM with multi-backend support (SQLite/PostgreSQL/MySQL)
- **Search**: Elasticsearch integration with fallback to database search
- **MCP Server**: Model Context Protocol integration for AI service access
- **UI Components**: Modular React components for list, search, pagination, transcript viewing
- **Video Download**: Streaming download component for IVOD video files with memory optimization
- **Styling**: Tailwind CSS v4 with responsive design and Chinese font support
- **Testing**: Jest + React Testing Library + Cypress E2E

## Development Commands

### Crawler Commands (`crawler/`)
```bash
# Setup environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For testing
cp .env.example .env                  # Configure DB_BACKEND and connection parameters
mkdir -p ../db                        # For shared SQLite database

# Data collection workflows
./ivod_full.py          # Full data capture (first run or reset)
./ivod_incremental.py   # Incremental update (daily)
./ivod_retry.py         # Retry failed records

# Elasticsearch indexing
./ivod_es.py            # Update search index

# Testing
pytest --cov=ivod --cov-report=term-missing
pytest -m integration  # Run integration tests only
TEST_SQLITE_PATH=../db/ivod_test.db python integration_test.py

# Comprehensive test coverage (2025-06 improvements)
pytest tests/tasks/test_tasks_comprehensive.py        # Workflow coverage tests
pytest tests/db/test_db_comprehensive.py             # Database coverage tests
pytest tests/db/test_database_env_comprehensive.py   # Environment config tests
pytest tests/crawler/test_crawler_comprehensive.py   # Crawler coverage tests
```

### Web Application Commands (`app/`)
```bash
# Setup and development
npm install
cp .env.example .env  # Configure database and Elasticsearch
npm run prisma:prepare     # Update schema based on .env DB_BACKEND
npm run prisma:generate     # Generate Prisma client
npm run dev                 # Development server (localhost:3000)

# Production
npm run build              # Build for production
npm start                  # Start production server

# Testing
npm run test              # Jest unit tests (watch mode)
npm run test:ci           # Jest tests (CI mode)
npm run cypress:open      # Cypress E2E tests (interactive)
npm run cypress:run       # Cypress E2E tests (headless)

# Linting
npm run lint              # ESLint checks
```

## Key Implementation Details

### Database Schema
The system uses a single shared database with one main table:
- `IVODTranscript`: Stores transcript metadata, content, and processing status
- Status field tracks: 'success', 'failed', 'pending' for retry logic
- Retry count prevents infinite retry loops (MAX_RETRIES=5)

### Environment Configuration
Both components share similar `.env` configuration:
- `DB_BACKEND`: "sqlite", "postgresql", or "mysql" 
- Database connection parameters specific to chosen backend
- `SKIP_SSL`: Boolean for SSL verification bypass
- Elasticsearch settings (ES_HOST, ES_PORT, ES_INDEX, etc.)

### Data Flow
1. Crawler fetches IVOD data and stores in database with status tracking
2. Failed records can be retried via `ivod_retry.py`
3. Elasticsearch indexing runs separately via `ivod_es.py`
4. Web app reads from same database and searches via Elasticsearch (with DB fallback)
5. MCP server provides standardized API for AI services to access transcript data

### Error Handling Patterns
- HTTP failures are caught and marked with status="failed"
- Empty/invalid content results in failed status for retry
- SSL issues can be bypassed with `skip_ssl=True`
- Database connection errors use SQLAlchemy's connection pooling

## Testing Strategy

### Crawler Testing
- Unit tests with pytest framework
- Integration tests marked with `@pytest.mark.integration`
- Mock HTTP responses with requests-mock
- In-memory SQLite for database testing
- Coverage reporting included
- **Comprehensive Test Suite (2025-06)**: 1600+ lines of comprehensive tests for improved coverage
  - Database availability testing with user feedback messages
  - Environment configuration testing for development/production/testing scenarios
  - Workflow logic testing including error handling and retry mechanisms
  - HTTP scraping and SSL handling comprehensive coverage

### Web Application Testing
- Jest + React Testing Library for component tests
- Cypress for E2E testing of user workflows
- API route testing with mocked dependencies
- Tests located in `__tests__/` and `cypress/integration/`
- **Comprehensive Test Coverage (2025-06)**: 89.94% overall coverage achieved
  - Comprehensive test suites for logger-client.ts (100% coverage)
  - API middleware testing with full error scenario coverage (96.82%)
  - Utilities testing with cross-database compatibility (93.75%)
  - Edge case testing and browser environment compatibility
- **影片下載功能測試**: 完整的單元測試與整合測試
  - VideoDownloader 組件測試涵蓋各種情境
  - 真實 M3U8 網址測試驗證實際下載功能
  - 記憶體使用效率測試確保大檔案下載安全性
  - 串流式下載技術的效能與穩定性驗證

## Production Deployment Notes

### Crawler Production
- Deployed on Ubuntu with dedicated user account
- Cron scheduling: incremental daily at 02:00, retry at 03:00, full monthly
- Logs stored in `logs/` directory
- Python virtual environment isolation

### Web Application Production
- Next.js production build with `npm run build`
- Can be deployed to Vercel, Docker, or Ubuntu+nginx+systemd
- Prisma generates client based on `DB_BACKEND` environment variable
- Static asset optimization included

## Common Development Issues

### Database Backend Switching
- Update `.env` DB_BACKEND setting
- Run `npm run prisma:prepare` to update schema provider
- Regenerate Prisma client with `npm run prisma:generate`

### SSL/HTTPS Issues
- Set `SKIP_SSL=True` in `.env` if encountering certificate problems
- Crawler includes `openssl.cnf` for SSL configuration

### Date Range Configuration
- Full capture start date is configurable in `ivod/tasks.py` `run_full()`
- Incremental updates cover last 2 weeks by default

### Elasticsearch Setup
- Install Chinese analysis plugins: `analysis-ik` or `analysis-smartcn`
- Index configuration handled automatically by `ivod_es.py`
- Web app falls back to database search if Elasticsearch unavailable

## 影片下載功能 (Video Download Feature)

### 功能概述
網頁應用程式提供了先進的 IVOD 影片下載功能，讓使用者能夠直接在瀏覽器中下載立法院會議影片。此功能採用串流式下載技術，具備優異的記憶體使用效率，適用於大檔案下載。

### 核心特色

#### 🚀 串流式下載技術
- **分批處理**: 每批處理 5 個影片片段，避免一次性載入大量資料
- **記憶體優化**: 下載 180MB 影片僅需約 10MB 記憶體 (效率比 17:1)
- **即時合併**: 邊下載邊處理，無需等待全部片段完成
- **垃圾回收**: 批次間自動暫停，讓瀏覽器進行記憶體清理

#### 📱 跨平台相容性
- **桌面瀏覽器**: 完全支援大檔案下載
- **行動裝置**: 記憶體友善設計，適用於手機和平板
- **老舊設備**: 低記憶體需求，提升相容性
- **格式支援**: 輸出標準 TS 格式，相容 VLC 等播放器

#### 🔧 智慧解析與處理
- **自動偵測**: 識別主播放列表 vs. 影片片段列表
- **遞迴解析**: 支援巢狀 M3U8 播放列表結構
- **路徑處理**: 正確轉換相對路徑為絕對路徑
- **錯誤恢復**: 自動跳過損壞片段，繼續下載其他部分

#### 📊 即時進度顯示
- **詳細進度**: 顯示百分比、當前片段數、已下載大小
- **視覺化**: 漸層進度條與動畫載入指示器
- **狀態回饋**: 清楚顯示下載狀態與可能的錯誤訊息
- **檔案資訊**: 估算總大小與下載時間

### 技術實作

#### 組件架構
```typescript
VideoDownloader.tsx          // 主要下載組件
├── parseM3U8()              // M3U8 播放列表解析
├── downloadVideoStreaming() // 串流式下載核心邏輯
├── 分批處理邏輯              // 記憶體優化的批次下載
└── 進度與錯誤處理            // 使用者介面狀態管理
```

#### 關鍵技術特點
- **Streams API**: 使用 ReadableStream 進行串流處理
- **分批並行**: 每批並行下載多個片段，提升效率
- **記憶體管理**: 批次間暫停與垃圾回收機制
- **錯誤處理**: 容錯設計，單一片段失敗不影響整體下載

#### 效能指標
- **記憶體效率**: 17.05x (下載資料量/記憶體增加量)
- **下載速度**: 並行下載提升 3-5 倍速度
- **成功率**: 自動跳過損壞片段，確保高下載成功率
- **檔案完整性**: 嚴格按序合併，保證影片播放品質

### 使用方式

#### 1. 基本使用
1. 瀏覽任何 IVOD 影片詳細頁面
2. 確認影片具有有效的 M3U8 網址
3. 點擊橘色的「下載影片」按鈕
4. 觀察即時下載進度
5. 完成後自動儲存為 `.ts` 格式檔案

#### 2. 系統需求
- **瀏覽器**: Chrome 88+, Firefox 87+, Safari 14+, Edge 88+
- **記憶體**: 建議至少 1GB 可用記憶體
- **儲存空間**: 根據影片大小預留足夠空間
- **網路**: 穩定的網際網路連線

#### 3. 故障排除
- **下載失敗**: 檢查網路連線與影片網址有效性
- **記憶體不足**: 關閉其他瀏覽器分頁釋放記憶體
- **檔案損壞**: 重新下載或使用其他播放器開啟
- **速度緩慢**: 檢查網路頻寬與伺服器回應速度

### 測試與驗證

#### 自動化測試
```bash
# 單元測試
npm test VideoDownloader

# 整合測試  
npm test VideoDownloader.integration

# 真實網址測試
node scripts/manual-video-download-test.js

# 記憶體效率測試
node scripts/test-streaming-download.js
```

#### 測試涵蓋範圍
- ✅ 各種 M3U8 格式的解析測試
- ✅ 網路錯誤與重試機制測試  
- ✅ 記憶體使用量監控與驗證
- ✅ 大檔案下載穩定性測試
- ✅ 跨瀏覽器相容性測試

### 最佳實務建議

#### 開發者指南
- 定期測試真實 IVOD 網址的可用性
- 監控下載功能的記憶體使用模式
- 適時調整批次大小以優化效能
- 關注瀏覽器相容性與新功能支援

#### 使用者建議
- 下載大檔案前關閉不必要的瀏覽器分頁
- 確保有足夠的本機儲存空間
- 使用穩定的網路環境進行下載
- 建議使用 VLC 播放器開啟下載的 TS 檔案