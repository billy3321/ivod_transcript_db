# IVOD 逐字稿網站應用程式 (app)

## 1. 概述

這是一個基於 Next.js 開發的網站應用程式，提供 IVOD 逐字稿的瀏覽和搜尋功能：

- **分頁列表**：顯示 IVOD 記錄的日期、會議名稱、委員會、發言人和時長
- **進階搜尋表單**：支援引號搜尋、AND/OR布林運算、括弧分組、欄位搜尋和排除語法的強大搜尋功能（使用 Elasticsearch 驅動）
- **詳細頁面**：每筆 IVOD 記錄的詳細頁面，包含逐字稿顯示和長文本的展開控制

## 2. 技術堆疊

- [Next.js](https://nextjs.org/) 搭配 React 和 TypeScript
- Node.js API 路由用於伺服器端資料獲取
- [Prisma](https://www.prisma.io/) ORM 用於關聯式資料庫（PostgreSQL / MySQL / SQLite）
- [Elasticsearch](https://www.elastic.co/) 用於全文逐字稿搜尋
- [bodybuilder](https://github.com/moscajs/bodybuilder) 用於建構 Elasticsearch 查詢 DSL
- [search-query-parser](https://github.com/nepsilon/search-query-parser) 用於解析進階搜尋語法
- [Tailwind CSS](https://tailwindcss.com/) 用於樣式設計
- **結構化日誌系統**：完整的錯誤記錄、API 監控和管理介面

## 3. 架構

應用程式結構和主要路由/組件：

```plain
app/
├── pages/
│   ├── index.tsx              # IVOD 列表 + 搜尋頁面
│   ├── ivod/[id].tsx          # IVOD 詳細頁面
│   └── api/
│       ├── ivods.ts           # GET: 列出和篩選 IVOD，支援分頁
│       ├── ivods/[id].ts      # GET: 根據 ID 獲取 IVOD 元資料和逐字稿
│       ├── search.ts          # GET: 全文逐字稿搜尋（ES 不可用時會 fallback 到 DB）
│       ├── logs.ts            # POST: 客戶端錯誤日誌記錄
│       └── admin/
│           └── logs.ts        # GET/DELETE: 管理員日誌檢視和管理
├── components/                # React UI 組件（List, SearchForm, Pagination, TranscriptViewer 等）
├── lib/
│   ├── prisma.ts              # 資料庫客戶端設定
│   ├── elastic.ts             # Elasticsearch 客戶端設定
│   ├── searchParser.ts        # 進階搜尋語法解析器
│   ├── logger.ts              # 結構化日誌系統
│   ├── useErrorHandler.ts     # React 錯誤處理 hook
│   └── utils.ts               # 工具函數
└── public/
    └── ...                    # 靜態資源
```

## 4. UI/UX 設計準則

為確保響應式、現代化且使用者友善的介面，請遵循以下準則：

### 4.1 設計原則

- 行動優先的響應式佈局，使用 CSS Grid 或 Flexbox
- 基於卡片或表格的列表檢視，具有清晰的排版和間距
- 一致的色彩調色板和字體；建議使用 Tailwind CSS 預設或自訂主題
- 直覺式的搜尋和分頁控制項，具有可存取的表單元素
- 深色模式支援（可選），透過 CSS 變數或 Tailwind 的深色模式

### 4.2 佈局和組件

| 頁面          | 桌面版檢視                           | 行動版檢視                               |
|---------------|--------------------------------------|------------------------------------------|
| IVOD 列表     | 卡片網格顯示日期、會議、委員會、發言人和時長 | 卡片堆疊為單列的行動版佈局                |
| 搜尋表單      | 單一搜尋輸入框配下拉排序選單            | 響應式搜尋和排序控制項                   |
| 分頁          | 頁腳分頁連結配數字和上一頁/下一頁按鈕     | 簡化的上一頁/下一頁按鈕                  |
| IVOD 詳細     | 逐字稿檢視器和元資料面板並排           | 全寬元資料置於可收合逐字稿上方            |

- 使用 Tailwind CSS 工具類別實現斷點（`sm`、`md`、`lg`、`xl`）
- 為 List、Pagination 和 TranscriptViewer 採用 React 組件
- 利用 SVG 圖示（例如 Heroicons）進行操作（搜尋、清除、展開/收合）

### 4.3 樣式建議

- 色彩調色板：中性灰色，主要強調色（#3B82F6），成功色（#10B981），警告色（#FCD34D）
- 字體：使用系統字體堆疊或 Google Fonts（例如 Inter）
- 間距：使用一致的內距（4/8/16px）和邊距比例

## 5. 環境變數

在 `app/` 目錄下，根據 `.env.example` 建立 `.env.local` 檔，並填入以下內容：

```ini
# 資料庫後端：sqlite / postgresql / mysql
DB_BACKEND=sqlite

# SQLite 設定（僅當 DB_BACKEND=sqlite 時）
# 建議使用專案層級 'db' 目錄中的共用資料庫檔案：
SQLITE_PATH=../db/ivod_local.db

# PostgreSQL 設定（僅當 DB_BACKEND=postgresql 時）
# PG_HOST=localhost
# PG_PORT=5432
# PG_DB=ivod_db
# PG_USER=ivod_user
# PG_PASS=ivod_password

# MySQL 設定（僅當 DB_BACKEND=mysql 時）
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_DB=ivod_db
# MYSQL_USER=ivod_user
# MYSQL_PASS=ivod_password

# （可選）覆蓋整合測試的 SQLite 路徑，避免修改主要資料庫
TEST_SQLITE_PATH=../db/ivod_test.db

# （可選）遇到 SSL 錯誤時跳過 SSL 證書驗證
# SKIP_SSL=True

# Elasticsearch 設定（可選，設定 ES 連線與索引名稱）
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http
# ES_USER=your_username
# ES_PASS=your_password
ES_INDEX=ivod_transcripts

# （可選）將索引暴露給瀏覽器端
NEXT_PUBLIC_ES_INDEX=ivod_transcripts

# 日誌系統配置
LOG_LEVEL=info                    # 日誌級別：error, warn, info, debug
LOG_PATH=logs                     # 日誌檔案目錄
ADMIN_TOKEN=your_secure_admin_token_here  # 管理員日誌介面存取金鑰
```

## 6. 本地開發

```bash
cd app
npm install
cp .env.example .env.local
# 若使用 SQLite，建立共用資料庫資料夾：mkdir -p ../db
# 編輯 .env.local，設定 DB_BACKEND、對應連線參數及 Elasticsearch 相關變數
# 若使用非 SQLite 後端，執行下列命令會自動更新 prisma/schema.prisma 內的 provider 以符合 .env 的 DB_BACKEND
npm run prisma:generate
# npx prisma migrate dev --name init  # 如果需要建立新的遷移
npm run dev
```

在瀏覽器開啟 http://localhost:3000 查看應用程式。

### 6.1 日誌監控

系統提供完整的日誌功能：

- **自動錯誤記錄**：API 錯誤、資料庫問題、搜尋失敗等會自動記錄
- **客戶端錯誤追蹤**：前端組件錯誤、JavaScript 錯誤會送到伺服器記錄
- **管理員介面**：訪問 http://localhost:3000/admin/logs 查看和管理日誌
- **結構化日誌**：包含時間戳、錯誤級別、上下文資訊等

**使用 useErrorHandler Hook：**
```tsx
import { useErrorHandler } from '@/lib/useErrorHandler';

function MyComponent() {
  const { handleError, handleAsyncError, wrapEventHandler } = useErrorHandler({
    component: 'MyComponent'
  });

  const handleClick = wrapEventHandler(() => {
    // 如果出錯會自動記錄
    doSomething();
  });

  const fetchData = async () => {
    const result = await handleAsyncError(async () => {
      return await fetch('/api/data');
    });
  };

  return <button onClick={handleClick}>按鈕</button>;
}
```

## 7. 建置和正式環境部署

### 7.1 本地建置

```bash
cd app
npm run build
npm start
```

### 7.2 部署到 Vercel

另外，也可以部署到 [Vercel](https://vercel.com/)：

1. 將 `app/` 目錄推送到 Git 儲存庫
2. 在 Vercel 控制台中匯入專案
3. 在 Vercel 設定中設定環境變數
4. 部署

## 8. Docker 容器化部署（可選）

容器化部署的範例 `Dockerfile`：

```dockerfile
FROM node:18-alpine
WORKDIR /app

# 複製套件檔案
COPY package*.json ./
RUN npm ci --only=production

# 複製應用程式檔案
COPY . .

# 建置應用程式
RUN npm run build

# 暴露連接埠
EXPOSE 3000

# 啟動命令
CMD ["npm", "start"]
```

建置和執行：

```bash
docker build -t ivod-app .
docker run -p 3000:3000 \
  -e DB_BACKEND=postgresql \
  -e PG_HOST=your_db_host \
  -e PG_DB=ivod_db \
  -e PG_USER=ivod_user \
  -e PG_PASS=your_password \
  -e ES_HOST=your_es_host \
  -e ES_PORT=9200 \
  -e ES_SCHEME=http \
  -e ES_INDEX=ivod_transcripts \
  ivod-app
```

## 9. Ubuntu Linux 正式環境部署（使用 Nginx）

以下步驟說明如何在 Ubuntu 伺服器上使用 nginx 作為反向代理設定穩定的正式環境。

### 9.1 前置條件

- Ubuntu（20.04 以上）伺服器，具有 sudo 權限
- 指向您伺服器的網域名稱
- Node.js（v18 以上）和 npm
- 已安裝 nginx
- 可選：用於 SSL 的 Certbot（Let's Encrypt）

### 9.2 安裝 Node.js

```bash
# 安裝 Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get update
sudo apt-get install -y nodejs build-essential

# 驗證安裝
node --version
npm --version
```

### 9.3 安裝 Nginx

```bash
sudo apt-get update
sudo apt-get install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 9.4 克隆、設定和建置

```bash
# 克隆儲存庫並切換到 app 目錄
git clone https://github.com/yourorg/ivod_transcript_db.git
cd ivod_transcript_db/app

# 複製並編輯環境變數
cp .env.example .env.local
# 編輯 .env.local 並填入 DB_BACKEND、資料庫連線參數、ES_HOST、ES_PORT、ES_SCHEME、ES_INDEX 等

# 安裝依賴（只安裝正式環境依賴）
npm ci --only=production

# 產生 Prisma 客戶端
npm run prisma:generate

# 建置應用程式
npm run build
```

### 9.5 設定資料庫

#### 對於 PostgreSQL：
```bash
# 安裝 PostgreSQL
sudo apt-get install -y postgresql postgresql-contrib

# 建立資料庫和使用者
sudo -u postgres psql
CREATE DATABASE ivod_db;
CREATE USER ivod_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE ivod_db TO ivod_user;
\q

# 在 .env.local 中設定：
# DB_BACKEND=postgresql
# PG_HOST=localhost
# PG_PORT=5432
# PG_DB=ivod_db
# PG_USER=ivod_user
# PG_PASS=your_secure_password
```

#### 對於 MySQL：
```bash
# 安裝 MySQL
sudo apt-get install -y mysql-server

# 設定 MySQL
sudo mysql_secure_installation

# 建立資料庫和使用者
sudo mysql
CREATE DATABASE ivod_db;
CREATE USER 'ivod_user'@'localhost' IDENTIFIED BY 'your_secure_password';
GRANT ALL PRIVILEGES ON ivod_db.* TO 'ivod_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# 在 .env.local 中設定：
# DB_BACKEND=mysql
# MYSQL_HOST=localhost
# MYSQL_PORT=3306
# MYSQL_DB=ivod_db
# MYSQL_USER=ivod_user
# MYSQL_PASS=your_secure_password
```

### 9.6 設定 Elasticsearch（可選）

```bash
# 安裝 Elasticsearch（以 8.x 為例）
wget -qO - https://artifacts.elastic.co/GPG-KEY-elasticsearch | sudo gpg --dearmor -o /usr/share/keyrings/elasticsearch-keyring.gpg
echo "deb [signed-by=/usr/share/keyrings/elasticsearch-keyring.gpg] https://artifacts.elastic.co/packages/8.x/apt stable main" | sudo tee /etc/apt/sources.list.d/elastic-8.x.list
sudo apt-get update
sudo apt-get install -y elasticsearch

# 啟動 Elasticsearch
sudo systemctl start elasticsearch
sudo systemctl enable elasticsearch

# 安裝中文分析插件（可選）
sudo /usr/share/elasticsearch/bin/elasticsearch-plugin install analysis-icu
sudo systemctl restart elasticsearch
```

### 9.7 高可用進程管理

在正式環境中，直接使用 `npm start` 不是最佳實踐。以下提供幾種高可用的部署方案：

#### 方案一：使用 PM2（推薦）

**安裝 PM2：**
```bash
# 全域安裝 PM2
sudo npm install -g pm2

# 安裝 PM2 日誌輪轉
pm2 install pm2-logrotate
```

**建立 PM2 配置檔案 `ecosystem.config.js`：**
```javascript
module.exports = {
  apps: [{
    name: 'ivod-app',
    script: 'npm',
    args: 'start',
    cwd: '/home/ubuntu/ivod_transcript_db/app',
    instances: 'max', // 使用所有 CPU 核心
    exec_mode: 'cluster', // 叢集模式
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    env_file: '/home/ubuntu/ivod_transcript_db/app/.env.local',
    error_file: '/var/log/pm2/ivod-app-error.log',
    out_file: '/var/log/pm2/ivod-app-out.log',
    log_file: '/var/log/pm2/ivod-app.log',
    time: true,
    // 自動重啟設定
    autorestart: true,
    max_restarts: 10,
    min_uptime: '10s',
    // 優雅關閉
    kill_timeout: 5000,
    // 健康檢查
    health_check_url: 'http://localhost:3000/api/health',
    health_check_grace_period: 3000
  }]
};
```

**啟動和管理 PM2：**
```bash
# 建立日誌目錄
sudo mkdir -p /var/log/pm2
sudo chown -R $USER:$USER /var/log/pm2

# 啟動應用程式
cd /home/ubuntu/ivod_transcript_db/app
pm2 start ecosystem.config.js

# 設定開機自動啟動
pm2 startup
pm2 save

# 常用管理指令
pm2 status          # 檢查狀態
pm2 logs ivod-app    # 查看日誌
pm2 restart ivod-app # 重啟應用程式
pm2 reload ivod-app  # 零停機重啟
pm2 stop ivod-app    # 停止應用程式
pm2 delete ivod-app  # 刪除應用程式
```

#### 方案二：使用 systemd 搭配多實例

**建立 systemd 服務檔案 `/etc/systemd/system/ivod-app@.service`：**
```ini
[Unit]
Description=IVOD Transcripts Next.js App (Instance %i)
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/home/ubuntu/ivod_transcript_db/app
ExecStart=/usr/bin/npm start
Environment=NODE_ENV=production
Environment=PORT=300%i
EnvironmentFile=/home/ubuntu/ivod_transcript_db/app/.env.local
Restart=always
RestartSec=5
StartLimitInterval=60s
StartLimitBurst=3
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
```

**啟動多個實例：**
```bash
# 啟動多個實例（例如 4 個）
sudo systemctl enable ivod-app@0 ivod-app@1 ivod-app@2 ivod-app@3
sudo systemctl start ivod-app@0 ivod-app@1 ivod-app@2 ivod-app@3

# 檢查狀態
sudo systemctl status ivod-app@*
```

**更新 Nginx 配置以支援負載均衡：**
```nginx
upstream ivod_backend {
    least_conn;
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
    keepalive 32;
}

server {
    listen 80;
    server_name your.domain.com;

    # 健康檢查端點
    location /health {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 1s;
        proxy_read_timeout 1s;
    }

    # 靜態檔案快取
    location /_next/static/ {
        alias /home/ubuntu/ivod_transcript_db/app/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 主要應用程式
    location / {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 連線池設定
        proxy_set_header Connection "";
        
        # 超時設定
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
        
        # 錯誤處理
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        proxy_next_upstream_tries 3;
        proxy_next_upstream_timeout 5s;
    }
}
```

#### 方案三：Docker Compose 高可用部署

**建立 `docker-compose.prod.yml`：**
```yaml
version: '3.8'

services:
  app:
    build: .
    deploy:
      replicas: 4
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
        reservations:
          memory: 512M
          cpus: '0.25'
      restart_policy:
        condition: on-failure
        delay: 5s
        max_attempts: 3
        window: 120s
      update_config:
        parallelism: 1
        delay: 10s
        order: start-first
    environment:
      - NODE_ENV=production
    env_file:
      - .env.local
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
    networks:
      - app-network

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl:ro
    depends_on:
      - app
    networks:
      - app-network

  watchtower:
    image: containrrr/watchtower
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
    command: --interval 300 --cleanup
    networks:
      - app-network

networks:
  app-network:
    driver: bridge
```

**部署指令：**
```bash
# 初始化 Docker Swarm（如果還沒有的話）
docker swarm init

# 部署應用程式
docker stack deploy -c docker-compose.prod.yml ivod

# 管理指令
docker service ls                    # 查看服務
docker service logs ivod_app         # 查看日誌
docker service scale ivod_app=6      # 擴展到 6 個實例
docker service update ivod_app       # 更新服務
```

### 9.8 健康檢查和監控設定

**建立健康檢查 API 端點：**
應用程式已包含 `/api/health` 端點，提供以下資訊：
- 整體健康狀態
- 資料庫連線狀態
- Elasticsearch 連線狀態（如果啟用）
- 記憶體使用情況
- 應用程式運行時間

**測試健康檢查：**
```bash
curl http://localhost:3000/api/health
```

### 9.9 設定 Nginx（選擇對應的方案）

#### 對於 PM2 部署（推薦）：
建立 nginx 站點檔案 `/etc/nginx/sites-available/ivod-app`：

```nginx
# 上游伺服器定義（PM2 會自動負載均衡）
upstream ivod_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name your.domain.com;

    # 健康檢查端點
    location /api/health {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_connect_timeout 2s;
        proxy_read_timeout 2s;
        access_log off; # 不記錄健康檢查請求
    }

    # 靜態檔案快取
    location /_next/static/ {
        alias /home/ubuntu/ivod_transcript_db/app/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary Accept-Encoding;
        gzip_static on;
    }

    # 圖片和其他靜態資源
    location /static/ {
        alias /home/ubuntu/ivod_transcript_db/app/public/;
        expires 30d;
        add_header Cache-Control "public";
        add_header Vary Accept-Encoding;
        gzip_static on;
    }

    # API 路由
    location /api/ {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 連線池設定
        proxy_set_header Connection "";
        
        # 超時設定
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
        
        # 緩衝設定
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 主要應用程式
    location / {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 連線池設定
        proxy_set_header Connection "";
        
        # 超時設定
        proxy_connect_timeout 5s;
        proxy_send_timeout 30s;
        proxy_read_timeout 30s;
    }

    # 安全標頭
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

#### 對於多實例 systemd 部署：
```nginx
# 在上面的 Nginx 配置中已包含多實例負載均衡設定
```

**啟用站點：**
```bash
sudo ln -s /etc/nginx/sites-available/ivod-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo ufw allow 'Nginx Full'
```

### 9.10 進階監控設定

#### 使用 PM2 監控

**安裝 PM2 監控儀表板：**
```bash
# 安裝 PM2 Plus（免費版）
pm2 install pm2-server-monit

# 查看監控儀表板
pm2 monit

# 設定 PM2 Plus 連接（可選）
pm2 link <secret_key> <public_key>
```

**自訂監控腳本：**
```bash
# 建立監控腳本 /usr/local/bin/ivod-monitor.sh
cat << 'EOF' > /usr/local/bin/ivod-monitor.sh
#!/bin/bash

# IVOD 應用程式監控腳本
LOG_FILE="/var/log/ivod-monitor.log"
HEALTH_URL="http://localhost:3000/api/health"
WEBHOOK_URL="your-slack-webhook-url"  # 可選：Slack 通知

check_health() {
    local response=$(curl -s -w "\n%{http_code}" "$HEALTH_URL" 2>/dev/null)
    local body=$(echo "$response" | head -n -1)
    local status_code=$(echo "$response" | tail -n 1)
    
    if [ "$status_code" -eq 200 ]; then
        echo "$(date): Health check passed" >> "$LOG_FILE"
        return 0
    else
        echo "$(date): Health check failed - Status: $status_code" >> "$LOG_FILE"
        return 1
    fi
}

send_alert() {
    local message="$1"
    echo "$(date): ALERT - $message" >> "$LOG_FILE"
    
    # 發送 Slack 通知（可選）
    if [ -n "$WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"IVOD App Alert: $message\"}" \
            "$WEBHOOK_URL" 2>/dev/null
    fi
}

# 執行健康檢查
if ! check_health; then
    send_alert "Application health check failed"
    
    # 嘗試重啟 PM2 應用程式
    pm2 restart ivod-app
    sleep 10
    
    # 再次檢查
    if ! check_health; then
        send_alert "Application still unhealthy after restart"
    else
        send_alert "Application recovered after restart"
    fi
fi
EOF

chmod +x /usr/local/bin/ivod-monitor.sh

# 設定 cron 工作（每 5 分鐘檢查一次）
(crontab -l 2>/dev/null; echo "*/5 * * * * /usr/local/bin/ivod-monitor.sh") | crontab -
```

#### 系統資源監控

**安裝監控工具：**
```bash
# 安裝 htop 和 iotop
sudo apt-get install -y htop iotop nethogs

# 安裝 netdata（輕量級監控）
bash <(curl -Ss https://my-netdata.io/kickstart.sh) --dont-wait

# 設定 netdata 配置
sudo nano /etc/netdata/netdata.conf
# 在 [web] 區段加入：
# bind to = 127.0.0.1:19999
sudo systemctl restart netdata
```

**在 Nginx 中加入監控路由：**
```nginx
# 在 server 區塊中加入
location /monitoring/ {
    proxy_pass http://127.0.0.1:19999/;
    proxy_redirect off;
    proxy_set_header Host $host;
    
    # 限制存取（建議）
    allow 127.0.0.1;
    allow your.admin.ip.address;
    deny all;
    
    auth_basic "Monitoring Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
}
```

**建立基本認證：**
```bash
# 安裝 apache2-utils
sudo apt-get install -y apache2-utils

# 建立認證檔案
sudo htpasswd -c /etc/nginx/.htpasswd admin

# 重新載入 nginx
sudo systemctl reload nginx
```

### 9.11 部署方案比較和建議

| 特性 | PM2 | 多實例 systemd | Docker Swarm |
|------|-----|----------------|--------------|
| **複雜度** | 簡單 | 中等 | 複雜 |
| **效能** | 優秀 | 優秀 | 良好 |
| **監控** | 內建豐富監控 | 基本監控 | 內建容器監控 |
| **自動重啟** | ✅ | ✅ | ✅ |
| **負載均衡** | 內建 | 需手動設定 | 內建 |
| **零停機部署** | ✅ | 需手動 | ✅ |
| **資源隔離** | 中等 | 中等 | 優秀 |
| **易於擴展** | ✅ | 需手動 | ✅ |
| **學習曲線** | 低 | 中等 | 高 |

**建議：**
- **小型到中型部署**：使用 **PM2**（推薦）
- **需要嚴格資源隔離**：使用 **Docker Swarm**
- **已有 systemd 管理需求**：使用 **多實例 systemd**

### 9.12 設定 SSL（Let's Encrypt）

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your.domain.com

# 設定自動更新
sudo crontab -e
# 加入以下行：
# 0 12 * * * /usr/bin/certbot renew --quiet
```

### 9.10 設定防火牆

```bash
sudo ufw enable
sudo ufw allow ssh
sudo ufw allow 'Nginx Full'
sudo ufw status
```

## 10. 測試

應用程式包含全面的測試，以確保程式碼品質並防止回歸。測試策略包括單元測試、整合測試和端對端測試。

### 10.1 使用 Jest 和 React Testing Library 進行單元測試

- **框架**：Jest 搭配 React Testing Library 進行組件測試，ts-jest 支援 TypeScript
- **測試組織**：測試檔案位於 `__tests__` 目錄下，包含不同類型的子目錄：
  - 組件測試：`__tests__/*.test.tsx`
  - API 路由測試：`__tests__/*-api.test.ts`
  - 工具函數測試：`__tests__/utils.test.ts`
  - 頁面測試：`__tests__/pages/`
  - 整合測試：`__tests__/integration/`

#### 測試覆蓋範圍

**已測試的組件：**
- `SearchForm` - 表單處理、輸入驗證、提交
- `Pagination` - 頁面導航、按鈕狀態、邊界案例
- `TranscriptViewer` - 文字截斷、展開/收合功能
- `List` - IVOD 項目渲染、空狀態、委員會名稱格式化

**已測試的 API 路由：**
- `/api/search` - Elasticsearch 搭配資料庫 fallback、錯誤處理
- `/api/ivods` - 列表、篩選、分頁、排序
- `/api/ivods/[id]` - 個別記錄檢索、錯誤處理

**關鍵測試功能：**
- 模擬 Elasticsearch 和 Prisma 客戶端以測試 fallback 邏輯
- 資料庫後端切換情境
- 錯誤處理和網路故障案例
- 輸入驗證和邊界案例

### 10.2 使用 Cypress 進行端對端測試

- **框架**：Cypress v14.4.0 搭配現代化配置
- **測試組織**：E2E 規格檔案位於 `cypress/e2e/`
- **配置**：使用 `cypress.config.js`（從舊版 `cypress.json` 遷移）

#### E2E 測試覆蓋範圍

**主頁測試（`home.cy.js`）：**
- 搜尋介面渲染
- 進階搜尋切換功能
- 基本搜尋操作
- 排序選項和篩選清除
- 結果顯示處理

**IVOD 詳細頁面測試（`ivod-detail.cy.js`）：**
- IVOD 元資料顯示
- 影片播放器/佔位符處理
- 逐字稿標籤切換（AI vs 立法院）
- 外部連結功能
- 錯誤狀態處理

### 10.3 測試指令和配置

目前的 `package.json` 指令：

```json
"scripts": {
  "test": "jest --passWithNoTests --watch",
  "test:ci": "jest --runInBand --passWithNoTests",
  "cypress:open": "cypress open",
  "cypress:run": "cypress run",
  "lint": "next lint"
}
```

### 10.4 執行測試

```bash
# 安裝依賴
npm install

# 在監控模式下執行單元測試
npm run test

# 在 CI 模式下執行單元測試（用於自動化建置）
npm run test:ci

# 執行 ESLint 程式碼品質檢查
npm run lint

# 互動式執行 E2E 測試（開啟 Cypress UI）
npm run cypress:open

# 無頭執行 E2E 測試（用於 CI/CD）
npm run cypress:run
```

### 10.5 測試配置

**Jest 配置（`jest.config.js`）：**
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapping: { '^@/(.*)$': '<rootDir>/$1' },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts']
};
```

**Cypress 配置（`cypress.config.js`）：**
```javascript
module.exports = defineConfig({
  video: false,
  e2e: {
    baseUrl: 'http://localhost:3000',
    specPattern: 'cypress/e2e/**/*.{cy,spec}.{js,jsx,ts,tsx}'
  }
});
```

### 10.6 測試狀態

**目前測試覆蓋率：**
- ✅ 單元測試：64/64 通過（100%）
- ✅ 組件測試：所有主要組件的完整覆蓋
- ✅ API 測試：包括 Elasticsearch fallback 的完整覆蓋
- ✅ 整合測試：搜尋工作流程和使用者旅程
- ✅ E2E 測試：10/11 通過（91% - 需要一個小調整）

**關鍵測試功能：**
- 全面的 Elasticsearch + 資料庫 fallback 測試
- 多資料庫後端支援（SQLite、PostgreSQL、MySQL）
- 錯誤處理和邊界案例覆蓋
- 響應式設計和行動優先方法驗證
- 網路故障和超時情境

## 11. 故障排除

### 11.1 常見問題

**資料庫連線問題：**
```bash
# 檢查資料庫服務狀態
sudo systemctl status postgresql  # 或 mysql
sudo systemctl status elasticsearch

# 檢查連接埠是否開啟
sudo netstat -tlnp | grep :5432   # PostgreSQL
sudo netstat -tlnp | grep :3306   # MySQL
sudo netstat -tlnp | grep :9200   # Elasticsearch

# 測試資料庫連線
# PostgreSQL
sudo -u postgres psql -c "SELECT 1;"
# MySQL
mysql -u ivod_user -p -e "SELECT 1;"
```

**PM2 相關問題：**
```bash
# 檢查 PM2 狀態
pm2 status
pm2 info ivod-app

# 檢查 PM2 日誌
pm2 logs ivod-app --lines 50

# 重啟 PM2 應用程式
pm2 restart ivod-app

# 如果 PM2 無回應，強制刪除並重新啟動
pm2 delete ivod-app
pm2 start ecosystem.config.js

# 檢查 PM2 daemon 狀態
pm2 ping

# 重啟 PM2 daemon
pm2 kill
pm2 resurrect
```

**應用程式無法啟動：**
```bash
# 檢查 Node.js 版本
node --version  # 應該是 v18+

# 檢查環境變數
cat /home/ubuntu/ivod_transcript_db/app/.env.local

# 檢查應用程式建置
cd /home/ubuntu/ivod_transcript_db/app
npm run build

# 手動測試啟動
NODE_ENV=production npm start

# 檢查健康狀態
curl http://localhost:3000/api/health
```

**多實例問題：**
```bash
# 檢查所有實例狀態
sudo systemctl status ivod-app@*

# 檢查特定實例
sudo systemctl status ivod-app@0

# 檢查實例日誌
sudo journalctl -u ivod-app@0 -f

# 重啟所有實例
sudo systemctl restart ivod-app@{0..3}

# 檢查埠口佔用
sudo netstat -tlnp | grep :300
```

**Nginx 配置問題：**
```bash
# 測試 nginx 配置
sudo nginx -t

# 檢查 nginx 錯誤日誌
sudo tail -f /var/log/nginx/error.log

# 檢查 nginx 存取日誌
sudo tail -f /var/log/nginx/access.log

# 測試上游伺服器連線
curl -H "Host: your.domain.com" http://127.0.0.1:3000/api/health

# 重新載入配置
sudo systemctl reload nginx

# 檢查 nginx 進程
sudo ps aux | grep nginx
```

**Docker 相關問題：**
```bash
# 檢查 Docker 服務狀態
docker service ls
docker service ps ivod_app

# 檢查服務日誌
docker service logs ivod_app -f

# 檢查 swarm 狀態
docker node ls

# 重新部署服務
docker service update ivod_app

# 檢查容器健康狀態
docker ps --filter "name=ivod"
```

### 11.2 效能調整

**Nginx 快取配置：**
在 `/etc/nginx/sites-available/ivod-app` 中加入：
```nginx
# 加入快取區域
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=10g inactive=60m use_temp_path=off;

server {
    # 在 location / 中加入快取
    proxy_cache my_cache;
    proxy_cache_valid 200 1h;
    proxy_cache_use_stale error timeout invalid_header updating http_500 http_502 http_503 http_504;
}
```

**Node.js 效能調整：**
在 systemd 服務檔案中加入：
```ini
Environment=NODE_OPTIONS="--max-old-space-size=4096"
Environment=UV_THREADPOOL_SIZE=16
```

### 11.3 監控和日誌

**設定日誌輪轉：**
```bash
sudo nano /etc/logrotate.d/ivod-app
```

內容：
```
/var/log/ivod-app/*.log {
    daily
    missingok
    rotate 52
    compress
    notifempty
    create 644 www-data www-data
}
```

**監控指令：**
```bash
# 監控系統資源
htop
iostat 1
free -h

# 監控應用程式
sudo systemctl status ivod-app
sudo journalctl -u ivod-app -f

# 監控 nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## 12. 安全性考慮

### 12.1 基本安全措施

```bash
# 更新系統
sudo apt-get update && sudo apt-get upgrade -y

# 設定自動安全更新
sudo apt-get install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# 設定 fail2ban（防止暴力攻擊）
sudo apt-get install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

### 12.2 資料庫安全

```bash
# PostgreSQL 安全設定
sudo nano /etc/postgresql/*/main/postgresql.conf
# 設定 listen_addresses = 'localhost'

# MySQL 安全設定
sudo mysql_secure_installation
```

### 12.3 環境變數安全

```bash
# 確保環境變數檔案權限正確
sudo chmod 600 /home/ubuntu/ivod_transcript_db/app/.env.local
sudo chown www-data:www-data /home/ubuntu/ivod_transcript_db/app/.env.local
```

這份完整的文件涵蓋了從開發到正式環境部署的所有面向，包括詳細的 Ubuntu Linux 部署指南、故障排除和安全性考慮。