import type { NextApiRequest, NextApiResponse } from 'next';

export default async function mcpRedirect(req: NextApiRequest, res: NextApiResponse) {
  // 設置 CORS 標頭
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  // 處理 OPTIONS 請求 (CORS preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 回傳 MCP 協議格式的錯誤，說明正確的端點
  return res.status(404).json({
    jsonrpc: '2.0',
    id: req.body?.id || null,
    error: {
      code: -32004,
      message: 'MCP endpoint moved',
      data: {
        correct_endpoint: '/api/mcp',
        description: 'Please use /api/mcp as the MCP server endpoint instead of /mcp'
      }
    }
  });
}