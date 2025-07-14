# IVOD MCP Server 使用指南

## 概述

IVOD MCP Server 提供標準化的 Model Context Protocol 介面，讓 AI 服務能夠存取台灣立法院逐字稿資料。

## 端點資訊

- **URL**: `http://localhost:3000/mcp`
- **Method**: POST
- **Content-Type**: application/json
- **Protocol**: JSON-RPC 2.0

## 可用工具

### 1. search_transcripts - 統一逐字稿搜尋

**功能**：根據多種條件搜尋立法院逐字稿並回傳相關段落

**參數**：
```typescript
{
  query?: string;           // 關鍵字搜尋（支援進階語法）
  speakers?: string[];      // 發言人陣列，例如 ["黃國昌", "王鴻薇"]
  committees?: string[];    // 委員會陣列，例如 ["交通委員會", "經濟委員會"]
  meeting_name?: string;    // 會議名稱（模糊匹配）
  date_from?: string;       // 搜尋起始日期（YYYY-MM-DD）
  date_to?: string;         // 搜尋結束日期（YYYY-MM-DD）
  limit?: number;           // 結果數量限制（1-100，預設20）
}
```

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "search_transcripts",
    "arguments": {
      "speakers": ["黃國昌", "王鴻薇"],
      "committees": ["交通委員會", "內政委員會"],
      "query": "預算",
      "limit": 15
    }
  }
}
```

**回應格式**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"results\": [...], \"metadata\": {...}}"
      }
    ]
  }
}
```

### 2. get_meeting_transcript - 取得完整會議逐字稿

**功能**：根據 IVOD ID 取得特定會議的完整逐字稿

**參數**：
```typescript
{
  ivod_id: number;                           // IVOD 會議 ID（必填）
  transcript_type?: 'auto' | 'ly_only' | 'ai_only';  // 逐字稿類型（預設：auto）
}
```

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "get_meeting_transcript",
    "arguments": {
      "ivod_id": 123456,
      "transcript_type": "auto"
    }
  }
}
```

## 回應資料格式

### 搜尋結果結構

```json
{
  "results": [
    {
      "ivod_id": 123456,
      "speaker_name": "黃國昌",
      "date": "2024-12-01",
      "meeting_info": {
        "title": "立法院第11屆第2會期交通委員會第8次全體委員會議",
        "meeting_name": "交通委員會會議",
        "committee_names": ["交通委員會"],
        "category": "委員會會議"
      },
      "transcript": {
        "source": "ly_transcript",
        "excerpts": [
          {
            "text": "主席，針對交通部提出的數位交通政策...",
            "relevance_score": 0.8,
            "start_position": 1250,
            "end_position": 1380
          }
        ],
        "full_length": 15420
      },
      "ivod_url": "https://ivod.ly.gov.tw/Play/VOD/123456"
    }
  ],
  "metadata": {
    "total_found": 15,
    "search_params": {...},
    "excerpt_config": {
      "length": 800,
      "context_sentences": 3
    },
    "search_time_ms": 245,
    "success": true
  }
}
```

### 完整逐字稿結構

```json
{
  "result": {
    "ivod_id": 123456,
    "speaker_name": "黃國昌",
    "date": "2024-12-01",
    "meeting_info": {
      "title": "立法院第11屆第2會期交通委員會第8次全體委員會議",
      "meeting_name": "交通委員會會議",
      "committee_names": ["交通委員會"],
      "category": "委員會會議"
    },
    "transcript": {
      "source": "ly_transcript",
      "content": "完整的逐字稿內容...",
      "full_length": 15420
    },
    "ivod_url": "https://ivod.ly.gov.tw/Play/VOD/123456"
  },
  "success": true,
  "metadata": {
    "search_time_ms": 123
  }
}
```

## 使用範例

### 基本立委搜尋

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "search_transcripts",
      "arguments": {
        "speakers": ["黃國昌"],
        "query": "數位發展",
        "limit": 10
      }
    }
  }'
```

### 複雜複合搜尋

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "search_transcripts",
      "arguments": {
        "speakers": ["黃國昌", "王鴻薇"],
        "committees": ["交通委員會", "內政委員會"],
        "query": "交通",
        "date_from": "2024-01-01",
        "date_to": "2024-12-31",
        "limit": 20
      }
    }
  }'
```

### 僅搜尋逐字稿內容

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_transcripts",
      "arguments": {
        "query": "人工智慧 AND 法規",
        "limit": 15
      }
    }
  }'
```

### 取得完整會議逐字稿

```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 4,
    "method": "tools/call",
    "params": {
      "name": "get_meeting_transcript",
      "arguments": {
        "ivod_id": 123456,
        "transcript_type": "ly_only"
      }
    }
  }'
```

## 錯誤處理

### 標準錯誤格式

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error"
  }
}
```

### 常見錯誤碼

- `-32600`: Invalid Request - JSON-RPC 格式錯誤
- `-32601`: Method not found - 方法不存在
- `-32602`: Invalid params - 參數無效
- `-32603`: Internal error - 內部錯誤

### 工具特定錯誤

當工具執行出錯時，錯誤資訊會包含在回應的 `content` 中：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{\"error\": \"No transcript found for IVOD ID: 999999\", \"success\": false}"
      }
    ]
  }
}
```

## Claude Desktop 整合

### 設定檔案位置

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

### 設定範例

```json
{
  "mcpServers": {
    "ivod-transcript": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", "@-",
        "http://localhost:3000/mcp"
      ]
    }
  }
}
```

重啟 Claude Desktop 後即可使用 IVOD 搜尋功能。

## 效能和限制

### 搜尋限制
- 最大回傳結果：100 筆
- 預設結果數量：20 筆
- 段落長度範圍：200-2000 字符
- 上下文句子範圍：1-10 句

### 效能考量
- 搜尋通常在 2 秒內完成
- Elasticsearch 失效時自動 fallback 到資料庫搜尋
- 大量複合搜尋可能需要更長時間

### 資料來源優先級
1. `ly_transcript` (立委官方逐字稿) - 優先使用
2. `ai_transcript` (AI 生成逐字稿) - 備用選項

## 疑難排解

### 常見問題

1. **連線錯誤**
   - 確認服務器正在運行：`http://localhost:3000`
   - 檢查防火牆設定

2. **資料庫連線問題**
   - 檢查 `.env` 檔案中的資料庫設定
   - 確認資料庫服務正在運行

3. **搜尋無結果**
   - 檢查搜尋條件是否過於嚴格
   - 嘗試調整 `search_mode` 從 `intersection` 到 `union`
   - 確認日期範圍設定

4. **Elasticsearch 問題**
   - MCP Server 會自動 fallback 到資料庫搜尋
   - 檢查日誌中的 fallback 訊息

### 除錯

檢查 MCP Server 日誌：
```bash
tail -f logs/app.log | grep MCP
```

測試基本連線：
```bash
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

這個指南提供完整的 MCP Server 使用方法，讓開發者能夠快速整合並使用 IVOD 逐字稿搜尋功能。