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

# 增量更新 (每日定期執行)
./ivod_incremental.py

# 重新嘗試失敗紀錄 (每日/每小時皆可)
./ivod_retry.py
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
```

> 若偏好 Systemd Timer，可另行設定。

## 5. 常見問題

- 若抓取到空結果，task 會將 status 標為 `failed`，可透過 `ivod_retry.py` 補抓  
- 如需調整「全量起始日」，請修改 `ivod_tasks.py` `run_full()` 中的 `start` 參數  
- 如欲動態設定 `skip_ssl`，可自行在 wrapper 或呼叫 `ivod_tasks.run_*()` 時指定參數

---

*完成上述步驟，即可在 Ubuntu 環境下每日自動更新立法院逐字稿，並自動重試失敗紀錄，避免遺漏與 SSL 驗證錯誤*。

## 6. Elasticsearch 設定與索引

### 6.1 安裝中文分析插件

建議安裝 IK Analyzer 插件以改善繁體中文分詞：  
```bash
bin/elasticsearch-plugin install analysis-ik
```

如欲使用 Smart Chinese Analyzer，可安裝：  
```bash
bin/elasticsearch-plugin install analysis-smartcn
```

### 6.2 .env 變數設定

請在 `.env` 中設定：  
```ini
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http
# ES_USER=your_username
# ES_PASS=your_password
ES_INDEX=ivod_transcripts
```

### 6.3 執行索引更新

```bash
./ivod_es.py
```

## 7. Testing

本專案使用 pytest 作為測試框架，並將開發相依 (dev dependencies) 集中於 `requirements-dev.txt`。

```bash
pip install -r requirements-dev.txt
```

### 7.1 單元測試 (Unit Tests)
- 使用 pytest 測試核心函式，如 `make_browser`、`fetch_ivod_list`、`process_ivod`。
- 建議於 `tests/unit/` 目錄下建立 `test_core.py`、`test_tasks.py` 等檔案。
- 可透過 requests-mock 模擬 HTTP 回應，並利用 sqlite in-memory (`DB_BACKEND=sqlite`, `DB_URL=:memory:`) 測試資料庫操作。

### 7.2 整合測試 (Integration Tests)
- 建議於 `tests/integration/` 目錄下建立測試，包含資料庫與 Elasticsearch 的整合測試，測試 `ivod_es.py` 中的索引功能。
- 可使用 Docker Compose 啟動測試用的資料庫與 Elasticsearch service，並於測試前自動初始化資料庫 schema (呼叫 `ivod_core.Base.metadata.create_all`)。

### 7.3 執行所有測試

```bash
pytest --cov=ivod_core --cov=ivod_tasks --cov-report=term-missing
```

可將上述指令整合至 CI pipeline，自動執行測試並收集 coverage 報告。