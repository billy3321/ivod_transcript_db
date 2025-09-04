import React, { useState } from 'react';
import Layout from '@/components/Layout';
import { GetServerSideProps } from 'next';

interface MCPGuideProps {
  serverUrl: string;
}

const MCPGuidePage: React.FC<MCPGuideProps> = ({ serverUrl }) => {
  const [copiedSection, setCopiedSection] = useState<string>('');

  const handleCopy = (text: string, section: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(section);
    setTimeout(() => setCopiedSection(''), 2000);
  };

  const mcpServerUrl = `${serverUrl}/api/mcp`;

  const getConfigText = (clientType: string) => {
    switch (clientType) {
      case 'claude':
        return `{
  "mcpServers": {
    "ivod-transcript": {
      "command": "npx",
      "args": [
        "@modelcontextprotocol/server-fetch",
        "${mcpServerUrl}"
      ]
    }
  }
}`;
      case 'chatgpt':
        return `{
  "name": "台灣立法院逐字稿搜尋",
  "description": "搜尋台灣立法院IVOD逐字稿資料的MCP服務",
  "schema_version": "v1",
  "capabilities": {
    "tools": true
  },
  "instructions": [
    "使用search_transcripts工具搜尋立法院逐字稿",
    "使用get_meeting_transcript工具取得完整會議內容",
    "優先使用ly_only參數獲得更精確的結果"
  ],
  "servers": [
    {
      "url": "${mcpServerUrl}",
      "name": "ivod-mcp-server"
    }
  ]
}`;
      case 'gemini':
        return `import { MCPClient } from '@modelcontextprotocol/sdk';

const mcpClient = new MCPClient({
  serverUrl: "${mcpServerUrl}",
  capabilities: ['tools']
});

// 初始化連接
await mcpClient.connect();

// 搜尋逐字稿
const searchResult = await mcpClient.callTool('search_transcripts', {
  speakers: ['黃國昌'],
  query: '數位發展',
  transcription_source: 'ly_only'
});`;
      default:
        return '';
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-800 mb-4">
              IVOD MCP 服務設定指南
            </h1>
            <p className="text-lg text-gray-600">
              在 AI 助理中使用台灣立法院逐字稿搜尋服務
            </p>
          </div>

          {/* Service Overview */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">服務概述</h2>
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">MCP 服務端點</h3>
                <div className="bg-gray-100 rounded-md p-3 font-mono text-sm">
                  {mcpServerUrl}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">支援的功能</h3>
                <ul className="list-disc list-inside space-y-2 text-gray-600">
                  <li><strong>search_transcripts</strong> - 搜尋立法院逐字稿，支援立委姓名、委員會、關鍵字、日期範圍等條件</li>
                  <li><strong>get_meeting_transcript</strong> - 根據 IVOD ID 取得完整會議逐字稿</li>
                  <li><strong>日誌記錄</strong> - 支援客戶端日誌傳送與錯誤追蹤</li>
                  <li><strong>分頁查詢</strong> - 大量結果自動分頁，支援游標式翻頁</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Client Setup Instructions */}
          <div className="space-y-8">
            {/* Claude Desktop */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  C
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">Claude Desktop</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">1. 設定檔位置</h3>
                  <div className="space-y-2 text-sm">
                    <div><strong>macOS:</strong> <code className="bg-gray-100 px-2 py-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code></div>
                    <div><strong>Windows:</strong> <code className="bg-gray-100 px-2 py-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code></div>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">2. 設定內容</h3>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                      <code>{getConfigText('claude')}</code>
                    </pre>
                    <button
                      onClick={() => handleCopy(getConfigText('claude'), 'claude')}
                      className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                    >
                      {copiedSection === 'claude' ? '已複製!' : '複製'}
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">3. 重啟 Claude Desktop</h3>
                  <p className="text-gray-600">儲存設定檔後，重啟 Claude Desktop 應用程式即可使用 IVOD 搜尋功能。</p>
                </div>
              </div>
            </div>

            {/* ChatGPT */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  G
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">ChatGPT (GPTs)</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">1. 創建自訂 GPT</h3>
                  <p className="text-gray-600 mb-2">在 ChatGPT 中創建新的 GPT，並使用以下設定：</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                      <code>{getConfigText('chatgpt')}</code>
                    </pre>
                    <button
                      onClick={() => handleCopy(getConfigText('chatgpt'), 'chatgpt')}
                      className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                    >
                      {copiedSection === 'chatgpt' ? '已複製!' : '複製'}
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">2. Function Calling 設定</h3>
                  <p className="text-gray-600">需要手動定義函數 schema，或使用 MCP Proxy 服務將 MCP 轉換為 OpenAI Function Calling 格式。</p>
                </div>
              </div>
            </div>

            {/* Google Gemini */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center mb-4">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
                  G
                </div>
                <h2 className="text-2xl font-semibold text-gray-800">Google Gemini</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">1. MCP SDK 整合</h3>
                  <p className="text-gray-600 mb-2">使用 JavaScript/TypeScript 整合 MCP 客戶端：</p>
                  <div className="relative">
                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                      <code>{getConfigText('gemini')}</code>
                    </pre>
                    <button
                      onClick={() => handleCopy(getConfigText('gemini'), 'gemini')}
                      className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                    >
                      {copiedSection === 'gemini' ? '已複製!' : '複製'}
                    </button>
                  </div>
                </div>
                
                <div>
                  <h3 className="text-lg font-medium text-gray-700 mb-2">2. Vertex AI Function Calling</h3>
                  <p className="text-gray-600">也可以透過 Vertex AI 的 Function Calling 功能使用，需要轉換 MCP 格式為 Google Cloud Function 格式。</p>
                </div>
              </div>
            </div>
          </div>

          {/* Testing Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">測試 MCP 連接</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">使用 cURL 測試</h3>
                <div className="relative">
                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-md overflow-x-auto text-sm">
                    <code>{`curl -X POST ${mcpServerUrl} \\
  -H "Content-Type: application/json" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'`}</code>
                  </pre>
                  <button
                    onClick={() => handleCopy(`curl -X POST ${mcpServerUrl} \\\n  -H "Content-Type: application/json" \\\n  -d '{\n    "jsonrpc": "2.0",\n    "id": 1,\n    "method": "tools/list"\n  }'`, 'curl')}
                    className="absolute top-2 right-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-xs transition-colors"
                  >
                    {copiedSection === 'curl' ? '已複製!' : '複製'}
                  </button>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-gray-700 mb-2">MCP Inspector 測試</h3>
                <div className="bg-gray-100 rounded-md p-4">
                  <p className="text-gray-700 mb-2">使用官方 MCP Inspector 工具測試連接：</p>
                  <code className="bg-white px-2 py-1 rounded border">
                    npx @modelcontextprotocol/inspector {mcpServerUrl}
                  </code>
                </div>
              </div>
            </div>
          </div>

          {/* MCP Functions Documentation */}
          <div className="bg-white rounded-lg shadow-md p-6 mt-8">
            <h2 className="text-2xl font-semibold text-gray-800 mb-4">MCP 函數說明</h2>
            
            <div className="space-y-6">
              {/* search_transcripts */}
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="text-xl font-medium text-gray-800 mb-3">search_transcripts</h3>
                <p className="text-gray-600 mb-4">搜尋立法院逐字稿，支援多種搜尋條件組合使用</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-700 mb-2">主要參數</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li><strong>query:</strong> 搜尋關鍵字（支援進階語法）</li>
                      <li><strong>speakers:</strong> 立委姓名陣列</li>
                      <li><strong>committees:</strong> 委員會名稱陣列</li>
                      <li><strong>meeting_name:</strong> 會議名稱（模糊匹配）</li>
                      <li><strong>date_from/date_to:</strong> 日期範圍</li>
                      <li><strong>transcription_source:</strong> ly_only（推薦）或 all</li>
                      <li><strong>max_results:</strong> 結果數量限制（1-50）</li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-700 mb-2">使用範例</h4>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <div className="mb-2"><strong>搜尋立委發言:</strong></div>
                      <code className="text-xs">speakers: ["黃國昌"], query: "數位發展"</code>
                      
                      <div className="mt-3 mb-2"><strong>委員會會議:</strong></div>
                      <code className="text-xs">committees: ["交通委員會"], query: "交通建設"</code>
                      
                      <div className="mt-3 mb-2"><strong>日期範圍:</strong></div>
                      <code className="text-xs">date_from: "2024-01-01", date_to: "2024-12-31"</code>
                    </div>
                  </div>
                </div>
              </div>

              {/* get_meeting_transcript */}
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="text-xl font-medium text-gray-800 mb-3">get_meeting_transcript</h3>
                <p className="text-gray-600 mb-4">根據 IVOD ID 取得特定會議的完整逐字稿</p>
                
                <div className="grid md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-lg font-medium text-gray-700 mb-2">參數</h4>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li><strong>ivod_id:</strong> IVOD 會議 ID（必填）</li>
                      <li><strong>transcript_type:</strong> 逐字稿類型
                        <ul className="ml-4 mt-1 space-y-1">
                          <li>• auto - 自動選擇最佳版本</li>
                          <li>• ly_only - 僅立法院官方版本</li>
                          <li>• ai_only - 僅 AI 處理版本</li>
                        </ul>
                      </li>
                    </ul>
                  </div>
                  
                  <div>
                    <h4 className="text-lg font-medium text-gray-700 mb-2">使用範例</h4>
                    <div className="bg-gray-50 rounded p-3 text-sm">
                      <div className="mb-2"><strong>取得完整逐字稿:</strong></div>
                      <code className="text-xs">ivod_id: 123456, transcript_type: "auto"</code>
                      
                      <div className="mt-3 mb-2"><strong>僅官方版本:</strong></div>
                      <code className="text-xs">ivod_id: 123456, transcript_type: "ly_only"</code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="bg-blue-50 rounded-lg p-6 mt-8">
            <h2 className="text-2xl font-semibold text-blue-800 mb-4">注意事項與最佳實務</h2>
            
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-blue-700 mb-2">效能建議</h3>
                <ul className="space-y-2 text-blue-700 text-sm">
                  <li>• 使用 <code>transcription_source: "ly_only"</code> 獲得最精確的結果</li>
                  <li>• 搜尋立委發言時建議結合姓名和關鍵字條件</li>
                  <li>• 大量查詢時適當設定 <code>max_results</code> 限制</li>
                  <li>• 利用分頁功能處理大量結果集</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-blue-700 mb-2">資料特性</h3>
                <ul className="space-y-2 text-blue-700 text-sm">
                  <li>• 資料涵蓋台灣立法院各種會議類型</li>
                  <li>• 支援立委姓名、委員會、會議名稱的中文搜尋</li>
                  <li>• 提供搜尋片段和完整逐字稿兩種檢視模式</li>
                  <li>• 自動優先選擇立法院官方逐字稿版本</li>
                </ul>
              </div>
              
              <div>
                <h3 className="text-lg font-medium text-blue-700 mb-2">限制說明</h3>
                <ul className="space-y-2 text-blue-700 text-sm">
                  <li>• 單次搜尋結果上限為 50 筆</li>
                  <li>• 日期格式必須為 YYYY-MM-DD</li>
                  <li>• 部分較舊的會議可能只有 AI 處理版本</li>
                  <li>• 搜尋速度取決於條件複雜度和資料量</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center mt-8 pt-8 border-t border-gray-200">
            <p className="text-gray-500 text-sm">
              如有技術問題或建議，歡迎透過專案 GitHub 頁面回報問題
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export const getServerSideProps: GetServerSideProps = async () => {
  const serverUrl = process.env.SERVER_URL || 'https://example.com';
  const gaId = process.env.GA_MEASUREMENT_ID;
  
  return {
    props: {
      serverUrl,
      ...(gaId && { gaId }),
    },
  };
};

export default MCPGuidePage;