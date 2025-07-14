# IVOD MCP Server 使用指南

## 概述

IVOD MCP Server 提供標準化的 Model Context Protocol (MCP) 介面，讓 AI 服務能夠存取台灣立法院逐字稿資料。

**MCP Protocol Version**: `2025-06-18`

## 端點資訊

- **URL**: `http://localhost:3000/api/mcp`
- **Method**: POST
- **Content-Type**: application/json
- **Protocol**: JSON-RPC 2.0

## 可用方法

### 1. `ping`

**功能**：檢查伺服器是否存活。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "ping"
}
```

**範例回應**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {}
}
```

### 2. `getCapabilities`

**功能**：取得伺服器支援的 MCP 協定版本和功能。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getCapabilities"
}
```

### 3. `initialize`

**功能**：初始化伺服器會話。回傳與 `getCapabilities` 相同的資訊。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize"
}
```

### 4. `log`

**功能**：允許客戶端向伺服器發送日誌訊息。伺服器不會回傳回應。

**參數**：
```typescript
{
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: Record<string, any>;
}
```

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": null, // log 方法的 id 可以為 null
  "method": "log",
  "params": {
    "level": "info",
    "message": "User performed a search",
    "context": {
      "user_id": "abc-123",
      "query": "數位發展"
    }
  }
}
```

### 5. `completion/create`

**功能**：用於生成文本補全。目前尚未實作，將回傳錯誤。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "completion/create",
  "params": {
    "prompt": "Hello, world!"
  }
}
```

### 6. `tools/list`

**功能**：列出伺服器提供的所有工具及其描述和輸入 schema。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/list"
}
```

### 7. `tools/call`

**功能**：呼叫指定的工具並執行其功能。

**參數**：
```typescript
{
  name: string;     // 工具名稱，例如 "search_transcripts"
  arguments: object; // 傳遞給工具的參數
}
```

#### 7.1. `search_transcripts` - 統一逐字稿搜尋

**功能**：根據多種條件搜尋立法院逐字稿並回傳相關段落。支援分頁。

**參數**：
```typescript
{
  query?: string;           // 關鍵字搜尋（支援進階語法）
  speakers?: string[];      // 發言人陣列，例如 ["黃國昌", "王鴻薇"]
  committees?: string[];    // 委員會陣列，例如 ["交通委員會", "經濟委員會"]
  meeting_name?: string;    // 會議名稱（模糊匹配）
  date_from?: string;       // 搜尋起始日期（YYYY-MM-DD）
  date_to?: string;         // 搜尋結束日期（YYYY-MM-DD）
  max_results?: number;     // 結果數量限制（1-50，預設20）
  cursor?: string;          // 用於分頁的游標，從上一次搜尋結果的 nextCursor 欄位取得
  mode?: 'keyword_all_fields' | 'keyword_transcript_only'; // 搜尋模式
  transcription_source?: 'all' | 'ly_only'; // 逐字稿來源
  max_excerpt_length?: number; // 段落長度上限
  max_context_sentences?: number; // 上下文句子數量上限
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
      "max_results": 15
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
  },
  "nextCursor": "<opaque_cursor_string>" // 如果有更多結果，會包含此欄位
}
```

#### 7.2. `get_meeting_transcript` - 取得完整會議逐字稿

**功能**：根據 IVOD ID 取得特定會議的完整逐字稿。

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

### 8. `resources/list`

**功能**：列出伺服器提供的所有資源。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/list"
}
```

### 9. `resources/read`

**功能**：讀取指定 URI 的資源內容。

**參數**：
```typescript
{
  uri: string; // 資源的 URI
}
```

### 10. `resources/templates/list`

**功能**：列出伺服器提供的所有資源模板。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "resources/templates/list"
}
```

### 11. `prompts/list`

**功能**：列出伺服器提供的所有提示。

**範例請求**：
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "prompts/list"
}
```

### 12. `prompts/get`

**功能**：取得指定名稱的提示內容。

**參數**：
```typescript
{
  name: string;     // 提示名稱
  arguments?: object; // 傳遞給提示的參數
}
```

## 回應資料格式

### 搜尋結果結構 (`search_transcripts`)

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

### 完整逐字稿結構 (`get_meeting_transcript`)

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
curl -X POST http://localhost:3000/api/mcp \
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
        "max_results": 10
      }
    }
  }'
```

### 複雜複合搜尋

```bash
curl -X POST http://localhost:3000/api/mcp \
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
        "max_results": 20
      }
    }
  }'
```

### 僅搜尋逐字稿內容

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "tools/call",
    "params": {
      "name": "search_transcripts",
      "arguments": {
        "query": "人工智慧 AND 法規",
        "max_results": 15
      }
    }
  }'
```

### 取得完整會議逐字稿

```bash
curl -X POST http://localhost:3000/api/mcp \
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

### 使用 `log` 方法

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": null,
    "method": "log",
    "params": {
      "level": "warn",
      "message": "Unexpected tool call",
      "context": {
        "tool_name": "unknown_tool",
        "input": {"foo": "bar"}
      }
    }
  }'
```

### 使用 `completion/create` 方法 (目前未實作)

```bash
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 5,
    "method": "completion/create",
    "params": {
      "prompt": "請總結這段文字：..."
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

當工具執行出錯時，錯誤資訊會包含在回應的 `error.data` 中：

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "error": {
    "code": -32603,
    "message": "Internal error while executing tool 'get_meeting_transcript': No transcript found for IVOD ID: 999999",
    "data": {
      "tool": "get_meeting_transcript",
      "args": {"ivod_id":999999,"transcript_type":"auto"}
    }
  }
}
```

## AI 服務整合

### Claude Desktop 整合

#### 設定檔案位置

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

#### 設定範例

```json
{
  "mcpServers": {
    "ivod-transcript": {
      "command": "curl",
      "args": [
        "-X", "POST",
        "-H", "Content-Type: application/json",
        "-d", "@-",
        "http://localhost:3000/api/mcp"
      ]
    }
  }
}
```

重啟 Claude Desktop 後即可使用 IVOD 搜尋功能。

### Assistant API Function Calling 整合

#### 概述

你可以使用 OpenAI Assistant API 或其他支援 function calling 的 AI 服務來存取 IVOD MCP Server。需要創建對應的 function schema 來讓 AI 調用 MCP 工具。

#### Function Schema 定義

**1. search_transcripts 函數**

```json
{
  "name": "search_transcripts",
  "description": "搜尋台灣立法院逐字稿，根據立委姓名、委員會、關鍵字、日期等條件查詢相關發言記錄",
  "parameters": {
    "type": "object",
    "properties": {
      "query": {
        "type": "string",
        "description": "搜尋關鍵字，支援進階語法如引號、AND/OR、排除等"
      },
      "speakers": {
        "type": "array",
        "items": {"type": "string"},
        "description": "立委姓名陣列，例如 [\"黃國昌\", \"王鴻薇\"]"
      },
      "committees": {
        "type": "array", 
        "items": {"type": "string"},
        "description": "委員會名稱陣列，例如 [\"交通委員會\", \"經濟委員會\"]"
      },
      "meeting_name": {
        "type": "string",
        "description": "會議名稱，支援模糊匹配，例如 \"院會\" 或 \"委員會會議\""
      },
      "transcription_source": {
        "type": "string",
        "enum": ["all", "ly_only"],
        "description": "逐字稿來源：ly_only=僅搜尋立法院官方逐字稿(更精確), all=搜尋所有逐字稿",
        "default": "all"
      },
      "mode": {
        "type": "string",
        "enum": ["keyword_all_fields", "keyword_transcript_only"],
        "description": "搜尋模式：keyword_all_fields=關鍵字搜尋所有欄位, keyword_transcript_only=僅搜尋逐字稿內容",
        "default": "keyword_transcript_only"
      },
      "date_from": {
        "type": "string",
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "搜尋起始日期，格式 YYYY-MM-DD"
      },
      "date_to": {
        "type": "string", 
        "pattern": "^\\d{4}-\\d{2}-\\d{2}$",
        "description": "搜尋結束日期，格式 YYYY-MM-DD"
      },
      "max_results": {
        "type": "integer",
        "minimum": 1,
        "maximum": 50,
        "description": "回傳結果數量上限，預設 20",
        "default": 20
      },
      "cursor": {
        "type": "string",
        "description": "用於分頁的游標，從上一次搜尋結果的 nextCursor 欄位取得。"
      }
    }
  }
}
```

**2. get_meeting_transcript 函數**

```json
{
  "name": "get_meeting_transcript", 
  "description": "根據 IVOD ID 取得特定立法院會議的完整逐字稿內容",
  "parameters": {
    "type": "object",
    "properties": {
      "ivod_id": {
        "type": "integer",
        "description": "IVOD 會議的唯一識別碼"
      },
      "transcript_type": {
        "type": "string",
        "enum": ["auto", "ly_only", "ai_only"],
        "description": "逐字稿類型：auto=自動選擇最佳版本, ly_only=僅立法院官方版本, ai_only=僅AI處理版本",
        "default": "auto"
      }
    },
    "required": ["ivod_id"]
  }
}
```

#### Function 實作範例 (Node.js)

```javascript
async function search_transcripts(params) {
  const response = await fetch('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'search_transcripts',
        arguments: params
      }
    })
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(`MCP Error: ${result.error.message}`);
  }
  
  // MCP 規範的分頁回應，nextCursor 在頂層
  return {
    content: JSON.parse(result.result.content[0].text),
    nextCursor: result.nextCursor
  };
}

async function get_meeting_transcript(params) {
  const response = await fetch('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: {
        name: 'get_meeting_transcript',
        arguments: params
      }
    })
  });
  
  const result = await response.json();
  
  if (result.error) {
    throw new Error(`MCP Error: ${result.error.message}`);
  }
  
  const content = JSON.parse(result.result.content[0].text);
  return content;
}

async function log_message(level, message, context) {
  await fetch('http://localhost:3000/api/mcp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: null,
      method: 'log',
      params: {
        level,
        message,
        context
      }
    })
  });
}
```

#### Function 實作範例 (Python)

```python
import requests
import json
from typing import Dict, List, Optional, Any

class IVODMCPClient:
    def __init__(self, base_url: str = "http://localhost:3000/api/mcp"):
        self.base_url = base_url
    
    def _call_mcp(self, method_name: str, params: Dict[str, Any], request_id: Optional[int] = 1) -> Dict[str, Any]:
        payload = {
            "jsonrpc": "2.0",
            "id": request_id,
            "method": method_name,
            "params": params
        }
        
        response = requests.post(
            self.base_url,
            headers={"Content-Type": "application/json"},
            json=payload
        )
        response.raise_for_status()
        
        result = response.json()
        if "error" in result:
            raise Exception(f"MCP Error: {result['error']['message']}")
        
        return result

    def search_transcripts(
        self,
        query: Optional[str] = None,
        speakers: Optional[List[str]] = None,
        committees: Optional[List[str]] = None,
        meeting_name: Optional[str] = None,
        transcription_source: str = "all",
        mode: str = "keyword_transcript_only",
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
        max_results: int = 20,
        cursor: Optional[str] = None
    ) -> Dict[str, Any]:
        """搜尋立法院逐字稿"""
        
        arguments = {}
        if query is not None:
            arguments["query"] = query
        if speakers is not None:
            arguments["speakers"] = speakers
        if committees is not None:
            arguments["committees"] = committees
        if meeting_name is not None:
            arguments["meeting_name"] = meeting_name
        if transcription_source != "all":
            arguments["transcription_source"] = transcription_source
        if mode != "keyword_transcript_only":
            arguments["mode"] = mode
        if date_from is not None:
            arguments["date_from"] = date_from
        if date_to is not None:
            arguments["date_to"] = date_to
        if max_results != 20:
            arguments["max_results"] = max_results
        if cursor is not None:
            arguments["cursor"] = cursor
        
        mcp_response = self._call_mcp("tools/call", {"name": "search_transcripts", "arguments": arguments})
        content = json.loads(mcp_response["result"]["content"][0]["text"])
        
        response_data = {"content": content}
        if "nextCursor" in mcp_response:
            response_data["nextCursor"] = mcp_response["nextCursor"]
        
        return response_data
    
    def get_meeting_transcript(
        self,
        ivod_id: int,
        transcript_type: str = "auto"
    ) -> Dict[str, Any]:
        """取得完整會議逐字稿"""
        
        arguments = {"ivod_id": ivod_id}
        if transcript_type != "auto":
            arguments["transcript_type"] = transcript_type
        
        mcp_response = self._call_mcp("tools/call", {"name": "get_meeting_transcript", "arguments": arguments})
        content = json.loads(mcp_response["result"]["content"][0]["text"])
        return content

    def log(self, level: str, message: str, context: Optional[Dict[str, Any]] = None):
        """發送日誌訊息到 MCP Server"""
        params = {"level": level, "message": message}
        if context is not None:
            params["context"] = context
        self._call_mcp("log", params, request_id=None) # log 方法的 id 可以為 None

# 使用範例
client = IVODMCPClient()

# 搜尋黃國昌立委關於數位發展的發言
results = client.search_transcripts(
    speakers=["黃國昌"],
    query="數位發展",
    transcription_source="ly_only",
    max_results=10
)

print(f"找到 {results['content']['metadata']['total_found']} 筆相關記錄")
for result in results['content']['results']:
    print(f"日期: {result['date']}")
    print(f"發言人: {result['speaker_name']}")
    print(f"會議: {result['meeting_info']['title']}")
    print(f"內容摘錄: {result['transcript']['excerpts'][0]['text'][:100]}...")
    print("-" * 50)

# 取得特定會議的完整逐字稿
transcript = client.get_meeting_transcript(
    ivod_id=123456,
    transcript_type="ly_only"
)

# 發送日誌訊息
client.log("info", "Application started", {"version": "1.0"})
```

#### OpenAI Assistant API 整合範例

```python
from openai import OpenAI
import json

client = OpenAI()
ivod_client = IVODMCPClient()

# 創建 Assistant
assistant = client.beta.assistants.create(
  name="立法院逐字稿分析助手",
  instructions="你是一個專門分析台灣立法院逐字稿的助手。使用提供的工具搜尋逐字稿資料，並基於實際的發言內容回答問題。",
  model="gpt-4",
  tools=[
    {
      "type": "function",
      "function": {
        "name": "search_transcripts",
        "description": "搜尋台灣立法院逐字稿",
        # ... (使用上面定義的完整 schema)
      }
    },
    {
      "type": "function", 
      "function": {
        "name": "get_meeting_transcript",
        "description": "取得完整會議逐字稿",
        # ... (使用上面定義的完整 schema)
      }
    },
    {
      "type": "function",
      "function": {
        "name": "log",
        "description": "向 MCP Server 發送日誌訊息",
        "parameters": {
          "type": "object",
          "properties": {
            "level": {"type": "string", "enum": ["error", "warn", "info", "debug"]},
            "message": {"type": "string"},
            "context": {"type": "object", "additionalProperties": True}
          },
          "required": ["level", "message"]
        }
      }
    }
  ]
)

# 處理 function calling
def handle_function_calls(run, thread_id):
    if run.status == 'requires_action':
        tool_calls = run.required_action.submit_tool_outputs.tool_calls
        tool_outputs = []
        
        for tool_call in tool_calls:
            function_name = tool_call.function.name
            arguments = json.loads(tool_call.function.arguments)
            
            if function_name == "search_transcripts":
                result = ivod_client.search_transcripts(**arguments)
            elif function_name == "get_meeting_transcript":
                result = ivod_client.get_meeting_transcript(**arguments)
            elif function_name == "log":
                ivod_client.log(**arguments)
                result = {"status": "logged"}
            else:
                result = {"error": f"Unknown function: {function_name}"}
            
            tool_outputs.append({
                "tool_call_id": tool_call.id,
                "output": json.dumps(result, ensure_ascii=False)
            })
        
        return client.beta.threads.runs.submit_tool_outputs(
            thread_id=thread_id,
            run_id=run.id,
            tool_outputs=tool_outputs
        )
    
    return run
```

#### 使用注意事項

1. **網路連線**：確保 MCP Server 在 `http://localhost:3000/api/mcp` 正常運行
2. **錯誤處理**：妥善處理網路錯誤和 MCP 錯誤回應
3. **參數驗證**：在呼叫前驗證參數格式和範圍
4. **效能考量**：避免頻繁的大量查詢，適當設定 `max_results` 限制
5. **字元編碼**：確保正確處理中文字元的編碼

#### 完整查詢範例

```python
# 查詢黃國昌在交通委員會關於數位交通的發言
results = client.search_transcripts(
    speakers=["黃國昌"],
    committees=["交通委員會"],
    query="數位交通",
    transcription_source="ly_only",
    date_from="2024-01-01",
    date_to="2024-12-31",
    max_results=15
)

print(f"找到 {results['content']['metadata']['total_found']} 筆相關記錄")
for result in results['content']['results']:
    print(f"日期: {result['date']}")
    print(f"發言人: {result['speaker_name']}")
    print(f"會議: {result['meeting_info']['title']}")
    print(f"內容摘錄: {result['transcript']['excerpts'][0]['text'][:100]}...")
    print("-" * 50)

# 檢查是否有下一頁
if "nextCursor" in results:
    print(f"下一頁游標: {results['nextCursor']}")
    # 繼續搜尋下一頁
    next_page_results = client.search_transcripts(
        query="數位交通",
        cursor=results['nextCursor'],
        max_results=15
    )
    print(f"下一頁找到 {next_page_results['content']['metadata']['total_found']} 筆記錄")
```

## 效能和限制

### 搜尋限制
- 最大回傳結果：50 筆 (由 `max_results` 控制)
- 預設結果數量：20 筆
- 段落長度範圍：100-3000 字符
- 上下文句子範圍：0-10 句

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
   - 確認服務器正在運行：`http://localhost:3000/api/mcp`
   - 檢查防火牆設定

2. **資料庫連線問題**
   - 檢查 `.env` 檔案中的資料庫設定
   - 確認資料庫服務正在運行

3. **搜尋無結果**
   - 檢查搜尋條件是否過於嚴格
   - 嘗試調整搜尋模式或擴大日期範圍
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
curl -X POST http://localhost:3000/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

這個指南提供完整的 MCP Server 使用方法，讓開發者能夠快速整合並使用 IVOD 逐字稿搜尋功能。
