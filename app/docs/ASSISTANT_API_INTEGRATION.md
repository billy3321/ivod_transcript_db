# IVOD MCP Server - Assistant API Integration Guide

這份文件說明如何在 Flask Python 應用中整合 OpenAI Assistant API 的 function calling 功能，以存取 IVOD MCP Server 進行台灣立法院逐字稿查詢。

## 架構概述

```
User Request → Flask App → OpenAI Assistant API → Function Calling → MCP Server → Response
```

1. **用戶請求**：透過 Flask API 發送查詢請求
2. **Assistant API**：OpenAI Assistant 分析請求並決定呼叫相應的 function
3. **Function Calling**：Flask 攔截 function call，發送請求到 IVOD MCP Server
4. **MCP Server**：處理逐字稿查詢並返回結果
5. **回應處理**：Flask 將結果傳回 Assistant API，最終回傳給用戶

## 所需依賴套件

```bash
pip install openai requests flask python-dotenv
```

## 環境變數設定

創建 `.env` 檔案：

```env
# OpenAI API 設定
OPENAI_API_KEY=your_openai_api_key_here

# IVOD MCP Server 設定
MCP_SERVER_URL=http://localhost:3000/mcp

# Flask 設定
FLASK_SECRET_KEY=your_secret_key_here
```

## 核心實作

### 1. MCP Client 類別 (`mcp_client.py`)

```python
import requests
import json
import logging
from typing import Dict, List, Optional, Any

logger = logging.getLogger(__name__)

class IVODMCPClient:
    """IVOD MCP Server 客戶端"""
    
    def __init__(self, base_url: str):
        self.base_url = base_url
    
    def _call_mcp(self, tool_name: str, arguments: Dict[str, Any]) -> Dict[str, Any]:
        """發送請求到 MCP Server"""
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": tool_name,
                "arguments": arguments
            }
        }
        
        try:
            response = requests.post(
                self.base_url,
                headers={"Content-Type": "application/json"},
                json=payload,
                timeout=30
            )
            response.raise_for_status()
            
            result = response.json()
            
            if "error" in result:
                raise Exception(f"MCP Error: {result['error']['message']}")
            
            # 解析 JSON 字串回應
            content = json.loads(result["result"]["content"][0]["text"])
            return content
            
        except requests.RequestException as e:
            logger.error(f"Network error calling MCP server: {e}")
            raise Exception(f"無法連接到 MCP Server: {e}")
        except json.JSONDecodeError as e:
            logger.error(f"JSON decode error: {e}")
            raise Exception(f"MCP Server 回應格式錯誤: {e}")
        except Exception as e:
            logger.error(f"Unexpected error: {e}")
            raise
    
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
        max_results: int = 20
    ) -> Dict[str, Any]:
        """搜尋立法院逐字稿"""
        
        arguments = {}
        
        # 只添加非預設值的參數
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
        
        return self._call_mcp("search_transcripts", arguments)
    
    def get_meeting_transcript(
        self,
        ivod_id: int,
        transcript_type: str = "auto"
    ) -> Dict[str, Any]:
        """取得完整會議逐字稿"""
        
        arguments = {"ivod_id": ivod_id}
        if transcript_type != "auto":
            arguments["transcript_type"] = transcript_type
        
        return self._call_mcp("get_meeting_transcript", arguments)
```

### 2. Function Schemas (`function_schemas.py`)

```python
"""OpenAI Assistant API Function Schemas"""

SEARCH_TRANSCRIPTS_SCHEMA = {
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
                "description": "立委姓名陣列，例如 ['沈伯洋', '黃捷']"
            },
            "committees": {
                "type": "array", 
                "items": {"type": "string"},
                "description": "委員會名稱陣列，例如 ['交通委員會', '經濟委員會']"
            },
            "meeting_name": {
                "type": "string",
                "description": "會議名稱，支援模糊匹配，例如 '院會' 或 '委員會會議'"
            },
            "transcription_source": {
                "type": "string",
                "enum": ["all", "ly_only"],
                "description": "逐字稿來源：ly_only=僅搜尋立法院官方逐字稿(更精確), all=搜尋所有逐字稿",
                "default": "all"
            },
            "mode": {
                "type": "string",
                "enum": ["keyword_all_fields", "keyword_transcript_only", "semantic_search"],
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
            }
        }
    }
}

GET_MEETING_TRANSCRIPT_SCHEMA = {
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

# 所有可用的 function schemas
FUNCTION_SCHEMAS = [
    {
        "type": "function",
        "function": SEARCH_TRANSCRIPTS_SCHEMA
    },
    {
        "type": "function",
        "function": GET_MEETING_TRANSCRIPT_SCHEMA
    }
]
```

### 3. Assistant Manager (`assistant_manager.py`)

```python
import json
import time
import logging
from typing import Dict, Any, Optional
from openai import OpenAI
from mcp_client import IVODMCPClient
from function_schemas import FUNCTION_SCHEMAS

logger = logging.getLogger(__name__)

class IVODAssistantManager:
    """IVOD 逐字稿查詢助手管理器"""
    
    def __init__(self, openai_api_key: str, mcp_server_url: str):
        self.openai_client = OpenAI(api_key=openai_api_key)
        self.mcp_client = IVODMCPClient(mcp_server_url)
        self.assistant = None
    
    def create_assistant(self) -> str:
        """創建或更新 Assistant"""
        try:
            assistant = self.openai_client.beta.assistants.create(
                name="台灣立法院逐字稿分析助手",
                instructions="""你是一個專門分析台灣立法院逐字稿的助手。你的任務是：

1. 根據用戶的問題，使用提供的工具搜尋相關的立法院逐字稿資料
2. 基於實際的逐字稿內容回答問題，提供有憑有據的分析
3. 當搜尋立委發言時，優先使用 transcription_source="ly_only" 以獲得更精確的結果
4. 對於複雜查詢，可以組合使用多個搜尋條件
5. 如果找不到相關資料，請明確說明並建議調整搜尋條件

回答時請：
- 引用具體的發言內容
- 標註發言的日期、會議和發言人
- 提供客觀的分析，避免主觀推測
- 如果有爭議或不同觀點，請平衡呈現""",
                model="gpt-4",
                tools=FUNCTION_SCHEMAS
            )
            
            self.assistant = assistant
            logger.info(f"Created assistant with ID: {assistant.id}")
            return assistant.id
            
        except Exception as e:
            logger.error(f"Error creating assistant: {e}")
            raise
    
    def handle_function_calls(self, run, thread_id: str):
        """處理 function calling"""
        if run.status == 'requires_action':
            tool_calls = run.required_action.submit_tool_outputs.tool_calls
            tool_outputs = []
            
            for tool_call in tool_calls:
                function_name = tool_call.function.name
                arguments = json.loads(tool_call.function.arguments)
                
                logger.info(f"Executing function: {function_name} with args: {arguments}")
                
                try:
                    if function_name == "search_transcripts":
                        result = self.mcp_client.search_transcripts(**arguments)
                    elif function_name == "get_meeting_transcript":
                        result = self.mcp_client.get_meeting_transcript(**arguments)
                    else:
                        result = {"error": f"Unknown function: {function_name}"}
                    
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "output": json.dumps(result, ensure_ascii=False)
                    })
                    
                except Exception as e:
                    logger.error(f"Function execution error: {e}")
                    error_result = {
                        "error": str(e),
                        "success": False
                    }
                    tool_outputs.append({
                        "tool_call_id": tool_call.id,
                        "output": json.dumps(error_result, ensure_ascii=False)
                    })
            
            return self.openai_client.beta.threads.runs.submit_tool_outputs(
                thread_id=thread_id,
                run_id=run.id,
                tool_outputs=tool_outputs
            )
        
        return run
    
    def chat(self, user_message: str, thread_id: Optional[str] = None) -> Dict[str, Any]:
        """處理用戶對話"""
        try:
            # 創建或使用現有 thread
            if thread_id is None:
                thread = self.openai_client.beta.threads.create()
                thread_id = thread.id
            
            # 添加用戶訊息
            self.openai_client.beta.threads.messages.create(
                thread_id=thread_id,
                role="user",
                content=user_message
            )
            
            # 開始運行
            run = self.openai_client.beta.threads.runs.create(
                thread_id=thread_id,
                assistant_id=self.assistant.id
            )
            
            # 等待並處理 function calls
            max_iterations = 30  # 防止無限循環
            iteration = 0
            
            while run.status in ['queued', 'in_progress', 'requires_action'] and iteration < max_iterations:
                if run.status == 'requires_action':
                    run = self.handle_function_calls(run, thread_id)
                
                time.sleep(1)
                run = self.openai_client.beta.threads.runs.retrieve(
                    thread_id=thread_id,
                    run_id=run.id
                )
                iteration += 1
            
            if iteration >= max_iterations:
                raise Exception("Assistant 處理超時")
            
            if run.status == 'failed':
                raise Exception(f"Assistant 運行失敗: {run.last_error}")
            
            # 取得最新回應
            messages = self.openai_client.beta.threads.messages.list(
                thread_id=thread_id,
                limit=1
            )
            
            if messages.data:
                response_content = messages.data[0].content[0].text.value
                return {
                    "success": True,
                    "response": response_content,
                    "thread_id": thread_id,
                    "run_id": run.id
                }
            else:
                raise Exception("未收到 Assistant 回應")
                
        except Exception as e:
            logger.error(f"Chat error: {e}")
            return {
                "success": False,
                "error": str(e),
                "thread_id": thread_id
            }
```

### 4. Flask 應用主程式 (`app.py`)

```python
import os
import logging
from flask import Flask, request, jsonify
from dotenv import load_dotenv
from assistant_manager import IVODAssistantManager

# 載入環境變數
load_dotenv()

# 設定日誌
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# 創建 Flask 應用
app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY')

# 初始化 Assistant Manager
assistant_manager = IVODAssistantManager(
    openai_api_key=os.getenv('OPENAI_API_KEY'),
    mcp_server_url=os.getenv('MCP_SERVER_URL')
)

@app.before_first_request
def initialize():
    """應用啟動時初始化 Assistant"""
    try:
        assistant_id = assistant_manager.create_assistant()
        logger.info(f"Assistant initialized with ID: {assistant_id}")
    except Exception as e:
        logger.error(f"Failed to initialize assistant: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """健康檢查端點"""
    return jsonify({
        "status": "healthy",
        "service": "IVOD Assistant API",
        "mcp_server": os.getenv('MCP_SERVER_URL')
    })

@app.route('/chat', methods=['POST'])
def chat():
    """對話端點"""
    try:
        data = request.get_json()
        
        if not data or 'message' not in data:
            return jsonify({
                "success": False,
                "error": "缺少 'message' 欄位"
            }), 400
        
        user_message = data['message']
        thread_id = data.get('thread_id')  # 可選的對話 ID
        
        # 處理對話
        result = assistant_manager.chat(user_message, thread_id)
        
        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 500
            
    except Exception as e:
        logger.error(f"Chat endpoint error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/search', methods=['POST'])
def direct_search():
    """直接搜尋端點（不透過 Assistant）"""
    try:
        data = request.get_json()
        
        # 從 MCP client 直接搜尋
        result = assistant_manager.mcp_client.search_transcripts(**data)
        
        return jsonify({
            "success": True,
            "data": result
        })
        
    except Exception as e:
        logger.error(f"Direct search error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/transcript/<int:ivod_id>', methods=['GET'])
def get_transcript(ivod_id):
    """取得完整逐字稿端點"""
    try:
        transcript_type = request.args.get('type', 'auto')
        
        result = assistant_manager.mcp_client.get_meeting_transcript(
            ivod_id=ivod_id,
            transcript_type=transcript_type
        )
        
        return jsonify({
            "success": True,
            "data": result
        })
        
    except Exception as e:
        logger.error(f"Get transcript error: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

if __name__ == '__main__':
    app.run(
        host='0.0.0.0',
        port=int(os.getenv('PORT', 5000)),
        debug=os.getenv('FLASK_ENV') == 'development'
    )
```

### 5. 使用範例 (`example_usage.py`)

```python
import requests
import json

# Flask 應用的 URL
BASE_URL = "http://localhost:5000"

def test_chat():
    """測試對話功能"""
    response = requests.post(f"{BASE_URL}/chat", json={
        "message": "請查詢沈伯洋立委在交通委員會關於數位交通政策的發言"
    })
    
    result = response.json()
    print("Chat Response:")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    
    return result.get('thread_id')

def test_continued_chat(thread_id):
    """測試續接對話"""
    response = requests.post(f"{BASE_URL}/chat", json={
        "message": "這些發言中有提到什麼具體的政策建議嗎？",
        "thread_id": thread_id
    })
    
    result = response.json()
    print("\nContinued Chat Response:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

def test_direct_search():
    """測試直接搜尋"""
    response = requests.post(f"{BASE_URL}/search", json={
        "speakers": ["沈伯洋"],
        "committees": ["交通委員會"],
        "query": "數位交通",
        "transcription_source": "ly_only",
        "max_results": 5
    })
    
    result = response.json()
    print("\nDirect Search Response:")
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    # 測試健康檢查
    health = requests.get(f"{BASE_URL}/health")
    print("Health Check:", health.json())
    
    # 測試對話
    thread_id = test_chat()
    
    # 測試續接對話
    if thread_id:
        test_continued_chat(thread_id)
    
    # 測試直接搜尋
    test_direct_search()
```

## 部署指南

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 設定環境變數

複製 `.env.example` 到 `.env` 並填入正確的值：

```bash
cp .env.example .env
# 編輯 .env 檔案
```

### 3. 啟動應用

```bash
# 開發模式
export FLASK_ENV=development
python app.py

# 生產模式
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### 4. 測試

```bash
# 健康檢查
curl http://localhost:5000/health

# 測試對話
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "請查詢沈伯洋立委的發言"}'
```

## API 文檔

### POST /chat

**功能**：與 AI 助手對話，自動執行逐字稿查詢

**請求格式**：
```json
{
  "message": "請查詢沈伯洋立委關於數位發展的發言",
  "thread_id": "可選的對話 ID，用於續接對話"
}
```

**回應格式**：
```json
{
  "success": true,
  "response": "AI 助手的回應內容...",
  "thread_id": "對話 ID，用於續接對話",
  "run_id": "執行 ID"
}
```

### POST /search

**功能**：直接搜尋逐字稿（不透過 AI）

**請求格式**：
```json
{
  "query": "搜尋關鍵字",
  "speakers": ["立委姓名"],
  "committees": ["委員會名稱"],
  "transcription_source": "ly_only",
  "max_results": 10
}
```

### GET /transcript/<ivod_id>

**功能**：取得完整會議逐字稿

**參數**：
- `type`: 逐字稿類型（auto/ly_only/ai_only）

## 錯誤處理

所有 API 都會返回統一的錯誤格式：

```json
{
  "success": false,
  "error": "錯誤描述"
}
```

常見錯誤：
- `MCP Server 連線錯誤`：檢查 MCP_SERVER_URL 設定
- `OpenAI API 錯誤`：檢查 OPENAI_API_KEY 是否正確
- `Assistant 處理超時`：複雜查詢可能需要更長時間

## 效能優化建議

1. **快取機制**：對常用查詢結果進行快取
2. **連線池**：使用 requests Session 進行連線復用
3. **異步處理**：對於耗時查詢考慮使用異步處理
4. **日誌監控**：設定詳細的日誌和監控

## 安全考量

1. **API Key 保護**：絕不在代碼中硬編碼 API Key
2. **輸入驗證**：對所有用戶輸入進行驗證
3. **速率限制**：實作 API 呼叫速率限制
4. **HTTPS**：生產環境務必使用 HTTPS

這份文件提供了完整的實作指南，你可以直接在 Flask 專案中使用這些代碼來建立支援 function calling 的 IVOD 逐字稿查詢服務。