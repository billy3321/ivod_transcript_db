import { MCPHandler } from '@/lib/mcp/handler';
import { MCPRequest } from '@/lib/mcp/types';

// Mock dependencies
jest.mock('@/lib/mcp/search', () => ({
  searchTranscripts: jest.fn(),
  getMeetingTranscript: jest.fn()
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('MCP Resources Comprehensive Tests', () => {
  let handler: MCPHandler;

  beforeEach(() => {
    handler = new MCPHandler();
    jest.clearAllMocks();
  });

  describe('resources/list endpoint', () => {
    it('should return list of available resources', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list'
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.resources).toBeInstanceOf(Array);
      expect(response.result.resources.length).toBeGreaterThan(0);

      // Check that each resource has required fields
      response.result.resources.forEach((resource: any) => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('title');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        expect(typeof resource.uri).toBe('string');
        expect(typeof resource.name).toBe('string');
        expect(typeof resource.title).toBe('string');
        expect(typeof resource.description).toBe('string');
        expect(typeof resource.mimeType).toBe('string');
      });
    });

    it('should include IVOD-specific resources', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list'
      };

      const response = await handler.handleRequest(request);
      const resourceUris = response.result.resources.map((r: any) => r.uri);

      // Check for expected IVOD-related resources
      expect(resourceUris).toContain('ivod://usage-guide');
      expect(resourceUris).toContain('ivod://api-reference');
      expect(resourceUris).toContain('ivod://search-examples');
      expect(resourceUris).toContain('ivod://data-structure');
      expect(resourceUris).toContain('ivod://best-practices');
    });

    it('should provide resources with correct MIME types', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/list'
      };

      const response = await handler.handleRequest(request);
      
      response.result.resources.forEach((resource: any) => {
        expect(['text/markdown', 'text/plain', 'application/json']).toContain(resource.mimeType);
      });
    });
  });

  describe('resources/read endpoint', () => {
    it('should return resource content for valid URI', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'ivod://usage-guide'
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.contents).toBeInstanceOf(Array);
      expect(response.result.contents.length).toBe(1);

      const content = response.result.contents[0];
      expect(content).toHaveProperty('uri');
      expect(content).toHaveProperty('mimeType');
      expect(content).toHaveProperty('text');
      expect(content.uri).toBe('ivod://usage-guide');
      expect(typeof content.text).toBe('string');
      expect(content.text.length).toBeGreaterThan(0);
    });

    it('should handle all documented resource URIs', async () => {
      const resourceUris = [
        'ivod://usage-guide',
        'ivod://api-reference', 
        'ivod://search-examples',
        'ivod://data-structure',
        'ivod://best-practices'
      ];

      for (const uri of resourceUris) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'resources/read',
          params: { uri }
        };

        const response = await handler.handleRequest(request);

        expect(response.result).toBeDefined();
        expect(response.result.contents).toBeInstanceOf(Array);
        expect(response.result.contents.length).toBe(1);
        
        const content = response.result.contents[0];
        expect(content.uri).toBe(uri);
        expect(content.text).toBeDefined();
        expect(typeof content.text).toBe('string');
        expect(content.text.length).toBeGreaterThan(50); // Should have meaningful content
      }
    });

    it('should return error for invalid URI', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'ivod://nonexistent-resource'
        }
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.error).toBeDefined();
      expect([-32602, -32603]).toContain(response.error?.code);
    });

    it('should validate URI parameter', async () => {
      const invalidRequests = [
        // Missing URI
        {
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: {}
        },
        // Empty URI
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'resources/read',
          params: { uri: '' }
        },
        // Invalid URI type
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'resources/read',
          params: { uri: 123 }
        }
      ];

      for (const request of invalidRequests) {
        const response = await handler.handleRequest(request as MCPRequest);
        
        expect(response.error).toBeDefined();
        expect([-32602, -32603]).toContain(response.error?.code);
      }
    });
  });

  describe('resources/templates/list endpoint', () => {
    it('should return list of resource templates', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/templates/list'
      };

      const response = await handler.handleRequest(request);

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
      expect(response.result.resourceTemplates).toBeInstanceOf(Array);
      expect(response.result.resourceTemplates.length).toBeGreaterThan(0);

      // Check that each template has required fields
      response.result.resourceTemplates.forEach((template: any) => {
        expect(template).toHaveProperty('uriTemplate');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('title');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('mimeType');
        expect(typeof template.uriTemplate).toBe('string');
        expect(typeof template.name).toBe('string');
        expect(typeof template.title).toBe('string');
        expect(typeof template.description).toBe('string');
        expect(typeof template.mimeType).toBe('string');
      });
    });

    it('should include IVOD-specific templates', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/templates/list'
      };

      const response = await handler.handleRequest(request);
      const templateUris = response.result.resourceTemplates.map((t: any) => t.uriTemplate);

      // Check for expected IVOD-related templates
      expect(templateUris).toContain('ivod://search/topic/{query}');
      expect(templateUris).toContain('ivod://search/legislator/{name}');
      expect(templateUris).toContain('ivod://search/meeting/{meeting_name}');
      expect(templateUris).toContain('ivod://search/committee/{committee}');
      expect(templateUris).toContain('ivod://transcript/full/{ivod_id}');
    });

    it('should provide templates with proper URI patterns', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/templates/list'
      };

      const response = await handler.handleRequest(request);
      
      response.result.resourceTemplates.forEach((template: any) => {
        // URI templates should contain variable placeholders
        expect(template.uriTemplate).toMatch(/\{[^}]+\}/);
        // Should start with ivod:// scheme
        expect(template.uriTemplate).toMatch(/^ivod:\/\//);
      });
    });
  });

  describe('Resource Content Quality', () => {
    it('should provide comprehensive usage guide content', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'ivod://usage-guide'
        }
      };

      const response = await handler.handleRequest(request);

      if (!response.error) {
        const content = response.result.contents[0].text;
        
        // Should contain key information about IVOD
        expect(content).toMatch(/立法院|IVOD|逐字稿|搜尋/);
        expect(content).toMatch(/search_transcripts|get_meeting_transcript/);
        
        // Should be well-formatted markdown
        expect(content).toContain('#');
        expect(content.length).toBeGreaterThan(400);
      }
    });

    it('should provide API reference with examples', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: {
          uri: 'ivod://api-reference'
        }
      };

      const response = await handler.handleRequest(request);

      if (!response.error) {
        const content = response.result.contents[0].text;
        
        // Should contain API documentation
        expect(content).toMatch(/API|tools|methods/i);
        expect(content).toMatch(/search_transcripts|get_meeting_transcript/);
        
        // Should contain API documentation  
        expect(content).toMatch(/API|參數|parameter/i);
      }
    });

    it('should provide different content for different resources', async () => {
      const resources = ['ivod://usage-guide', 'ivod://api-reference', 'ivod://search-examples'];
      const contents: string[] = [];

      for (const uri of resources) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: 1,
          method: 'resources/read',
          params: { uri }
        };

        const response = await handler.handleRequest(request);
        
        if (!response.error) {
          const text = response.result.contents[0].text;
          contents.push(text);
        }
      }

      // Each resource should provide different content
      expect(contents.length).toBeGreaterThan(1);
      
      for (let i = 0; i < contents.length - 1; i++) {
        for (let j = i + 1; j < contents.length; j++) {
          expect(contents[i]).not.toBe(contents[j]);
        }
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle missing params object for resources/read', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read'
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
      expect(response.error?.message).toContain('Invalid params');
    });

    it('should handle null params for resources/read', async () => {
      const request: MCPRequest = {
        jsonrpc: '2.0',
        id: 1,
        method: 'resources/read',
        params: null as any
      };

      const response = await handler.handleRequest(request);

      expect(response.error).toBeDefined();
      expect(response.error?.code).toBe(-32602);
    });

    it('should handle malformed URI schemes', async () => {
      const malformedUris = [
        'http://example.com',
        'file:///path/to/file',
        'invalid-uri',
        'ivod:/missing-slash',
        'not-ivod://something'
      ];

      for (const uri of malformedUris) {
        const request: MCPRequest = {
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'resources/read',
          params: { uri }
        };

        const response = await handler.handleRequest(request);
        
        expect(response.error).toBeDefined();
        expect([-32602, -32603]).toContain(response.error?.code);
      }
    });
  });
});