import type { NextApiRequest, NextApiResponse } from 'next';
import { timingSafeEqual } from 'crypto';
import { getDetailedHealth } from '@/lib/health';

/**
 * Detailed health endpoint — 需 ADMIN_TOKEN bearer 認證
 * 含 memory/uptime/version/Elasticsearch 等可能用於 fingerprint 的資訊
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !isValidAuth(authHeader)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const startTime = Date.now();
  try {
    const result = await getDetailedHealth();
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
    res.setHeader('Cache-Control', 'no-store');
    res.status(result.status === 'healthy' ? 200 : 503).json(result);
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  }
}

function isValidAuth(authHeader: string): boolean {
  if (!authHeader?.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  const adminToken = process.env.ADMIN_TOKEN;
  if (!adminToken) return false;
  const a = Buffer.from(token);
  const b = Buffer.from(adminToken);
  return a.length === b.length && timingSafeEqual(a, b);
}
