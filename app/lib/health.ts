/**
 * Health check helpers — public 與 admin 共用底層邏輯
 */
import prisma from '@/lib/prisma';

export interface PublicHealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
}

export interface DetailedHealthResponse extends PublicHealthResponse {
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

export async function checkDatabaseHealth(): Promise<'healthy' | 'unhealthy'> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

export async function checkElasticsearchHealth(): Promise<'healthy' | 'unhealthy' | undefined> {
  if (!process.env.ES_HOST || process.env.ENABLE_ELASTICSEARCH === 'false') {
    return undefined;
  }
  try {
    const esClient = (await import('@/lib/elastic')).default;
    await Promise.race([
      esClient.ping(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000)),
    ]);
    return 'healthy';
  } catch {
    return 'unhealthy';
  }
}

export async function getPublicHealth(): Promise<PublicHealthResponse> {
  const databaseStatus = await checkDatabaseHealth();
  return {
    status: databaseStatus === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
  };
}

export async function getDetailedHealth(): Promise<DetailedHealthResponse> {
  const [databaseStatus, elasticsearchStatus] = await Promise.all([
    checkDatabaseHealth(),
    checkElasticsearchHealth(),
  ]);

  const memUsage = process.memoryUsage();
  const memory = {
    used: Math.round(memUsage.heapUsed / 1024 / 1024),
    free: Math.round((memUsage.heapTotal - memUsage.heapUsed) / 1024 / 1024),
    total: Math.round(memUsage.heapTotal / 1024 / 1024),
  };

  return {
    status: databaseStatus === 'healthy' ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0',
    uptime: Math.floor(process.uptime()),
    services: {
      database: databaseStatus,
      ...(elasticsearchStatus !== undefined && { elasticsearch: elasticsearchStatus }),
    },
    memory,
  };
}
