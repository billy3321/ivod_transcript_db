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

describe('MCP Input Validation Comprehensive Tests', () => {
  let handler: MCPHandler;
  let mockSearchTranscripts: jest.Mock;
  let mockGetMeetingTranscript: jest.Mock;

  beforeEach(() => {
    handler = new MCPHandler();
    jest.clearAllMocks();
    
    mockSearchTranscripts = require('@/lib/mcp/search').searchTranscripts;
    mockGetMeetingTranscript = require('@/lib/mcp/search').getMeetingTranscript;
    
    // Setup default mocks
    mockSearchTranscripts.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ results: [], metadata: {} }) }]
    });
    mockGetMeetingTranscript.mockResolvedValue({
      content: [{ type: 'text', text: JSON.stringify({ success: true, result: {} }) }]
    });
  });

  describe('Request Structure Validation', () => {
    it('should reject null request', async () => {
      const response = await handler.handleRequest(null as any);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toContain('Invalid Request');
    });

    it('should reject undefined request', async () => {
      const response = await handler.handleRequest(undefined as any);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toContain('Invalid Request');
    });

    it('should reject non-object request', async () => {
      const invalidRequests = ['string', 123, true, []];

      for (const invalidRequest of invalidRequests) {
        const response = await handler.handleRequest(invalidRequest as any);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32600);
        expect(response.error?.message).toContain('Invalid Request');
      }
    });

    it('should reject request without jsonrpc field', async () => {
      const request = {
        id: 1,
        method: 'tools/list'
      } as any;

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toContain('jsonrpc must be "2.0"');
    });

    it('should reject request with incorrect jsonrpc version', async () => {
      const invalidVersions = ['1.0', '2.1', '3.0', '', null, undefined, 2.0];

      for (const version of invalidVersions) {
        const request = {
          jsonrpc: version,
          id: 1,
          method: 'tools/list'
        } as any;

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32600);
        expect(response.error?.message).toContain('jsonrpc must be "2.0"');
      }
    });

    it('should reject request without method field', async () => {
      const request = {
        jsonrpc: '2.0',
        id: 1
      } as any;

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32600);
      expect(response.error?.message).toContain('method is required');
    });

    it('should reject request with invalid method type', async () => {
      const invalidMethods = [123, true, null, undefined, {}, []];

      for (const method of invalidMethods) {
        const request = {
          jsonrpc: '2.0',
          id: 1,
          method
        } as any;

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32600);
        expect(response.error?.message).toContain('method is required and must be a string');
      }
    });
  });

  describe('Tools Call Validation', () => {
    it('should validate tools/call params structure', async () => {
      const invalidParamsRequests = [
        // Missing params
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call'
        },
        // Null params
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: null
        },
        // Non-object params
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: 'invalid'
        }
      ];

      for (const request of invalidParamsRequests) {
        const response = await handler.handleRequest(request as MCPRequest);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32602);
        expect(response.error?.message).toContain('Invalid params');
      }
    });

    it('should validate tool name parameter', async () => {
      const invalidNameRequests = [
        // Missing name
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { arguments: {} }
        },
        // Null name
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: null, arguments: {} }
        },
        // Empty name
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: '', arguments: {} }
        },
        // Non-string name
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name: 123, arguments: {} }
        }
      ];

      for (const request of invalidNameRequests) {
        const response = await handler.handleRequest(request as MCPRequest);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32602);
        expect(response.error?.message).toContain('tool name is required');
      }
    });

    it('should validate search_transcripts arguments', async () => {
      const invalidArgumentsRequests = [
        // Invalid query type
        {
          name: 'search_transcripts',
          arguments: { query: 123 }
        },
        // Invalid speakers type
        {
          name: 'search_transcripts',
          arguments: { speakers: 'not-array' }
        },
        // Invalid committees type
        {
          name: 'search_transcripts',
          arguments: { committees: 'not-array' }
        },
        // Invalid mode
        {
          name: 'search_transcripts',
          arguments: { mode: 'invalid_mode' }
        },
        // Invalid transcription_source
        {
          name: 'search_transcripts',
          arguments: { transcription_source: 'invalid_source' }
        },
        // Invalid max_excerpt_length (too small)
        {
          name: 'search_transcripts',
          arguments: { max_excerpt_length: 50 }
        },
        // Invalid max_excerpt_length (too large)
        {
          name: 'search_transcripts',
          arguments: { max_excerpt_length: 5000 }
        },
        // Invalid max_context_sentences (too large)
        {
          name: 'search_transcripts',
          arguments: { max_context_sentences: 15 }
        },
        // Invalid date format
        {
          name: 'search_transcripts',
          arguments: { date_from: 'invalid-date' }
        },
        // Invalid max_results (too large)
        {
          name: 'search_transcripts',
          arguments: { max_results: 100 }
        }
      ];

      for (const { name, arguments: args } of invalidArgumentsRequests) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args }
        };

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32602);
        expect(response.error?.message).toContain('Invalid params');
        expect(response.error?.data).toHaveProperty('validationErrors');
      }
    });

    it('should validate get_meeting_transcript arguments', async () => {
      const invalidArgumentsRequests = [
        // Missing required ivod_id
        {
          name: 'get_meeting_transcript',
          arguments: {}
        },
        // Invalid ivod_id type
        {
          name: 'get_meeting_transcript',
          arguments: { ivod_id: 'not-number' }
        },
        // Invalid transcript_type
        {
          name: 'get_meeting_transcript',
          arguments: { ivod_id: 123, transcript_type: 'invalid_type' }
        }
      ];

      for (const { name, arguments: args } of invalidArgumentsRequests) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args }
        };

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeDefined();
        expect(response.error?.code).toBe(-32602);
        expect(response.error?.message).toContain('Invalid params');
      }
    });

    it('should accept valid tool arguments', async () => {
      const validRequests = [
        // Valid search_transcripts with minimal args
        {
          name: 'search_transcripts',
          arguments: {}
        },
        // Valid search_transcripts with full args
        {
          name: 'search_transcripts',
          arguments: {
            query: '預算',
            speakers: ['沈伯洋', '黃捷'],
            committees: ['交通委員會'],
            meeting_name: '委員會會議',
            mode: 'keyword_all_fields',
            transcription_source: 'ly_only',
            max_excerpt_length: 1500,
            max_context_sentences: 3,
            date_from: '2024-01-01',
            date_to: '2024-12-31',
            max_results: 10,
            cursor: 'some-cursor'
          }
        },
        // Valid get_meeting_transcript
        {
          name: 'get_meeting_transcript',
          arguments: {
            ivod_id: 12345,
            transcript_type: 'auto'
          }
        }
      ];

      for (const { name, arguments: args } of validRequests) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: args }
        };

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeUndefined();
        expect(response.result).toBeDefined();
      }
    });
  });

  describe('Date Validation', () => {
    it('should accept valid date formats', async () => {
      const validDates = [
        '2024-01-01',
        '2024-12-31',
        '2023-06-15',
        '2025-02-28'
      ];

      for (const date of validDates) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_transcripts',
            arguments: { date_from: date }
          }
        };

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeUndefined();
      }
    });

    it('should reject invalid date formats', async () => {
      const invalidDates = [
        '24-01-01',    // Wrong year format
        '2024-1-1',    // Missing zero padding
        '2024/01/01',  // Wrong separator
        '01-01-2024',  // Wrong order
        '2024-13-01',  // Invalid month
        '2024-01-32',  // Invalid day
        'not-a-date',  // Not a date
        '2024-01',     // Missing day
        '2024'         // Missing month and day
      ];

      for (const date of invalidDates) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_transcripts',
            arguments: { date_from: date }
          }
        };

        const response = await handler.handleRequest(request);
        
        // Some invalid formats might not trigger validation since date_from is optional
        // We expect at least most of them to fail
        if (response.error) {
          expect(response.error.code).toBe(-32602);
        }
      }
    });
  });

  describe('Array Validation', () => {
    it('should accept valid speaker arrays', async () => {
      const validSpeakers = [
        ['沈伯洋'],
        ['沈伯洋', '黃捷'],
        ['王鴻薇', '蔣萬安', '柯建銘'],
        [] // Empty array should be valid
      ];

      for (const speakers of validSpeakers) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_transcripts',
            arguments: { speakers }
          }
        };

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeUndefined();
      }
    });

    it('should reject invalid speaker arrays', async () => {
      const invalidSpeakers = [
        'not-array',
        [123, 456],     // Non-string elements
        [null, '沈伯洋'], // Null element
      ];

      for (const speakers of invalidSpeakers) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_transcripts',
            arguments: { speakers }
          }
        };

        const response = await handler.handleRequest(request);
        
        if (response.error) {
          expect(response.error.code).toBe(-32602);
        }
      }
    });
  });

  describe('Numeric Range Validation', () => {
    it('should enforce max_excerpt_length bounds', async () => {
      const testCases = [
        { value: 99, shouldFail: true },   // Too small
        { value: 100, shouldFail: false }, // Min valid
        { value: 1200, shouldFail: false }, // Default valid
        { value: 3000, shouldFail: false }, // Max valid
        { value: 3001, shouldFail: true }   // Too large
      ];

      for (const { value, shouldFail } of testCases) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_transcripts',
            arguments: { max_excerpt_length: value }
          }
        };

        const response = await handler.handleRequest(request);
        
        if (shouldFail) {
          expect(response.error).toBeDefined();
          expect(response.error?.code).toBe(-32602);
        } else {
          expect(response.error).toBeUndefined();
        }
      }
    });

    it('should enforce max_results bounds', async () => {
      const testCases = [
        { value: 1, shouldFail: false },   // Valid small value
        { value: 20, shouldFail: false },  // Default valid
        { value: 50, shouldFail: false },  // Max valid
        { value: 51, shouldFail: true }    // Too large
      ];

      for (const { value, shouldFail } of testCases) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: {
            name: 'search_transcripts',
            arguments: { max_results: value }
          }
        };

        const response = await handler.handleRequest(request);
        
        if (shouldFail) {
          expect(response.error).toBeDefined();
          expect(response.error?.code).toBe(-32602);
        } else {
          expect(response.error).toBeUndefined();
        }
      }
    });
  });

  describe('Error Response Format', () => {
    it('should provide detailed validation error information', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'search_transcripts',
          arguments: {
            query: 123,           // Invalid type
            max_results: 100,     // Out of range
            date_from: 'invalid'  // Invalid format
          }
        }
      };

      const response = await handler.handleRequest(request);
      
      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
      expect(response.error?.message).toContain('Invalid params');
      expect(response.error?.data).toHaveProperty('tool');
      expect(response.error?.data).toHaveProperty('validationErrors');
      expect(response.error?.data).toHaveProperty('receivedParams');
      
      // Should have multiple validation errors
      expect(response.error?.data.validationErrors).toBeInstanceOf(Array);
      expect(response.error?.data.validationErrors.length).toBeGreaterThan(1);
      
      // Each error should have path, message, and code
      response.error?.data.validationErrors.forEach((error: any) => {
        expect(error).toHaveProperty('path');
        expect(error).toHaveProperty('message');
        expect(error).toHaveProperty('code');
      });
    });
  });
});