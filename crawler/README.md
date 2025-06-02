# ivod_transcript_db

> 本專案用於從台灣立法院 IVOD 服務擷取逐字稿，並將資料儲存至關聯式資料庫 (SQLite / PostgreSQL / MySQL)。

> **核心模組**：`ivod_core.py` (DB 建置 + ORM Model + HTTP/Scraping helper)  
> **工作流程**：`ivod_tasks.py` (定義 run_full / run_incremental / run_retry)  
> **執行腳本**：`ivod_full.py`、`ivod_incremental.py`、`ivod_retry.py` (呼叫 tasks API)  
> **實驗 & 測試**：`test.py` / `Test.ipynb`  
> **設定檔**：`.env` / `.env.example` / `openssl.cnf`  
> **依賴**：`requirements.txt`

---

## 1. 安裝與初始設定

```bash
# 1. 建議使用 venv
python3 -m venv venv
source venv/bin/activate

# 2. 安裝套件
pip install --upgrade pip
pip install -r requirements.txt

# 3. 建置 .env
cp .env.example .env   # 如尚未有 .env
# (若使用 SQLite) 建立共享 DB 資料夾：mkdir -p db
# 編輯 .env：設定 DB_BACKEND 及對應連線參數 (SQLITE_PATH 已預設為 db/ivod_local.db)
```

## 2. 模組化架構

- `ivod_core.py`：核心函式庫，包含 DB URL、ORM model、`make_browser(skip_ssl)`、`fetch_ivod_list`、`process_ivod` 等  
- `ivod_tasks.py`：整合「全量」(full) / 「增量」(incremental) / 「重試」(retry) 三種工作，供 CLI 及 cron 呼叫  
- `ivod_full.py`、`ivod_incremental.py`、`ivod_retry.py`：簡易 wrapper，直接呼叫對應 `run_*()`  
- `test.py`：SSL / HTML parsing 測試用範例

如此可減少重複程式碼，並可在 Python 互動式環境中 `import ivod_tasks` 做進階控制。

## 3. 使用範例

```bash
# 全量拉取 (第一次或需要重置時使用)
./ivod_full.py

# 全量拉取特定日期範圍
./ivod_full.py --start-date 2024-03-01 --end-date 2024-03-31

# 增量更新 (每日定期執行)
./ivod_incremental.py

# 重新嘗試失敗紀錄 (每日/每小時皆可)
./ivod_retry.py

# 補抓錯誤記錄 (從錯誤記錄檔案批量修復)
./ivod_fix.py

# 補抓單一IVOD_ID
./ivod_fix.py --ivod-id 123456

# 更新 Elasticsearch 索引
./ivod_es.py

# 備份與還原資料庫
./ivod_backup.py backup                              # 備份資料庫
./ivod_backup.py restore backup/ivod_backup_xxx.json # 還原資料庫
./ivod_backup.py list                                # 列出備份檔案
```

## 4. 部署於 Ubuntu Linux

### 4.1 建置系統帳號 & 程式碼

```bash
sudo useradd -m ivoduser
sudo su - ivoduser
cd ~
git clone <repo-url> ivod_transcript_db
cd ivod_transcript_db
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 編輯 .env 設定
mkdir logs
```

### 4.2 Cron 定時任務

編輯 `crontab -e`，加入：

```cron
# 每天 02:00 執行增量更新
0 2 * * * cd /home/ivoduser/ivod_transcript_db && /home/ivoduser/ivod_transcript_db/venv/bin/python ivod_incremental.py >> logs/incremental.log 2>&1

# 每天 03:00 執行重新嘗試失敗
0 3 * * * cd /home/ivoduser/ivod_transcript_db && /home/ivoduser/ivod_transcript_db/venv/bin/python ivod_retry.py >> logs/retry.log 2>&1

# 每月 1 日 04:00 全量拉取 (視需要)
0 4 1 * * cd /home/ivoduser/ivod_transcript_db && /home/ivoduser/ivod_transcript_db/venv/bin/python ivod_full.py >> logs/full.log 2>&1

# 每天 04:00 執行錯誤記錄補抓
0 4 * * * cd /home/ivoduser/ivod_transcript_db && /home/ivoduser/ivod_transcript_db/venv/bin/python ivod_fix.py >> logs/fix.log 2>&1
```

> 若偏好 Systemd Timer，可另行設定。

## 5. 錯誤記錄與補抓機制

本系統提供完整的錯誤記錄與補抓功能，確保不遺漏任何IVOD資料。

### 5.1 錯誤記錄

所有在抓取過程中發生錯誤的IVOD_ID都會自動記錄到錯誤日誌檔案：
- **預設路徑**：`logs/failed_ivods.txt`
- **環境變數**：可透過 `ERROR_LOG_PATH` 自訂路徑
- **記錄格式**：`IVOD_ID,錯誤類型,時間戳記`

錯誤類型包括：
- `processing`：全量抓取時的處理錯誤
- `incremental`：增量更新時的處理錯誤  
- `retry`：重試時的錯誤
- `fix_retry`：補抓重試時的錯誤
- `manual_fix`：手動補抓時的錯誤

### 5.2 補抓腳本 (`ivod_fix.py`)

提供兩種補抓模式：

#### 批量補抓模式
```bash
# 從預設錯誤記錄檔案補抓
./ivod_fix.py

# 從指定錯誤記錄檔案補抓
./ivod_fix.py --file logs/custom_failed.txt

# 使用自訂錯誤記錄檔案路徑
./ivod_fix.py --error-log logs/my_errors.txt
```

#### 單一補抓模式
```bash
# 補抓指定的IVOD_ID
./ivod_fix.py --ivod-id 123456

# 跳過SSL驗證
./ivod_fix.py --ivod-id 123456 --skip-ssl
```

#### 補抓流程
1. **批量模式**：讀取錯誤記錄檔案中的所有IVOD_ID
2. **逐一重新抓取**：對每個IVOD_ID執行完整的抓取流程
3. **成功處理**：從錯誤記錄檔案中移除成功處理的IVOD_ID
4. **失敗處理**：重新記錄到錯誤檔案，標記為 `fix_retry`

### 5.3 環境變數設定

在 `.env` 檔案中可設定：
```ini
# 錯誤記錄檔案路徑
ERROR_LOG_PATH=logs/failed_ivods.txt

# 日誌目錄
LOG_PATH=logs/
```

## 6. 全量拉取日期範圍功能

從 `ivod_full.py` 現在支援自訂日期範圍，用於重抓特定時間段的影片資料。

### 6.1 基本用法

```bash
# 預設模式：從 2024-02-01 至今天
./ivod_full.py

# 指定起始日期
./ivod_full.py --start-date 2024-03-01

# 指定結束日期
./ivod_full.py --end-date 2024-12-31

# 指定完整日期範圍
./ivod_full.py --start-date 2024-03-01 --end-date 2024-03-31
```

### 6.2 安全限制

為確保資料一致性，系統設有以下限制：

- **起始日期限制**：不可早於 `2024-02-01`（系統預設起始日期）
- **結束日期限制**：不可晚於今天
- **日期格式**：必須為 `YYYY-MM-DD` 格式

### 6.3 智能調整

如果輸入的日期超出限制，系統會自動調整並顯示警告：

```bash
# 如果指定過早的起始日期
./ivod_full.py --start-date 2024-01-01
# 系統會自動調整為 2024-02-01 並顯示警告

# 如果指定未來的結束日期
./ivod_full.py --end-date 2025-12-31
# 系統會自動調整為今天並顯示警告
```

### 6.4 實際應用場景

```bash
# 重抓某個月份的資料
./ivod_full.py --start-date 2024-06-01 --end-date 2024-06-30

# 重抓某個季度的資料
./ivod_full.py --start-date 2024-04-01 --end-date 2024-06-30

# 從特定日期抓到今天
./ivod_full.py --start-date 2024-11-01

# 抓取到特定日期為止
./ivod_full.py --end-date 2024-10-31
```

## 7. 資料庫備份與還原

本系統提供完整的資料庫備份與還原功能，可有效避免重複抓取的問題。

### 7.1 備份資料庫

```bash
# 自動生成備份檔名（建議）
./ivod_backup.py backup

# 指定備份檔名
./ivod_backup.py backup --file backup/my_backup.json

# 指定完整路徑
./ivod_backup.py backup --file /path/to/custom_backup.json
```

**備份特色**：
- **JSON 格式**：易於查看和移植的備份格式
- **完整資訊**：包含所有欄位和 metadata
- **自動命名**：預設使用時間戳 (`ivod_backup_20241201_143022.json`)
- **跨資料庫**：支援 SQLite、PostgreSQL、MySQL
- **進度顯示**：即時顯示備份進度和統計

### 7.2 還原資料庫

```bash
# 基本還原（會詢問確認）
./ivod_backup.py restore backup/ivod_backup_20241201_143022.json

# 強制建立資料表（不詢問）
./ivod_backup.py restore backup/my_backup.json --force-create

# 強制清除現有資料（不詢問）
./ivod_backup.py restore backup/my_backup.json --force-clear

# 強制執行所有操作（適合自動化）
./ivod_backup.py restore backup/my_backup.json --force-all
```

**還原安全機制**：
1. **資料表檢查**：自動檢查資料表是否存在，不存在時詢問是否建立
2. **資料保護**：發現現有資料時詢問是否清除
3. **強制模式**：提供 `--force-*` 選項跳過確認，適合自動化腳本
4. **錯誤處理**：個別記錄失敗不影響整體還原過程

### 7.3 管理備份檔案

```bash
# 列出所有備份檔案（預設在 backup/ 目錄）
./ivod_backup.py list

# 指定備份目錄
./ivod_backup.py list --backup-dir /path/to/backups
```

**列表功能**：
- 顯示檔案名稱、路徑、大小、建立時間
- 按時間排序（最新在前）
- 提供使用範例

### 7.4 實際應用場景

#### 正式環境備份
```bash
# 每日備份（建議加入 cron）
0 1 * * * cd /home/ivoduser/ivod_transcript_db/crawler && ./ivod_backup.py backup >> logs/backup.log 2>&1
```

#### 測試環境建立
```bash
# 從正式環境備份
./ivod_backup.py backup --file production_backup.json

# 複製到測試環境後還原
./ivod_backup.py restore production_backup.json --force-all
```

#### 資料遷移
```bash
# 舊環境備份
./ivod_backup.py backup --file migration_backup.json

# 新環境還原
./ivod_backup.py restore migration_backup.json --force-create
```

### 7.5 備份檔案格式

備份檔案採用 JSON 格式，包含：
- **metadata**：備份時間、資料庫類型、記錄數量、版本資訊
- **data**：完整的資料記錄陣列

範例結構：
```json
{
  "metadata": {
    "backup_time": "2024-12-01T14:30:22.123456",
    "db_backend": "sqlite",
    "record_count": 12345,
    "version": "1.0"
  },
  "data": [ /* 完整記錄陣列 */ ]
}
```

## 8. 常見問題

- 若抓取到空結果，task 會將 status 標為 `failed`，同時記錄到錯誤檔案，可透過 `ivod_retry.py` 或 `ivod_fix.py` 補抓  
- 全量拉取的預設起始日期為 `2024-02-01`，可透過 `--start-date` 參數自訂（不可早於此日期）
- 如欲動態設定 `skip_ssl`，可自行在 wrapper 或呼叫 `ivod_tasks.run_*()` 時指定參數
- 錯誤記錄檔案會自動去重複，避免重複記錄同一個IVOD_ID
- 日期格式錯誤會立即停止執行並顯示詳細錯誤訊息
- 備份檔案建議定期清理，避免佔用過多磁碟空間

---

*完成上述步驟，即可在 Ubuntu 環境下每日自動更新立法院逐字稿，並自動重試失敗紀錄，避免遺漏與 SSL 驗證錯誤*。

## 9. Elasticsearch 設定與索引

### 9.1 安裝中文分析插件

建議安裝 IK Analyzer 插件以改善繁體中文分詞：  
```bash
bin/elasticsearch-plugin install analysis-ik
```

如欲使用 Smart Chinese Analyzer，可安裝：  
```bash
bin/elasticsearch-plugin install analysis-smartcn
```

### 9.2 .env 變數設定

請在 `.env` 中設定：  
```ini
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http
# ES_USER=your_username
# ES_PASS=your_password
ES_INDEX=ivod_transcripts
```

### 9.3 執行索引更新

```bash
./ivod_es.py
```

## 10. 資料庫與連線測試

### 10.1 連線測試腳本

為確保資料庫和 Elasticsearch 設定正確，本專案提供了完整的連線測試工具：

```bash
# 測試所有環境的資料庫連線和表格狀態
./test_connection.py

# 只測試特定環境
./test_connection.py --env production
./test_connection.py --env development
./test_connection.py --env testing

# 只測試資料庫連線
./test_connection.py --test-db

# 只檢查表格狀態
./test_connection.py --test-tables

# 只測試 Elasticsearch
./test_connection.py --test-elasticsearch

# 互動式建立缺失的表格
./test_connection.py --create-tables
```

**測試項目包括**：
- **資料庫連線**：測試 SQLite、PostgreSQL、MySQL 連線能力
- **表格狀態**：檢查 `ivod_transcripts` 表格是否存在及記錄數
- **Elasticsearch**：測試 ES 連線、索引狀態、文件數量
- **多環境支援**：自動檢測 production、development、testing 三種環境

**互動式功能**：
- 自動檢測缺失的表格
- 詢問使用者是否建立表格
- 提供批量建立或單一環境建立選項

### 10.2 環境配置

測試腳本會根據以下規則自動檢測環境：
- **testing**：`TESTING=true`、`PYTEST_RUNNING=true`，或執行 `integration_test.py`
- **production**：`DB_ENV=production`
- **development**：預設環境

每個環境使用獨立的資料庫和索引：
- **SQLite**：`ivod_local.db`（production）、`ivod_dev.db`（development）、`ivod_test.db`（testing）
- **PostgreSQL/MySQL**：`ivod_db`、`ivod_dev_db`、`ivod_test_db`
- **Elasticsearch**：`ivod_transcripts`、`ivod_dev_transcripts`、`ivod_test_transcripts`

## 11. Testing

本專案使用 pytest 作為測試框架，並將開發相依 (dev dependencies) 集中於 `requirements-dev.txt`。

```bash
pip install -r requirements-dev.txt
```

### 11.1 單元測試 (Unit Tests)
- 使用 pytest 測試核心函式，如 `make_browser`、`fetch_ivod_list`、`process_ivod`。
- 測試檔案可依模組結構，放於 `tests/core/`、`tests/crawler/`、`tests/db/`、`tests/tasks/` 等子目錄中：
  - `tests/core/`：`test_core.py`
  - `tests/crawler/`：`test_crawler.py`、`test_fetch_available_dates.py`、`test_fetch_ly_speech.py`
  - `tests/db/`：`test_db.py`
  - `tests/tasks/`：`test_tasks.py`、`test_run_es.py`
- 可透過 requests-mock 模擬 HTTP 回應，並利用 sqlite in-memory (`DB_BACKEND=sqlite`, `DB_URL=:memory:`) 測試資料庫操作。

### 11.2 整合測試 (Integration Tests)
- 建議於 `tests/crawler/` 子目錄中加入整合測試，標記 `@pytest.mark.integration`，如 `test_fetch_available_dates.py`、`test_fetch_ly_speech.py`。
- 可使用 Docker Compose 啟動測試用的資料庫與 Elasticsearch service，並於測試前自動初始化資料庫 schema (呼叫 `ivod_core.Base.metadata.create_all`)。

### 11.3 Integration Test Script

Run the following script to reset the test database and fetch IVOD transcripts for integration testing.
By default it uses the SQLite path from your `.env` (e.g. `db/ivod_local.db`),
but you can override the database file via the `TEST_SQLITE_PATH` environment variable
(e.g. to use a separate `db/ivod_test.db`):

```bash
cd crawler
TEST_SQLITE_PATH=../db/ivod_test.db python integration_test.py
```

### 11.4 執行所有測試

```bash
pytest --cov=ivod_core --cov=ivod_tasks --cov-report=term-missing
```

可將上述指令整合至 CI pipeline，自動執行測試並收集 coverage 報告。