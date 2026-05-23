import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  withErrorHandler,
  validateMethod,
  createSuccessResponse,
  createErrorResponse,
  APIResponse,
} from '@/lib/api-middleware';

interface DatabaseStatusData {
  lastUpdated: string | null;
}

async function databaseStatusHandler(
  req: NextApiRequest,
  _res: NextApiResponse
): Promise<APIResponse<DatabaseStatusData>> {
  validateMethod(req, ['GET']);

  const result = await prisma.iVODTranscript.findFirst({
    select: { last_updated: true },
    orderBy: { last_updated: 'desc' },
  });

  if (!result) {
    logger.warn('No data found in database for status check');
    throw createErrorResponse('No data found', 404);
  }

  logger.info('Database status check completed successfully', {
    metadata: { lastUpdated: result.last_updated },
  });

  // 確保時間格式包含 UTC+8 時區資訊（crawler 寫入的是台灣時間）
  let formattedTimestamp: string | null = null;
  if (result.last_updated) {
    let dateStr: string;
    if (result.last_updated instanceof Date) {
      dateStr = result.last_updated.toISOString();
    } else {
      dateStr = new Date(result.last_updated as any).toISOString();
    }
    formattedTimestamp = dateStr.replace('Z', '+08:00');
  }

  return createSuccessResponse({ lastUpdated: formattedTimestamp });
}

export default withErrorHandler(databaseStatusHandler);
