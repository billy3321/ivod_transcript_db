import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicHealth } from '@/lib/health';

/**
 * Public health endpoint — 只回 status 與 timestamp，避免洩漏 memory/version/uptime
 * 詳細資訊請改用 /api/admin/health (需 admin token)
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now();

  if (req.method !== 'GET') {
    res.status(405).json({ status: 'unhealthy', timestamp: new Date().toISOString() });
    return;
  }

  try {
    const result = await getPublicHealth();
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
