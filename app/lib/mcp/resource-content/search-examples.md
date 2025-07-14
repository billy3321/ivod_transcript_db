# 搜尋範例集

以下是一些使用 `search_transcripts` 工具的常見範例。

## 範例 1：基本關鍵字搜尋

在逐字稿中搜尋包含「人工智慧」的內容。

```json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "人工智慧",
    "mode": "keyword_transcript_only"
  }
}
```

## 範例 2：指定立委和委員會

搜尋王鴻薇委員在財政委員會的發言。

```json
{
  "tool": "search_transcripts",
  "arguments": {
    "speakers": ["王鴻薇"],
    "committees": ["財政委員會"]
  }
}
```

## 範例 3：混合搜尋

使用混合模式搜尋「數位身分證」的相關討論，並將結果限制為 5 筆。

```json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "數位身分證",
    "mode": "hybrid_search",
    "max_results": 5
  }
}
```

## 範例 4：指定日期範圍

搜尋在 2024 年 5 月期間，關於「能源政策」的討論。

```json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "能源政策",
    "date_from": "2024-05-01",
    "date_to": "2024-05-31"
  }
}
```
