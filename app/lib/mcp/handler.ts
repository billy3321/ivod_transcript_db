import { searchTranscripts, getMeetingTranscript } from './simple-tools';
import { MCPRequest, MCPResponse } from './types';
import { logger } from '@/lib/logger';
import { listResources, readResource } from './resources';
import { listPrompts, getPrompt } from './prompts';

export class MCPHandler {
  private tools = new Map([
    ['search_transcripts', searchTranscripts],
    ['get_meeting_transcript', getMeetingTranscript]
  ]);

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    const { jsonrpc, id, method, params } = request;

    // 驗證 JSON-RPC 格式
    if (jsonrpc !== '2.0') {
      return this.createErrorResponse(id, -32600, 'Invalid Request');
    }

    try {
      switch (method) {
        case 'tools/list':
          return this.createSuccessResponse(id, await this.listTools());
          
        case 'tools/call':
          return this.createSuccessResponse(id, await this.callTool(params));
          
        case 'resources/list':
          return this.createSuccessResponse(id, { resources: await listResources() });
          
        case 'resources/read':
          return this.createSuccessResponse(id, await this.readResource(params));
          
        case 'prompts/list':
          return this.createSuccessResponse(id, { prompts: await listPrompts() });
          
        case 'prompts/get':
          return this.createSuccessResponse(id, await this.getPrompt(params));
          
        case 'initialize':
          return this.createSuccessResponse(id, {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
              prompts: {}
            },
            serverInfo: {
              name: 'ivod-transcript-server',
              version: '1.0.0'
            }
          });
          
        default:
          return this.createErrorResponse(id, -32601, 'Method not found');
      }
    } catch (error) {
      logger.error('MCP request error:', { 
        error: error instanceof Error ? error.message : String(error),
        method: request.method 
      });
      return this.createErrorResponse(id, -32603, 'Internal error');
    }
  }

  private async listTools() {
    return {
      tools: [
        {
          name: 'search_transcripts',
          description: '統一的立法院逐字稿搜尋工具，支援所有搜尋模式',
          inputSchema: {
            type: 'object',
            properties: {
              query: { 
                type: 'string', 
                description: '關鍵字搜尋（支援進階語法：引號、AND/OR）' 
              },
              speakers: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: '立委姓名列表，例如：["黃國昌", "王鴻薇"]' 
              },
              topics: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: '話題關鍵字列表，例如：["交通", "內政"]' 
              },
              committees: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: '委員會列表，例如：["交通委員會", "內政委員會"]' 
              },
              search_mode: { 
                type: 'string', 
                enum: ['intersection', 'union'], 
                default: 'union',
                description: '搜尋模式：intersection=交集(AND)，union=聯集(OR)' 
              },
              scope: { 
                type: 'string', 
                enum: ['all', 'transcript_only'], 
                default: 'transcript_only',
                description: '搜尋範圍：all=全部欄位，transcript_only=僅逐字稿' 
              },
              excerpt_length: { 
                type: 'number', 
                default: 800, 
                minimum: 200, 
                maximum: 2000,
                description: '段落長度（字符數）' 
              },
              context_sentences: { 
                type: 'number', 
                default: 3, 
                minimum: 1, 
                maximum: 10,
                description: '上下文句子數量' 
              },
              date_from: { 
                type: 'string', 
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: '搜尋起始日期 (YYYY-MM-DD)' 
              },
              date_to: { 
                type: 'string', 
                pattern: '^\\d{4}-\\d{2}-\\d{2}$',
                description: '搜尋結束日期 (YYYY-MM-DD)' 
              },
              limit: { 
                type: 'number', 
                default: 20, 
                maximum: 100,
                description: '回傳結果數量限制' 
              }
            }
          }
        },
        {
          name: 'get_meeting_transcript',
          description: '取得特定會議的完整逐字稿內容',
          inputSchema: {
            type: 'object',
            properties: {
              ivod_id: { 
                type: 'number', 
                description: 'IVOD 會議唯一識別碼' 
              },
              transcript_type: { 
                type: 'string', 
                enum: ['auto', 'ly_only', 'ai_only'], 
                default: 'auto',
                description: '逐字稿類型：auto=自動選擇，ly_only=僅立院版，ai_only=僅AI版' 
              }
            },
            required: ['ivod_id']
          }
        }
      ]
    };
  }

  private async callTool(params: { name: string; arguments: any }) {
    const { name, arguments: args } = params;
    
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool '${name}' not found`);
    }

    return await tool(args);
  }

  private async readResource(params: { uri?: string }) {
    const { uri } = params;
    
    if (!uri) {
      throw new Error('Resource URI is required');
    }

    return await readResource(uri);
  }

  private async getPrompt(params: { name?: string; arguments?: Record<string, string> }) {
    const { name, arguments: args } = params;
    
    if (!name) {
      throw new Error('Prompt name is required');
    }

    return await getPrompt(name, args);
  }

  private createSuccessResponse(id: string | number, result: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  private createErrorResponse(id: string | number, code: number, message: string, data?: any): MCPResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data }
    };
  }
}