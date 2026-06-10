import { MCPHandler } from '@/lib/mcp/handler';
import { MCPRequest } from '@/lib/mcp/types';

// Mock the simple tools
jest.mock('@/lib/mcp/search', () => ({
  searchTranscripts: jest.fn(),
  getMeetingTranscript: jest.fn()
}));

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('MCPHandler', () => {
  let handler: MCPHandler;

  beforeEach(() => {
    handler = new MCPHandler();
    jest.clearAllMocks();
  });

  describe('handleRequest', () => {
    it('should return error for invalid JSON-RPC version', async () => {
      const request: MCPRequest = {
        jsonrpc: '1.0',
        id: 1,
        method: 'tools/list'
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request: jsonrpc must be "2.0"'
        }
      });
    });

    it('should handle tools/list method', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools).toHaveLength(2);
      
      // 檢查搜尋工具
      const searchTool = response.result.tools.find((tool: any) => tool.name === 'search_transcripts');
      expect(searchTool).toBeDefined();
      expect(searchTool.description).toContain('統一的立法院逐字稿搜尋工具');
      
      // 檢查取得逐字稿工具
      const getTranscriptTool = response.result.tools.find((tool: any) => tool.name === 'get_meeting_transcript');
      expect(getTranscriptTool).toBeDefined();
      expect(getTranscriptTool.description).toContain('取得特定會議的完整逐字稿內容');
    });

    it('should handle initialize method', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize'
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {},
            resources: {},
            prompts: {},
            logging: {}
          },
          serverInfo: {
            name: 'ivod-transcript-server',
            version: '1.0.0'
          }
        }
      });
    });

    it('should handle tools/call method', async () => {
      const mockSearchResult = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: [],
              metadata: { success: true }
            })
          }
        ]
      };

      const { searchTranscripts } = require('@/lib/mcp/search');
      searchTranscripts.mockResolvedValue(mockSearchResult);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_transcripts',
          arguments: {
            query: '測試查詢'
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toEqual(mockSearchResult);
      expect(searchTranscripts).toHaveBeenCalledWith({
        query: '測試查詢',
        mode: 'keyword_transcript_only',
        transcription_source: 'all',
        max_excerpt_length: 1200,
        max_context_sentences: 5,
        max_results: 20
      });
    });

    it('should handle tools/call method with array parameters', async () => {
      const mockSearchResult = {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              results: [],
              metadata: { success: true }
            })
          }
        ]
      };

      const { searchTranscripts } = require('@/lib/mcp/search');
      searchTranscripts.mockResolvedValue(mockSearchResult);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_transcripts',
          arguments: {
            query: '測試查詢',
            speakers: ['沈伯洋', '黃捷'],
            committees: ['交通委員會']
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toEqual(mockSearchResult);
      expect(searchTranscripts).toHaveBeenCalledWith({
        query: '測試查詢',
        speakers: ['沈伯洋', '黃捷'],
        committees: ['交通委員會'],
        mode: 'keyword_transcript_only',
        transcription_source: 'all',
        max_excerpt_length: 1200,
        max_context_sentences: 5,
        max_results: 20
      });
    });

    it('should return error for unknown method', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'unknown_method'
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: 'Method not found'
        }
      });
    });

    it('should return error for unknown tool', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32601);
      expect(response.error?.message).toBe("Method not found: Tool 'unknown_tool' does not exist");
    });

    it('should handle errors gracefully', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_transcripts',
          arguments: {}
        }
      };

      const { searchTranscripts } = require('@/lib/mcp/search');
      searchTranscripts.mockRejectedValue(new Error('Tool execution error'));

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32603);
      // 對外不洩露內部錯誤細節，只回泛用訊息
      expect(response.error?.message).toBe('Internal error while executing tool \'search_transcripts\'');
    });
  });

  describe('Input Schema Validation', () => {
    it('should provide correct search_transcripts schema', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      const response = await handler.handleRequest(request);
      const searchTool = response.result.tools.find((tool: any) => tool.name === 'search_transcripts');
      
      expect(searchTool.inputSchema.properties).toHaveProperty('query');
      expect(searchTool.inputSchema.properties).toHaveProperty('speakers');
      expect(searchTool.inputSchema.properties.speakers.type).toBe('array');
      expect(searchTool.inputSchema.properties).toHaveProperty('committees');
      expect(searchTool.inputSchema.properties.committees.type).toBe('array');
      expect(searchTool.inputSchema.properties).toHaveProperty('meeting_name');
      expect(searchTool.inputSchema.properties).toHaveProperty('date_from');
      expect(searchTool.inputSchema.properties).toHaveProperty('date_to');
      expect(searchTool.inputSchema.properties).toHaveProperty('max_results');
      expect(searchTool.inputSchema.properties).toHaveProperty('mode');
      expect(searchTool.inputSchema.properties).toHaveProperty('transcription_source');
      expect(searchTool.inputSchema.properties).toHaveProperty('max_excerpt_length');
      expect(searchTool.inputSchema.properties).toHaveProperty('max_context_sentences');
      
      // 檢查預設值
      expect(searchTool.inputSchema.properties.max_results.default).toBe(20);
      expect(searchTool.inputSchema.properties.mode.default).toBe('keyword_transcript_only');
      expect(searchTool.inputSchema.properties.transcription_source.default).toBe('all');
      expect(searchTool.inputSchema.properties.max_excerpt_length.default).toBe(1200);
      expect(searchTool.inputSchema.properties.max_context_sentences.default).toBe(5);
    });

    it('should provide correct get_meeting_transcript schema', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      const response = await handler.handleRequest(request);
      const getTranscriptTool = response.result.tools.find((tool: any) => tool.name === 'get_meeting_transcript');
      
      expect(getTranscriptTool.inputSchema.properties).toHaveProperty('ivod_id');
      expect(getTranscriptTool.inputSchema.properties).toHaveProperty('transcript_type');
      expect(getTranscriptTool.inputSchema.required).toEqual(['ivod_id']);
      expect(getTranscriptTool.inputSchema.properties.transcript_type.default).toBe('auto');
    });
  });
});