# Nginx 靜態文件配置修復指南

## 問題診斷

Next.js 生產環境下靜態文件（CSS、JS、favicon）無法載入的常見原因：

1. **Nginx 配置路徑錯誤**
2. **檔案權限問題**
3. **路徑重寫問題**
4. **快取設定衝突**

## 修復方案

### 1. 更新 Nginx 配置

替換 `/etc/nginx/sites-available/ivod-app` 中的靜態文件部分：

```nginx
# 上游伺服器定義
upstream ivod_backend {
    server 127.0.0.1:3000;
    keepalive 32;
}

server {
    listen 80;
    server_name your.domain.com;
    
    # 根目錄設定
    root /home/ubuntu/ivod_transcript_db/app;
    
    # Next.js 靜態資源（CSS、JS 等）
    location /_next/static/ {
        alias /home/ubuntu/ivod_transcript_db/app/.next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
        add_header Vary "Accept-Encoding";
        
        # 確保 CSS 和 JS 檔案的 MIME 類型正確
        location ~* \\.css$ {
            add_header Content-Type text/css;
        }
        location ~* \\.js$ {
            add_header Content-Type application/javascript;
        }
        
        # Gzip 壓縮
        gzip_static on;
        
        # 檔案不存在時不記錄錯誤
        log_not_found off;
        
        # 允許跨域（如果需要）
        add_header Access-Control-Allow-Origin *;
    }
    
    # Next.js 構建產生的其他靜態檔案
    location /_next/ {
        proxy_pass http://ivod_backend;
        proxy_cache_valid 200 1h;
        expires 1h;
        add_header Cache-Control "public";
    }
    
    # Favicon 和其他 public 目錄檔案
    location ~* ^/(favicon\.ico|favicon\.svg|apple-touch-icon\.png|favicon-16x16\.png|favicon-32x32\.png|robots\.txt|site\.webmanifest)$ {
        root /home/ubuntu/ivod_transcript_db/app/public;
        expires 30d;
        add_header Cache-Control "public";
        log_not_found off;
        
        # 確保 favicon 類型正確
        location ~* \.ico$ {
            add_header Content-Type image/x-icon;
        }
        location ~* \.svg$ {
            add_header Content-Type image/svg+xml;
        }
        location ~* \.png$ {
            add_header Content-Type image/png;
        }
    }
    
    # 其他靜態檔案
    location /static/ {
        alias /home/ubuntu/ivod_transcript_db/app/public/;
        expires 30d;
        add_header Cache-Control "public";
        gzip_static on;
        log_not_found off;
    }
    
    # API 路由
    location /api/ {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API 不快取
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }
    
    # 主要應用程式（所有其他請求）
    location / {
        proxy_pass http://ivod_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # 支援 WebSocket（如果需要）
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

### 2. 檢查和修復檔案權限

```bash
# 確保 Nginx 可以讀取靜態檔案
sudo chown -R www-data:www-data /home/ubuntu/ivod_transcript_db/app/.next
sudo chown -R www-data:www-data /home/ubuntu/ivod_transcript_db/app/public
sudo chmod -R 755 /home/ubuntu/ivod_transcript_db/app/.next
sudo chmod -R 755 /home/ubuntu/ivod_transcript_db/app/public

# 檢查權限
ls -la /home/ubuntu/ivod_transcript_db/app/.next/static/
ls -la /home/ubuntu/ivod_transcript_db/app/public/
```

### 3. 測試配置

```bash
# 測試 Nginx 配置
sudo nginx -t

# 重新載入 Nginx
sudo systemctl reload nginx

# 測試靜態檔案存取
curl -I http://your.domain.com/favicon.ico
curl -I http://your.domain.com/_next/static/css/[css-hash].css
```

### 4. 除錯工具

```bash
# 檢查 Nginx 錯誤日誌
sudo tail -f /var/log/nginx/error.log

# 檢查存取日誌
sudo tail -f /var/log/nginx/access.log

# 檢查特定檔案是否存在
ls -la /home/ubuntu/ivod_transcript_db/app/.next/static/css/
ls -la /home/ubuntu/ivod_transcript_db/app/public/favicon.ico
```

### 5. Next.js 配置檢查

確保 `next.config.js` 中沒有衝突的設定：

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  // 確保靜態檔案路徑正確
  assetPrefix: '',
  
  // 確保 trailing slash 設定一致
  trailingSlash: false,
  
  // 其他配置...
};

module.exports = nextConfig;
```

## 常見問題和解決方案

### 問題 1: CSS 檔案 404
**原因**: CSS 檔案路徑不正確或權限問題
**解決**: 檢查 `.next/static/css/` 目錄是否存在且可讀

### 問題 2: Favicon 無法載入
**原因**: `public` 目錄的 Nginx 配置不正確
**解決**: 確保 Nginx 有正確的 `root` 或 `alias` 設定指向 `public` 目錄

### 問題 3: JS 檔案載入錯誤
**原因**: MIME 類型不正確或 Gzip 壓縮問題
**解決**: 在 Nginx 配置中明確設定 Content-Type

### 問題 4: 開發環境正常，生產環境異常
**原因**: 開發環境的 Next.js 開發伺服器會自動處理靜態檔案，但生產環境需要 Nginx 配置
**解決**: 使用上述完整的 Nginx 配置

## 驗證步驟

1. **檢查建構產物**:
   ```bash
   ls -la .next/static/css/
   ls -la .next/static/chunks/
   ```

2. **檢查 public 檔案**:
   ```bash
   ls -la public/favicon.ico
   ```

3. **測試 HTTP 回應**:
   ```bash
   curl -v http://your.domain.com/favicon.ico
   curl -v http://your.domain.com/_next/static/css/[hash].css
   ```

4. **檢查瀏覽器網路標籤**:
   - 開啟瀏覽器開發者工具
   - 查看 Network 標籤
   - 檢查是否有 404 或 403 錯誤