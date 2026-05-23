# Crawler SSL — `fetch_ly_speech` 為何使用 `curl --insecure`

## 現況（2026-05 實地驗證）

`crawler/ivod/crawler.py` 的 `fetch_ly_speech()` 使用：

```python
subprocess.run(["curl", "--tlsv1.2", "--insecure", "-sSf", url], ...)
```

這是抓取 `https://ivod.ly.gov.tw/Demand/Speech/{ivod_id}` 唯一已知穩定能跑的方式。

## 為何 `--insecure` 仍需保留

- **憑證本身有效**：由 TWCA Secure SSL Certification Authority 簽發，subject `CN=*.ly.gov.tw`，到期 2026-09-25。
- **開發機（macOS）curl 可 verify ok**。
- **production server**（Ubuntu 24+/Linode）curl handshake 失敗（exit code 35，`ssl_verify_result=1`）— 推測為 CA bundle 過舊。

如果直接拔掉 `--insecure`，production 爬蟲會中斷。

## 修復步驟（ops 待辦）

```bash
# Production server
sudo apt update && sudo apt install --reinstall ca-certificates
sudo update-ca-certificates
# 重新驗證
curl --tlsv1.2 -I https://ivod.ly.gov.tw
# 如果 verify ok（沒看到 SSL certificate problem），即可移除 --insecure
```

修復後請：
1. 修改 `crawler/ivod/crawler.py` 移除 `"--insecure"`
2. 跑 `pytest crawler/tests/` 確認測試仍通過
3. 部署並觀察一週的 crawler 成功率

## 為何不直接改用 Python `requests`

`fetch_ly_speech` 的 raw HTML 解析在 production 已穩定多年。改用 `requests` 雖然能享受到 `urllib3` 的 SSL 處理（含可選擇性的 `verify=False`），但可能改變 HTTP response 細節（header 處理、autodecompress、encoding 判斷等）。為避免引入難以察覺的行為差異，目前選擇保留 curl subprocess。
