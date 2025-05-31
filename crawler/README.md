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

## 7. 常見問題

- 若抓取到空結果，task 會將 status 標為 `failed`，同時記錄到錯誤檔案，可透過 `ivod_retry.py` 或 `ivod_fix.py` 補抓  
- 全量拉取的預設起始日期為 `2024-02-01`，可透過 `--start-date` 參數自訂（不可早於此日期）
- 如欲動態設定 `skip_ssl`，可自行在 wrapper 或呼叫 `ivod_tasks.run_*()` 時指定參數
- 錯誤記錄檔案會自動去重複，避免重複記錄同一個IVOD_ID
- 日期格式錯誤會立即停止執行並顯示詳細錯誤訊息

---

*完成上述步驟，即可在 Ubuntu 環境下每日自動更新立法院逐字稿，並自動重試失敗紀錄，避免遺漏與 SSL 驗證錯誤*。

## 8. Elasticsearch 設定與索引

### 8.1 安裝中文分析插件

建議安裝 IK Analyzer 插件以改善繁體中文分詞：  
```bash
bin/elasticsearch-plugin install analysis-ik
```

如欲使用 Smart Chinese Analyzer，可安裝：  
```bash
bin/elasticsearch-plugin install analysis-smartcn
```

### 8.2 .env 變數設定

請在 `.env` 中設定：  
```ini
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http
# ES_USER=your_username
# ES_PASS=your_password
ES_INDEX=ivod_transcripts
```

### 8.3 執行索引更新

```bash
./ivod_es.py
```

## 9. Testing

本專案使用 pytest 作為測試框架，並將開發相依 (dev dependencies) 集中於 `requirements-dev.txt`。

```bash
pip install -r requirements-dev.txt
```

### 9.1 單元測試 (Unit Tests)
- 使用 pytest 測試核心函式，如 `make_browser`、`fetch_ivod_list`、`process_ivod`。
- 測試檔案可依模組結構，放於 `tests/core/`、`tests/crawler/`、`tests/db/`、`tests/tasks/` 等子目錄中：
  - `tests/core/`：`test_core.py`
  - `tests/crawler/`：`test_crawler.py`、`test_fetch_available_dates.py`、`test_fetch_ly_speech.py`
  - `tests/db/`：`test_db.py`
  - `tests/tasks/`：`test_tasks.py`、`test_run_es.py`
- 可透過 requests-mock 模擬 HTTP 回應，並利用 sqlite in-memory (`DB_BACKEND=sqlite`, `DB_URL=:memory:`) 測試資料庫操作。

### 9.2 整合測試 (Integration Tests)
- 建議於 `tests/crawler/` 子目錄中加入整合測試，標記 `@pytest.mark.integration`，如 `test_fetch_available_dates.py`、`test_fetch_ly_speech.py`。
- 可使用 Docker Compose 啟動測試用的資料庫與 Elasticsearch service，並於測試前自動初始化資料庫 schema (呼叫 `ivod_core.Base.metadata.create_all`)。

### 9.3 Integration Test Script

Run the following script to reset the test database and fetch IVOD transcripts for integration testing.
By default it uses the SQLite path from your `.env` (e.g. `db/ivod_local.db`),
but you can override the database file via the `TEST_SQLITE_PATH` environment variable
(e.g. to use a separate `db/ivod_test.db`):

```bash
cd crawler
TEST_SQLITE_PATH=../db/ivod_test.db python integration_test.py
```

### 9.4 執行所有測試

```bash
pytest --cov=ivod_core --cov=ivod_tasks --cov-report=term-missing
```

可將上述指令整合至 CI pipeline，自動執行測試並收集 coverage 報告。