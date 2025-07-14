import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    database: 'healthy' | 'unhealthy';
    elasticsearch?: 'healthy' | 'unhealthy';
  };
  memory: {
    used: number;
    free: number;
    total: number;
  };
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  const startTime = Date.now();
  
  try {
    // 檢查資料庫連線
    let databaseStatus: 'healthy' | 'unhealthy' = 'unhealthy';
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'healthy';
    } catch (error) {
      console.error('Database health check failed:', error);
    }

    // 檢查 Elasticsearch（可選，靜默失敗）
    let elasticsearchStatus: 'healthy' | 'unhealthy' | undefined;
    if (process.env.ES_HOST && process.env.ENABLE_ELASTICSEARCH !== 'false') {
      try {
        const esClient = (await import('@/lib/elastic')).default;
        await Promise.race([
          esClient.ping(),
          new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
        ]);
        elasticsearchStatus = 'healthy';
      } catch (error) {
        // 靜默處理 Elasticsearch 連接失敗，系統會自動 fallback 到資料庫搜尋
        elasticsearchStatus = 'unhealthy';
        
        // 開發環境友好提示，不視為錯誤
        if (process.env.NODE_ENV === 'development') {
          console.info('🔍 Elasticsearch unavailable, using database search (normal in dev environment)');
        }
      }
    }

    // 記憶體使用情況
    const memUsage = process.memoryUsage();
    const memory = {
      used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024), // MB
      total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
    };

    // 總體健康狀態（Elasticsearch 不可用不影響整體健康狀態）
    const isHealthy = databaseStatus === 'healthy';

    const response: HealthResponse = {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      services: {
        database: databaseStatus,
        ...(elasticsearchStatus !== undefined && { elasticsearch: elasticsearchStatus }),
      },
      memory,
    };

    // 設定回應時間標頭
    res.setHeader('X-Response-Time', `${Date.now() - startTime}ms`);
    
    // 如果服務不健康，回傳 503
    if (!isHealthy) {
      res.status(503).json(response);
    } else {
      res.status(200).json(response);
    }
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      uptime: Math.floor(process.uptime()),
      services: {
        database: 'unhealthy',
      },
      memory: {
        used: 0,
        free: 0,
        total: 0,
      },
    });
  }
}