import { searchTranscripts, getMeetingTranscript } from './search';
import { MCPRequest, MCPResponse } from './types';
import { logger } from '@/lib/logger';
import { listResources, readResource } from './resources';
import { listPrompts, getPrompt } from './prompts';
import { listResourceTemplates } from './resource-templates';
import { z, ZodError } from 'zod';
import { JSON_RPC_ERRORS, isValidErrorCode } from './error-codes';

// Zod schemas for tool input validation
const searchTranscriptsSchema = z.object({
  query: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  committees: z.array(z.string()).optional(),
  meeting_name: z.string().optional(),
  mode: z.enum(['keyword_all_fields', 'keyword_transcript_only', 'semantic_search', 'hybrid_search']).default('keyword_transcript_only'),
  transcription_source: z.enum(['all', 'ly_only']).default('all'),
  max_excerpt_length: z.number().min(100).max(3000).default(1200),
  max_context_sentences: z.number().min(0).max(10).default(5),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  max_results: z.number().max(50).default(20),
});

const getMeetingTranscriptSchema = z.object({
  ivod_id: z.number(),
  transcript_type: z.enum(['auto', 'ly_only', 'ai_only']).default('auto'),
});

export class MCPHandler {
  private tools = new Map([
    ['search_transcripts', searchTranscripts],
    ['get_meeting_transcript', getMeetingTranscript]
  ]);

  private toolSchemas: Map<string, z.ZodObject<any>>;

  constructor() {
    this.toolSchemas = new Map();
    this.toolSchemas.set('search_transcripts', searchTranscriptsSchema);
    this.toolSchemas.set('get_meeting_transcript', getMeetingTranscriptSchema);
  }

  async handleRequest(request: MCPRequest): Promise<MCPResponse> {
    // 輸入驗證 - 檢查請求格式
    if (!request || typeof request !== 'object') {
      return this.createErrorResponse(null, -32600, 'Invalid Request: Request must be an object');
    }

    const { jsonrpc, id, method, params } = request;

    // 驗證 JSON-RPC 格式
    if (jsonrpc !== '2.0') {
      return this.createErrorResponse(id, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid Request: jsonrpc must be "2.0"');
    }

    // 驗證 method 參數
    if (!method || typeof method !== 'string') {
      return this.createErrorResponse(id, JSON_RPC_ERRORS.INVALID_REQUEST, 'Invalid Request: method is required and must be a string');
    }

    try {
      switch (method) {
        case 'ping':
          return this.createSuccessResponse(id, {});

        case 'tools/list':
          return this.createSuccessResponse(id, await this.listTools());
          
        case 'tools/call':
          return this.callTool(id, params);
          
        case 'resources/list':
          return this.createSuccessResponse(id, { resources: await listResources() });
          
        case 'resources/read':
          try {
            const resourceContent = await this.readResource(params);
            return this.createSuccessResponse(id, { contents: [resourceContent] });
          } catch (error) {
            if (error instanceof Error && error.message.includes('required')) {
              return this.createErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Invalid params: ' + error.message);
            }
            throw error;
          }
          
        case 'resources/templates/list':
          return this.createSuccessResponse(id, { resourceTemplates: await listResourceTemplates() });

        case 'prompts/list':
          return this.createSuccessResponse(id, { prompts: await listPrompts() });
          
        case 'prompts/get':
          try {
            const promptResult = await this.getPrompt(params);
            return this.createSuccessResponse(id, promptResult);
          } catch (error) {
            if (error instanceof Error && error.message.includes('required')) {
              return this.createErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Invalid params: ' + error.message);
            }
            throw error;
          }
          
        case 'getCapabilities':
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
          return this.createErrorResponse(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, 'Method not found');
      }
    } catch (error) {
      logger.error('MCP request error:', { 
        error: error instanceof Error ? error.message : String(error),
        method: request.method 
      });
      return this.createErrorResponse(id, JSON_RPC_ERRORS.INTERNAL_ERROR, 'Internal error');
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
              committees: { 
                type: 'array', 
                items: { type: 'string' }, 
                description: '委員會列表，例如：["交通委員會", "內政委員會"]' 
              },
              meeting_name: { 
                type: 'string', 
                description: '會議名稱篩選（模糊匹配），例如："院會"、"委員會會議"' 
              },
              mode: {
                type: 'string',
                enum: ['keyword_all_fields', 'keyword_transcript_only', 'semantic_search', 'hybrid_search'],
                default: 'keyword_transcript_only',
                description: '搜尋模式：keyword_all_fields=關鍵字(全部欄位), keyword_transcript_only=關鍵字(僅逐字稿), semantic_search=語意搜尋, hybrid_search=混合搜尋'
              },
              transcription_source: {
                type: 'string',
                enum: ['all', 'ly_only'],
                default: 'all',
                description: '逐字稿來源：all=搜尋所有逐字稿(立法院+AI), ly_only=僅搜尋立法院官方逐字稿'
              },
              max_excerpt_length: { 
                type: 'number', 
                default: 1200, 
                minimum: 100, 
                maximum: 3000,
                description: '段落長度上限（字符數）' 
              },
              max_context_sentences: { 
                type: 'number', 
                default: 5, 
                minimum: 0, 
                maximum: 10,
                description: '上下文句子數量上限' 
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
              max_results: { 
                type: 'number', 
                default: 20, 
                maximum: 50,
                description: '回傳結果數量上限' 
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

  private async callTool(id: string | number, params: any) {
    // 驗證 params 結構
    if (!params || typeof params !== 'object') {
      return this.createErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Invalid params: params must be an object');
    }

    const { name, arguments: args } = params;
    
    // 驗證工具名稱
    if (!name || typeof name !== 'string') {
      return this.createErrorResponse(id, JSON_RPC_ERRORS.INVALID_PARAMS, 'Invalid params: tool name is required and must be a string');
    }

    const tool = this.tools.get(name);
    if (!tool) {
      return this.createErrorResponse(id, JSON_RPC_ERRORS.METHOD_NOT_FOUND, `Method not found: Tool '${name}' does not exist`);
    }

    const schema = this.toolSchemas.get(name);
    if (!schema) {
      // This should not happen if tools and schemas are in sync
      return this.createErrorResponse(id, JSON_RPC_ERRORS.INTERNAL_ERROR, `Internal error: Schema not found for tool '${name}'`);
    }

    // 驗證工具參數
    if (args === undefined || args === null) {
      // 允許空參數，但要確保是有效的空物件
      args = {};
    }

    const validationResult = schema.safeParse(args);

    if (!validationResult.success) {
      const formattedErrors = this.formatZodError(validationResult.error);
      return this.createErrorResponse(
        id, 
        JSON_RPC_ERRORS.INVALID_PARAMS, 
        `Invalid params for tool '${name}'`,
        {
          tool: name,
          validationErrors: formattedErrors,
          receivedParams: args
        }
      );
    }

    try {
      const result = await tool(validationResult.data);
      return this.createSuccessResponse(id, result);
    } catch (error) {
      logger.error('Tool execution error:', { 
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        metadata: {
          tool: name,
          args: validationResult.data
        }
      });
      
      // 提供更詳細的錯誤信息給開發者，但不洩露敏感信息
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      return this.createErrorResponse(
        id, 
        JSON_RPC_ERRORS.INTERNAL_ERROR, 
        `Internal error while executing tool '${name}': ${errorMessage}`
      );
    }
  }

  private async readResource(params: any) {
    // 參數驗證
    if (!params || typeof params !== 'object') {
      throw new Error('Resource params is required and must be an object');
    }

    const { uri } = params;
    
    if (!uri || typeof uri !== 'string') {
      throw new Error('Resource URI is required and must be a string');
    }

    if (uri.trim().length === 0) {
      throw new Error('Resource URI cannot be empty');
    }

    return await readResource(uri);
  }

  private async getPrompt(params: any) {
    // 參數驗證
    if (!params || typeof params !== 'object') {
      throw new Error('Prompt params is required and must be an object');
    }

    const { name, arguments: args } = params;
    
    if (!name || typeof name !== 'string') {
      throw new Error('Prompt name is required and must be a string');
    }

    if (name.trim().length === 0) {
      throw new Error('Prompt name cannot be empty');
    }

    // 驗證 arguments 參數（如果提供）
    if (args !== undefined && (typeof args !== 'object' || args === null || Array.isArray(args))) {
      throw new Error('Prompt arguments must be an object');
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

  private createErrorResponse(id: string | number | null, code: number, message: string, data?: any): MCPResponse {
    // 確保錯誤代碼符合 JSON-RPC 2.0 規範
    if (!isValidErrorCode(code)) {
      logger.warn('Invalid JSON-RPC error code used', { code, message, validRange: '-32768 to -32000' });
      // 使用通用內部錯誤代碼作為後備
      code = JSON_RPC_ERRORS.INTERNAL_ERROR;
    }

    const errorResponse = {
      jsonrpc: '2.0' as const,
      id: id !== null ? id : null,
      error: { 
        code, 
        message,
        ...(data && { data })
      }
    };

    // 記錄錯誤以便監控
    logger.error('MCP Error Response', {
      id,
      code,
      message,
      data: data ? JSON.stringify(data) : undefined
    });

    return errorResponse;
  }

  private formatZodError(error: ZodError): any {
    return error.issues.map(issue => ({
      path: issue.path.join('.'),
      message: issue.message,
      code: issue.code,
    }));
  }
}