import { createMocks } from 'node-mocks-http';
import handler from '@/pages/api/mcp';

// Mock the MCP handler
jest.mock('@/lib/mcp/handler', () => {
  return {
    MCPHandler: jest.fn().mockImplementation(() => ({
      handleRequest: jest.fn()
    }))
  };
});

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

describe('/api/mcp (rewritten from /mcp)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should reject non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(405);
    const data = JSON.parse(res._getData());
    expect(data).toEqual({
      jsonrpc: '2.0',
      id: null,
      error: {
        code: -32601,
        message: 'Method not allowed'
      }
    });
  });

  it('should handle valid MCP requests', async () => {
    const { MCPHandler } = require('@/lib/mcp/handler');
    const mockHandleRequest = MCPHandler.mockImplementation(() => ({
      handleRequest: jest.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] }
      })
    }));

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const data = JSON.parse(res._getData());
    expect(data).toEqual({
      jsonrpc: '2.0',
      id: 1,
      result: { tools: [] }
    });
  });

  it('should handle MCP handler errors', async () => {
    const { MCPHandler } = require('@/lib/mcp/handler');
    MCPHandler.mockImplementation(() => ({
      handleRequest: jest.fn().mockRejectedValue(new Error('Handler error'))
    }));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });

    await handler(req, res);

    expect(res._getStatusCode()).toBe(500);
    const data = JSON.parse(res._getData());
    expect(data).toEqual({
      jsonrpc: '2.0',
      id: 1,
      error: {
        code: -32603,
        message: 'Internal error'
      }
    });
  });

  it('should set correct CORS headers', async () => {
    const { MCPHandler } = require('@/lib/mcp/handler');
    MCPHandler.mockImplementation(() => ({
      handleRequest: jest.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: {}
      })
    }));

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize'
      }
    });

    await handler(req, res);

    expect(res.getHeaders()).toMatchObject({
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'Content-Type'
    });
  });

  it('should log request details', async () => {
    const { logger } = require('@/lib/logger');
    const { MCPHandler } = require('@/lib/mcp/handler');
    
    MCPHandler.mockImplementation(() => ({
      handleRequest: jest.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: {}
      })
    }));

    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'user-agent': 'test-agent'
      },
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });

    await handler(req, res);

    expect(logger.info).toHaveBeenCalledWith('MCP request received', {
      method: 'tools/list',
      userAgent: 'test-agent',
      metadata: { id: 1 }
    });

    expect(logger.info).toHaveBeenCalledWith('MCP request completed', {
      method: 'tools/list',
      metadata: { 
        id: 1,
        success: true
      }
    });
  });
});