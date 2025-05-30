import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const result = await prisma.iVODTranscript.findFirst({
      select: {
        last_updated: true,
      },
      orderBy: {
        last_updated: 'desc',
      },
    });

    if (!result) {
      logger.warn('No data found in database for status check');
      res.status(404).json({ error: 'No data found' });
      return;
    }

    logger.info('Database status check completed successfully', {
      lastUpdated: result.last_updated
    });

    res.status(200).json({ 
      lastUpdated: result.last_updated 
    });
  } catch (error: any) {
    logger.logDatabaseError(error, 'status_check');
    res.status(500).json({ error: error.message });
  }
}