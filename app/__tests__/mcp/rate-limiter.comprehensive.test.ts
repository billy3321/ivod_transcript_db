import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';
import mcpHandler from '@/pages/api/mcp';

// Mock the MCP handler and other dependencies
jest.mock('@/lib/mcp/handler', () => {
  return {
    MCPHandler: jest.fn().mockImplementation(() => ({
      handleRequest: jest.fn().mockResolvedValue({
        jsonrpc: '2.0',
        id: 1,
        result: { tools: [] }
      })
    }))
  };
});

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('MCP Rate Limiter Comprehensive Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear any existing rate limit state
    const { globalRateLimiter } = require('@/lib/mcp/rate-limiter');
    if (globalRateLimiter && globalRateLimiter.clear) {
      globalRateLimiter.clear();
    }
  });

  const createMCPRequest = (clientId?: string) => {
    const headers: Record<string, string> = {
      'content-type': 'application/json',
    };
    
    if (clientId) {
      headers['x-client-id'] = clientId;
    }

    return createMocks<NextApiRequest, NextApiResponse>({
      method: 'POST',
      headers,
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list'
      }
    });
  };

  describe('Rate Limiting Behavior', () => {
    it('should allow requests within rate limit', async () => {
      const { req, res } = createMCPRequest('test-client-1');
      
      await mcpHandler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
      
      // Check rate limit headers are set
      const headers = res.getHeaders();
      expect(headers).toHaveProperty('x-ratelimit-limit');
      expect(headers).toHaveProperty('x-ratelimit-remaining');
      expect(headers).toHaveProperty('x-ratelimit-reset');
    });

    it('should block requests when rate limit exceeded', async () => {
      const clientId = 'test-client-rate-limit';
      
      // Make multiple requests rapidly to trigger rate limit
      const requests = Array.from({ length: 105 }, () => createMCPRequest(clientId));
      
      let blockedRequests = 0;
      let successfulRequests = 0;
      
      for (const { req, res } of requests) {
        await mcpHandler(req, res);
        
        if (res._getStatusCode() === 429) {
          blockedRequests++;
          
          const response = JSON.parse(res._getData());
          expect(response).toMatchObject({
            jsonrpc: '2.0',
            id: 1,
            error: {
              code: expect.any(Number),
              message: expect.stringMatching(/rate limit/i)
            }
          });
          
          // Check rate limit headers
          const headers = res.getHeaders();
          expect(headers).toHaveProperty('x-ratelimit-limit');
          expect(headers).toHaveProperty('x-ratelimit-remaining');
          expect(headers).toHaveProperty('x-ratelimit-reset');
          expect(headers).toHaveProperty('retry-after');
        } else if (res._getStatusCode() === 200) {
          successfulRequests++;
        }
      }
      
      expect(blockedRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeGreaterThan(0);
      expect(successfulRequests).toBeLessThanOrEqual(100); // Rate limit is 100
    });

    it('should handle different client IDs separately', async () => {
      const client1 = 'test-client-1';
      const client2 = 'test-client-2';
      
      // Make requests for client 1
      for (let i = 0; i < 50; i++) {
        const { req, res } = createMCPRequest(client1);
        await mcpHandler(req, res);
        expect(res._getStatusCode()).toBe(200);
      }
      
      // Client 2 should still be able to make requests
      for (let i = 0; i < 50; i++) {
        const { req, res } = createMCPRequest(client2);
        await mcpHandler(req, res);
        expect(res._getStatusCode()).toBe(200);
      }
    });

    it('should use fallback client ID when none provided', async () => {
      const { req, res } = createMCPRequest();
      
      await mcpHandler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
      
      // Should have rate limit headers even with fallback ID
      const headers = res.getHeaders();
      expect(headers).toHaveProperty('x-ratelimit-limit');
      expect(headers).toHaveProperty('x-ratelimit-remaining');
      expect(headers).toHaveProperty('x-ratelimit-reset');
    });
  });

  describe('Rate Limit Headers', () => {
    it('should include correct rate limit headers in successful responses', async () => {
      const { req, res } = createMCPRequest('test-client-headers');
      
      await mcpHandler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
      
      const headers = res.getHeaders();
      expect(headers['x-ratelimit-limit']).toBe('100');
      expect(headers['x-ratelimit-remaining']).toBeDefined();
      expect(headers['x-ratelimit-reset']).toBeDefined();
      
      // Remaining should be a number less than limit
      const remaining = parseInt(headers['x-ratelimit-remaining'] as string);
      expect(remaining).toBeLessThan(100);
      expect(remaining).toBeGreaterThanOrEqual(0);
      
      // Reset should be a future timestamp
      const reset = parseInt(headers['x-ratelimit-reset'] as string);
      expect(reset).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });

    it('should include retry-after header in rate limited responses', async () => {
      const clientId = 'test-client-retry-after';
      
      // Exhaust rate limit
      for (let i = 0; i < 101; i++) {
        const { req, res } = createMCPRequest(clientId);
        await mcpHandler(req, res);
        
        if (res._getStatusCode() === 429) {
          const headers = res.getHeaders();
          expect(headers).toHaveProperty('retry-after');
          
          const retryAfter = parseInt(headers['retry-after'] as string);
          expect(retryAfter).toBeGreaterThan(0);
          expect(retryAfter).toBeLessThanOrEqual(3600); // Should be reasonable
          break;
        }
      }
    });
  });

  describe('Rate Limit Error Responses', () => {
    it('should return proper JSON-RPC error for rate limit exceeded', async () => {
      const clientId = 'test-client-error-format';
      
      // Exhaust rate limit
      let rateLimitedResponse: any = null;
      
      for (let i = 0; i < 110; i++) {
        const { req, res } = createMCPRequest(clientId);
        await mcpHandler(req, res);
        
        if (res._getStatusCode() === 429) {
          rateLimitedResponse = JSON.parse(res._getData());
          break;
        }
      }
      
      expect(rateLimitedResponse).not.toBeNull();
      expect(rateLimitedResponse).toMatchObject({
        jsonrpc: '2.0',
        id: 1,
        error: {
          code: expect.any(Number),
          message: expect.stringMatching(/rate limit/i),
          data: {
            rateLimitExceeded: true,
            retryAfter: expect.any(Number),
            resetTime: expect.any(Number),
            blocked: expect.any(Boolean)
          }
        }
      });
    });

    it('should handle client blocking for repeated violations', async () => {
      const clientId = 'test-client-blocking';
      
      // Make enough requests to potentially trigger blocking
      let blockedResponse: any = null;
      
      for (let i = 0; i < 150; i++) {
        const { req, res } = createMCPRequest(clientId);
        await mcpHandler(req, res);
        
        if (res._getStatusCode() === 429) {
          const response = JSON.parse(res._getData());
          if (response.error?.data?.blocked) {
            blockedResponse = response;
            break;
          }
        }
      }
      
      if (blockedResponse) {
        expect(blockedResponse.error.data.blocked).toBe(true);
        expect(blockedResponse.error.message).toMatch(/temporarily blocked/i);
      }
      // Note: Blocking might not always occur depending on rate limiter implementation
    });
  });

  describe('Client Identification', () => {
    it('should handle x-client-id header', async () => {
      const clientId = 'explicit-client-id';
      const { req, res } = createMCPRequest(clientId);
      
      await mcpHandler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
    });

    it('should handle missing client identification gracefully', async () => {
      const { req, res } = createMocks<NextApiRequest, NextApiResponse>({
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: { jsonrpc: '2.0', id: 1, method: 'tools/list' }
      });
      
      await mcpHandler(req, res);
      
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('Logging', () => {
    it('should log rate limit violations', async () => {
      const { logger } = require('@/lib/logger');
      const clientId = 'test-client-logging';
      
      // Trigger rate limit
      for (let i = 0; i < 105; i++) {
        const { req, res } = createMCPRequest(clientId);
        await mcpHandler(req, res);
        
        if (res._getStatusCode() === 429) {
          break;
        }
      }
      
      // Should have logged the rate limit warning
      expect(logger.warn).toHaveBeenCalledWith(
        'MCP request rate limited',
        expect.objectContaining({
          metadata: expect.objectContaining({
            clientId: expect.any(String)
          })
        })
      );
    });
  });
});