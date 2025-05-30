# 數據庫表格設定修復指南

## 問題診斷

當設定 MySQL/PostgreSQL 後，發現數據庫中沒有表格的原因：

1. **Crawler 和 App 使用不同的 ORM 系統**
   - Crawler: SQLAlchemy（Python）
   - App: Prisma（Node.js）

2. **Schema 同步問題**
   - 兩個系統對同一個數據庫有不同的 schema 定義
   - 需要確保 schema 一致性

3. **缺少數據庫遷移步驟**
   - Prisma 需要手動執行遷移來創建表格

## 修復方案

### 方案一：使用 Crawler 創建表格（推薦）

由於 Crawler 的 SQLAlchemy 會自動創建表格，我們可以先運行 Crawler 來初始化數據庫。

#### 1. 配置 Crawler 環境變數

**編輯 `crawler/.env`：**

```bash
# 數據庫配置（MySQL 範例）
DB_BACKEND=mysql
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_DB=ivod_db
MYSQL_USER=ivod_user
MYSQL_PASS=your_password

# 或者 PostgreSQL 範例
# DB_BACKEND=postgresql
# PG_HOST=localhost
# PG_PORT=5432
# PG_DB=ivod_db
# PG_USER=ivod_user
# PG_PASS=your_password

# SSL 設定（如果需要）
SKIP_SSL=True

# 測試數據庫
TEST_SQLITE_PATH=../db/ivod_test.db
```

#### 2. 測試 Crawler 數據庫連線

```bash
cd crawler

# 安裝依賴
pip install -r requirements.txt

# 測試數據庫連線和表格創建
python -c "
from ivod.db import get_session, IVODTranscript
session = get_session()
print('數據庫連線成功！')
print(f'表格已創建: {IVODTranscript.__tablename__}')
session.close()
"
```

#### 3. 執行 Crawler 初始化

```bash
# 執行小範圍測試（僅處理一天資料）
python -c "
from ivod.tasks import run_incremental
from datetime import datetime, timedelta
import os

# 設定測試日期範圍（只處理昨天的資料）
yesterday = datetime.now() - timedelta(days=1)
print(f'正在處理 {yesterday.date()} 的資料...')
run_incremental()
print('初始化完成！')
"
```

#### 4. 檢查表格是否創建成功

**MySQL:**
```bash
mysql -u ivod_user -p ivod_db -e "SHOW TABLES;"
mysql -u ivod_user -p ivod_db -e "DESCRIBE ivod_transcripts;"
```

**PostgreSQL:**
```bash
psql -h localhost -U ivod_user -d ivod_db -c "\dt"
psql -h localhost -U ivod_user -d ivod_db -c "\d ivod_transcripts"
```

### 方案二：修復 Prisma Schema 並手動遷移

#### 1. 更新 App 環境變數

**編輯 `app/.env`：**

```bash
# 數據庫配置（與 crawler/.env 保持一致）
DB_BACKEND=mysql
DATABASE_URL="mysql://ivod_user:your_password@localhost:3306/ivod_db"

# 或者 PostgreSQL
# DB_BACKEND=postgresql  
# DATABASE_URL="postgresql://ivod_user:your_password@localhost:5432/ivod_db"

# 其他配置...
ES_HOST=localhost
ES_PORT=9200
```

#### 2. 更新 Prisma Schema

```bash
cd app

# 執行 schema 更新腳本
npm run prisma:prepare

# 檢查更新後的 schema
cat prisma/schema.prisma
```

#### 3. 生成 Prisma Client 並推送 Schema

```bash
# 生成 Prisma client
npm run prisma:generate

# 推送 schema 到數據庫（會創建表格）
npx prisma db push

# 或者使用遷移（更正式的方式）
npx prisma migrate dev --name init
```

#### 4. 驗證表格創建

```bash
# 使用 Prisma Studio 檢查
npx prisma studio

# 或者直接查詢數據庫
npx prisma db execute --stdin <<EOF
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'ivod_db';
EOF
```

### 方案三：統一 Schema 定義（最佳實踐）

為了避免未來的不一致問題，建議統一兩個系統的 schema 定義。

#### 1. 創建共用的 SQL 遷移文件

**創建 `database_schema.sql`：**

```sql
-- 適用於 MySQL 和 PostgreSQL 的統一 Schema
CREATE TABLE IF NOT EXISTS ivod_transcripts (
    ivod_id INTEGER PRIMARY KEY,
    ivod_url TEXT NOT NULL,
    date VARCHAR(20) NOT NULL,  -- 統一使用字符串格式
    meeting_code TEXT,
    meeting_code_str TEXT,
    category TEXT,
    video_type TEXT,
    video_start TEXT,
    video_end TEXT,
    video_length TEXT,
    video_url TEXT,
    title TEXT,
    speaker_name TEXT,
    meeting_time TEXT,  -- 統一使用字符串格式
    meeting_name TEXT,
    ai_transcript LONGTEXT,  -- MySQL: LONGTEXT, PostgreSQL: TEXT
    ly_transcript LONGTEXT,
    ai_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ai_retries INTEGER NOT NULL DEFAULT 0,
    ly_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    ly_retries INTEGER NOT NULL DEFAULT 0,
    last_updated TEXT NOT NULL,  -- 統一使用字符串格式
    committee_names TEXT  -- 統一使用 JSON 字符串格式
);

-- 添加索引以提高查詢效能
CREATE INDEX IF NOT EXISTS idx_ivod_date ON ivod_transcripts(date);
CREATE INDEX IF NOT EXISTS idx_ivod_status ON ivod_transcripts(ai_status, ly_status);
CREATE INDEX IF NOT EXISTS idx_ivod_speaker ON ivod_transcripts(speaker_name);
CREATE INDEX IF NOT EXISTS idx_ivod_meeting ON ivod_transcripts(meeting_name);
```

#### 2. 手動執行 SQL

**MySQL:**
```bash
mysql -u ivod_user -p ivod_db < database_schema.sql
```

**PostgreSQL:**
```bash
psql -h localhost -U ivod_user -d ivod_db -f database_schema.sql
```

## 常見問題和解決方案

### 問題 1: "Table doesn't exist" 錯誤

**原因**: 表格尚未創建
**解決**: 按照上述方案一或二執行表格創建

### 問題 2: "Column count doesn't match" 錯誤

**原因**: Crawler 和 App 的 schema 定義不一致
**解決**: 使用方案三統一 schema，或者刪除表格重新創建

### 問題 3: 資料類型不匹配

**原因**: 不同數據庫對 JSON、ARRAY 等類型支援不同
**解決**: 統一使用 TEXT 類型存儲 JSON 字符串

### 問題 4: 權限問題

**原因**: 數據庫用戶沒有創建表格的權限
**解決**: 
```sql
-- MySQL
GRANT ALL PRIVILEGES ON ivod_db.* TO 'ivod_user'@'localhost';
FLUSH PRIVILEGES;

-- PostgreSQL
GRANT ALL PRIVILEGES ON DATABASE ivod_db TO ivod_user;
```

## 驗證步驟

### 1. 檢查表格存在

```bash
# MySQL
mysql -u ivod_user -p ivod_db -e "SELECT COUNT(*) as table_exists FROM information_schema.tables WHERE table_schema='ivod_db' AND table_name='ivod_transcripts';"

# PostgreSQL  
psql -h localhost -U ivod_user -d ivod_db -c "SELECT COUNT(*) as table_exists FROM information_schema.tables WHERE table_schema='public' AND table_name='ivod_transcripts';"
```

### 2. 檢查表格結構

```bash
# MySQL
mysql -u ivod_user -p ivod_db -e "DESCRIBE ivod_transcripts;"

# PostgreSQL
psql -h localhost -U ivod_user -d ivod_db -c "\d ivod_transcripts"
```

### 3. 測試插入數據

```bash
# Crawler 測試
cd crawler
python -c "
from ivod.db import get_session, IVODTranscript
from datetime import datetime

session = get_session()
test_record = IVODTranscript(
    ivod_id=999999,
    ivod_url='http://test.com',
    date='2024-01-01',
    meeting_time='2024-01-01 10:00:00',
    last_updated='2024-01-01 10:00:00'
)
session.merge(test_record)
session.commit()
print('Crawler 插入測試成功！')
session.close()
"

# App 測試
cd app
node -e "
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const result = await prisma.iVODTranscript.findMany({ take: 1 });
  console.log('App 查詢測試成功！記錄數:', result.length);
  await prisma.\$disconnect();
}
test();
"
```

## 建議的部署流程

1. **首先設定 Crawler**（會自動創建表格）
2. **然後設定 App**（使用現有表格）
3. **定期執行數據同步檢查**

這樣可以避免 schema 不一致的問題，並確保兩個系統都能正常工作。