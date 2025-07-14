import type { NextApiRequest, NextApiResponse } from 'next';
import { MCPHandler } from '@/lib/mcp/handler';
import { logger } from '@/lib/logger';
import { globalRateLimiter, getClientIdentifier } from '@/lib/mcp/rate-limiter';
import { JSON_RPC_ERRORS, MCP_ERRORS } from '@/lib/mcp/error-codes';

export default async function mcpEndpoint(req: NextApiRequest, res: NextApiResponse) {
  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // 處理 OPTIONS 請求 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只接受 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      jsonrpc: '2.0',
      id: null,
      error: { 
        code: JSON_RPC_ERRORS.METHOD_NOT_FOUND, 
        message: 'Method not allowed' 
      }
    });
  }

  // Rate limiting 檢查
  const clientId = getClientIdentifier(req);
  const rateLimitResult = globalRateLimiter.checkLimit(clientId);
  
  if (!rateLimitResult.allowed) {
    const errorMessage = rateLimitResult.blocked 
      ? 'Client temporarily blocked due to rate limit violation'
      : 'Rate limit exceeded';
    
    // 設置 rate limit 標頭
    res.setHeader('X-RateLimit-Limit', '100');
    res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());
    
    if (rateLimitResult.blocked) {
      res.setHeader('Retry-After', Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000).toString());
    }

    logger.warn('MCP request rate limited', {
      clientId,
      blocked: rateLimitResult.blocked,
      resetTime: new Date(rateLimitResult.resetTime).toISOString(),
      userAgent: req.headers['user-agent']
    });

    return res.status(429).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: MCP_ERRORS.RATE_LIMIT_EXCEEDED, // MCP 規範建議的 rate limiting 錯誤代碼
        message: errorMessage,
        data: {
          rateLimitExceeded: true,
          retryAfter: Math.ceil((rateLimitResult.resetTime - Date.now()) / 1000),
          resetTime: rateLimitResult.resetTime,
          blocked: rateLimitResult.blocked
        }
      }
    });
  }

  // 設置成功的 rate limit 標頭
  res.setHeader('X-RateLimit-Limit', '100');
  res.setHeader('X-RateLimit-Remaining', rateLimitResult.remaining.toString());
  res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitResult.resetTime / 1000).toString());

  const handler = new MCPHandler();
  
  try {
    logger.info('MCP request received', {
      method: req.body?.method,
      userAgent: req.headers['user-agent'],
      metadata: { id: req.body?.id }
    });

    const response = await handler.handleRequest(req.body);
    
    logger.info('MCP request completed', {
      method: req.body?.method,
      metadata: { 
        id: req.body?.id,
        success: !response.error
      }
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error('MCP endpoint error:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({
      jsonrpc: '2.0',
      id: req.body?.id || null,
      error: {
        code: JSON_RPC_ERRORS.INTERNAL_ERROR,
        message: 'Internal error'
      }
    });
  }
}