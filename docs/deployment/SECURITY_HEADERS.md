# Security Headers — nginx 為 source of truth

## 背景

過去 Next.js (`next.config.js`) 與 nginx (`/etc/nginx/sites-enabled/ivod-app`) 兩邊都設了 security headers，造成 production response 出現重複且衝突的 header：

```
X-Frame-Options: SAMEORIGIN, DENY
Referrer-Policy: origin-when-cross-origin, strict-origin-when-cross-origin
X-XSS-Protection: 1; mode=block, 1; mode=block
X-Content-Type-Options: nosniff, nosniff
```

於 2026-05 統一為 **nginx 是 source of truth**，Next.js 端不再輸出 security headers。

## 部署步驟

### 1. 程式碼端（已完成）
`next.config.js` 的 `async headers()` 已移除所有 security headers，只保留 static asset 的 `Cache-Control`。

### 2. nginx 端（ops 待執行）

在 `/etc/nginx/sites-enabled/ivod-app` 的 `server { ... }` 區塊新增：

```nginx
# Permissions-Policy（拒絕用不到的瀏覽器 API；零相容性風險）
add_header Permissions-Policy "camera=(), microphone=(), geolocation=(), interest-cohort=()" always;
```

完成後 reload：
```bash
sudo nginx -t && sudo nginx -s reload
```

### 3. 驗證

```bash
curl -sSI https://ivod.billy3321.tw | grep -iE 'x-frame|x-xss|content-type-options|referrer|permissions'
```

期望結果（每個 header 只出現一次）：
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 1; mode=block`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`

## 不導入 HSTS 與 CSP 的理由

- **HSTS**：production 走 Cloudflare（Flexible SSL 模式，origin 端是 HTTP）。HSTS 建議在 Cloudflare dashboard 設定，需先升級 SSL mode 至 Full。一旦設下 `max-age` 內無法在不清瀏覽器 cache 的情況下撤回。
- **CSP**：現有 inline JSON-LD、Google Analytics、HLS.js、跨域 m3u8 fetch 較多，撰寫正確 CSP 並持續維護成本高，沒有具體威脅事件下不導入。

兩者皆列入 ops 待辦，建議 production HTTPS 配置完全確認後再評估。

## ⚠️ 部署注意事項：TRUSTED_PROXIES

`logger.ts` 與 `rate-limiter.ts` 現在透過 `lib/get-client-ip.ts` 取得 client IP。
**只有當 socket IP 落在 `TRUSTED_PROXIES`（CSV / CIDR）清單內時才信任 `X-Forwarded-For` / `X-Real-IP`。**

本機 production 環境（nginx 在 127.0.0.1 反向代理 PM2 :3000）必須在 `app/.env` 加上：
```
TRUSTED_PROXIES=127.0.0.1,::1
```

若漏設，所有請求的 client IP 都會被記成 `127.0.0.1`（socket IP），影響：
- log 內的 IP 欄位無辨識度
- rate limiter 把所有人當成同一個 IP（同一配額）

部署前驗證：
```bash
curl -H "X-Forwarded-For: 1.2.3.4" https://your-site/api/health
# 查 log 應看到 ip=1.2.3.4，而不是 127.0.0.1 / unknown
```
