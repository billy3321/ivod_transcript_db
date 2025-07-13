
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import mcpHandler from '@/pages/api/mcp';

// Helper to invoke the MCP handler with a mocked request
const invokeMCP = async (method: string, params: any = {}) => {
  const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    },
  });

  await mcpHandler(req, res);

  expect(res._getStatusCode()).toBe(200);
  return res._getJSONData();
};

// Helper to extract text content from a tool call response
const getResultText = (response: any) => {
  if (response.result?.content?.[0]?.text) {
    return JSON.parse(response.result.content[0].text);
  }
  return null;
};

describe('MCP Integration Tests (node-mocks-http)', () => {
  describe('Basic MCP Methods', () => {
    it('should respond to tools/list and return at least two tools', async () => {
      const response = await invokeMCP('tools/list');
      expect(response.result).toBeDefined();
      expect(response.result.tools).toBeInstanceOf(Array);
      expect(response.result.tools.length).toBeGreaterThanOrEqual(2);

      const toolNames = response.result.tools.map((t: any) => t.name);
      expect(toolNames).toContain('search_transcripts');
      expect(toolNames).toContain('get_meeting_transcript');
    });

    it('should respond to initialize', async () => {
      const response = await invokeMCP('initialize');
      expect(response.result).toBeDefined();
      expect(response.result.serverInfo.name).toBe('ivod-transcript-server');
    });
  });

  describe('search_transcripts Tool', () => {
    it('should handle a basic keyword search', async () => {
      const response = await invokeMCP('tools/call', {
        name: 'search_transcripts',
        arguments: { query: '預算', limit: 3 },
      });
      const result = getResultText(response);
      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThanOrEqual(0);
      expect(result.results.length).toBeLessThanOrEqual(3);
    });

    it('should handle a speaker search', async () => {
      const response = await invokeMCP('tools/call', {
        name: 'search_transcripts',
        arguments: { speakers: ['黃國昌'], limit: 2 },
      });
      const result = getResultText(response);
      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThanOrEqual(0);
      result.results.forEach((r: any) => {
        expect(r.speaker_name).toContain('黃國昌');
      });
    });

    it('should handle advanced search with quoted phrases', async () => {
      const response = await invokeMCP('tools/call', {
        name: 'search_transcripts',
        arguments: { query: '"社會福利"', limit: 2 },
      });
      const result = getResultText(response);
      expect(result).toBeDefined();
      expect(result.results).toBeInstanceOf(Array);
      expect(result.results.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('get_meeting_transcript Tool', () => {
    let validIvodId: number | undefined;

    beforeAll(async () => {
      const response = await invokeMCP('tools/call', {
        name: 'search_transcripts',
        arguments: { query: '委員會', limit: 1 },
      });
      const result = getResultText(response);
      if (result && result.results && result.results.length > 0) {
        validIvodId = result.results[0].ivod_id;
      } else {
        console.warn(
          'Could not find a valid ivod_id for testing. Skipping get_meeting_transcript tests.'
        );
      }
    });

    // Use it.skip if we don't have a valid ID to test with
    const itif = (condition: any) => (condition ? it : it.skip);

    itif(validIvodId)('should retrieve a full transcript with a valid ID', async () => {
      const response = await invokeMCP('tools/call', {
        name: 'get_meeting_transcript',
        arguments: { ivod_id: validIvodId },
      });
      const result = getResultText(response);
      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.result.ivod_id).toBe(validIvodId);
      expect(result.result.transcript.content.length).toBeGreaterThan(100);
    });

    itif(validIvodId)('should return an error for an invalid ID', async () => {
      const response = await invokeMCP('tools/call', {
        name: 'get_meeting_transcript',
        arguments: { ivod_id: 99999999 },
      });
      const result = getResultText(response);
      expect(result).toBeDefined();
      expect(result.success).toBe(false);
      expect(result.error).toContain('No transcript found');
    });
  });
});
