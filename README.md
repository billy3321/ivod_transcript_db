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
# 編輯 .env：設定 DB_BACKEND 及對應連線參數
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