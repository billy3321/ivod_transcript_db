import { MCPHandler } from '@/lib/mcp/handler';
import { MCPRequest } from '@/lib/mcp/types';

// Mock dependencies
jest.mock('@/lib/mcp/search', () => ({
  searchTranscripts: jest.fn(),
  getMeetingTranscript: jest.fn()
}));

jest.mock('@/lib/mcp/resources', () => ({
  listResources: jest.fn(),
  readResource: jest.fn()
}));

jest.mock('@/lib/mcp/prompts', () => ({
  listPrompts: jest.fn(),
  getPrompt: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('MCPHandler Comprehensive Tests', () => {
  let handler: MCPHandler;
  let mockSearchTranscripts: jest.Mock;
  let mockGetMeetingTranscript: jest.Mock;
  let mockListResources: jest.Mock;
  let mockReadResource: jest.Mock;
  let mockListPrompts: jest.Mock;
  let mockGetPrompt: jest.Mock;

  beforeEach(() => {
    handler = new MCPHandler();
    jest.clearAllMocks();
    
    mockSearchTranscripts = require('@/lib/mcp/search').searchTranscripts;
    mockGetMeetingTranscript = require('@/lib/mcp/search').getMeetingTranscript;
    mockListResources = require('@/lib/mcp/resources').listResources;
    mockReadResource = require('@/lib/mcp/resources').readResource;
    mockListPrompts = require('@/lib/mcp/prompts').listPrompts;
    mockGetPrompt = require('@/lib/mcp/prompts').getPrompt;
  });

  describe('Basic Protocol Compliance', () => {
    it('should handle initialize request', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test-client', version: '1.0.0' }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {
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
        }
      });
    });

    it('should handle ping request', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping'
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        result: {}
      });
    });

    it('should return error for invalid JSON-RPC version', async () => {
      const request: MCPRequest = {
        jsonrpc: '1.0' as any,
        id: 1,
        method: 'initialize'
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request'
        }
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
  });

  describe('Tools Management', () => {
    it('should list available tools', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result.tools).toHaveLength(2);
      
      const toolNames = response.result.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('search_transcripts');
      expect(toolNames).toContain('get_meeting_transcript');
    });

    it('should call search_transcripts tool with array parameters', async () => {
      const mockResult = {
        content: [{
          type: 'text',
          text: JSON.stringify({ results: [], metadata: { success: true } })
        }]
      };
      mockSearchTranscripts.mockResolvedValue(mockResult);

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
      expect(response.result).toEqual(mockResult);
      expect(mockSearchTranscripts).toHaveBeenCalledWith({
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

    it('should call get_meeting_transcript tool', async () => {
      const mockResult = {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, result: { ivod_id: 123 } })
        }]
      };
      mockGetMeetingTranscript.mockResolvedValue(mockResult);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'get_meeting_transcript',
          arguments: {
            ivod_id: 123456
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.result).toEqual(mockResult);
      expect(mockGetMeetingTranscript).toHaveBeenCalledWith({
        ivod_id: 123456,
        transcript_type: 'auto'
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

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32601,
          message: "Tool 'unknown_tool' not found"
        }
      });
    });
  });

  describe('Resources Management', () => {
    it('should list available resources', async () => {
      const mockResources = [
        {
          uri: 'ivod://usage-guide',
          name: 'IVOD 搜尋使用指南',
          description: '詳細說明如何使用 IVOD 逐字稿搜尋功能的完整指南',
          mimeType: 'text/markdown'
        }
      ];
      mockListResources.mockResolvedValue(mockResources);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list'
      };

      const response = await handler.handleRequest(request);

      expect(response.result).toEqual({ resources: mockResources });
      expect(mockListResources).toHaveBeenCalled();
    });

    it('should read resource content', async () => {
      const mockContent = {
        uri: 'ivod://usage-guide',
        mimeType: 'text/markdown',
        text: '# IVOD 搜尋使用指南\n\n內容...'
      };
      mockReadResource.mockResolvedValue(mockContent);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'ivod://usage-guide'
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.result).toEqual({ contents: [mockContent] });
      expect(mockReadResource).toHaveBeenCalledWith('ivod://usage-guide');
    });
  });

  describe('Prompts Management', () => {
    it('should list available prompts', async () => {
      const mockPrompts = [
        {
          name: 'analyze-legislator-performance',
          description: '分析特定立委的發言和關注議題',
          arguments: [
            {
              name: 'legislator_name',
              description: '立委姓名',
              required: true
            }
          ]
        }
      ];
      mockListPrompts.mockResolvedValue(mockPrompts);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/list'
      };

      const response = await handler.handleRequest(request);

      expect(response.result).toEqual({ prompts: mockPrompts });
      expect(mockListPrompts).toHaveBeenCalled();
    });

    it('should get prompt content', async () => {
      const mockPrompt = {
        name: 'analyze-legislator-performance',
        description: '分析特定立委的發言和關注議題',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: '請分析沈伯洋委員的表現...'
            }
          }
        ]
      };
      mockGetPrompt.mockResolvedValue(mockPrompt);

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'prompts/get',
        params: {
          name: 'analyze-legislator-performance',
          arguments: {
            legislator_name: '沈伯洋'
          }
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.result).toEqual(mockPrompt);
      expect(mockGetPrompt).toHaveBeenCalledWith(
        'analyze-legislator-performance',
        {
          legislator_name: '沈伯洋'
        }
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle tool execution errors', async () => {
      mockSearchTranscripts.mockRejectedValue(new Error('Tool execution failed'));

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_transcripts',
          arguments: {}
        }
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: 'Tool execution failed'
        }
      });
    });

    it('should handle resource read errors', async () => {
      mockReadResource.mockRejectedValue(new Error('Resource not found'));

      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'ivod://nonexistent'
        }
      };

      const response = await handler.handleRequest(request);

      expect(response).toEqual({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: -32603,
          message: 'Internal error'
        }
      });
    });

    it('should handle missing request ID', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        method: 'ping'
      };

      const response = await handler.handleRequest(request);

      expect(response.id).toBeUndefined();
      expect(response.result).toEqual({});
    });
  });

  describe('Edge Cases', () => {
    it('should handle malformed params', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_transcripts'
          // missing arguments
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error.code).toBe(-32602);
    });

    it('should handle null params', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: null
      };

      const response = await handler.handleRequest(request);

      expect(response.result).toBeDefined();
      expect(response.result.serverInfo.name).toBe('ivod-transcript-server');
    });
  });
});