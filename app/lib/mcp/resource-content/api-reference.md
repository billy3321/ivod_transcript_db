# API 參考文檔

本文件詳細說明了可用的 MCP 工具及其參數。

## 1. `search_transcripts`

統一的立法院逐字稿搜尋工具，支援多種搜尋模式。

### 參數

| 參數名                 | 類型     | 描述                                                                                                 |
| ---------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `query`                | `string` | 關鍵字搜尋，支援引號、AND/OR 等進階語法。                                                          |
| `speakers`             | `array`  | 立委姓名列表，例如：`["黃國昌", "王鴻薇"]`。                                                       |
| `committees`           | `array`  | 委員會列表，例如：`["交通委員會", "內政委員會"]`。                                                   |
| `mode`                 | `string` | 搜尋模式，可選：`keyword_all_fields`, `keyword_transcript_only`, `semantic_search`, `hybrid_search`。 |
| `max_excerpt_length`   | `number` | 段落長度上限（100-2000 字符），預設 500。                                                            |
| `max_context_sentences`| `number` | 上下文句子數量上限（0-5 句），預設 2。                                                               |
| `date_from`            | `string` | 搜尋起始日期 (YYYY-MM-DD)。                                                                          |
| `date_to`              | `string` | 搜尋結束日期 (YYYY-MM-DD)。                                                                          |
| `max_results`          | `number` | 回傳結果數量上限（最多 50），預設 10。                                                               |

## 2. `get_meeting_transcript`

取得特定會議的完整逐字稿內容。

### 參數

| 參數名            | 類型     | 描述                                                                 |
| ----------------- | -------- | -------------------------------------------------------------------- |
| `ivod_id`         | `number` | **必須**。IVOD 會議的唯一識別碼。                                    |
| `transcript_type` | `string` | 逐字稿類型，可選：`auto`, `ly_only`, `ai_only`。預設 `auto`。         |
