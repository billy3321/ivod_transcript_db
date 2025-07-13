import type { NextApiRequest, NextApiResponse } from 'next';
import { MCPHandler } from '@/lib/mcp/handler';
import { logger } from '@/lib/logger';

export default async function mcpEndpoint(req: NextApiRequest, res: NextApiResponse) {
  // 只接受 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      jsonrpc: '2.0',
      id: null,
      error: { 
        code: -32601, 
        message: 'Method not allowed' 
      }
    });
  }

  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
        code: -32603,
        message: 'Internal error'
      }
    });
  }
}