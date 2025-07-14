# IVOD 搜尋使用指南

歡迎使用 IVOD 逐字稿搜尋系統。本系統提供強大的搜尋功能，協助您快速找到立法院的會議記錄。

## 搜尋工具

您可以使用 `search_transcripts` 工具來進行搜尋。支援以下參數：

- `query`: 關鍵字搜尋，支援引號、AND/OR 等進階語法。
- `speakers`: 指定發言的立委。
- `committees`: 指定會議的委員會。
- `mode`: 選擇不同的搜尋模式，例如 `keyword_transcript_only` 或 `semantic_search`。

## 範例

查詢黃國昌委員在交通委員會關於「交通」的發言：

```json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "交通",
    "speakers": ["黃國昌"],
    "committees": ["交通委員會"]
  }
}
```
