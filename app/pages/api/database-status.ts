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
      metadata: {
        lastUpdated: result.last_updated
      }
    });

    // 確保時間格式包含 UTC+8 時區資訊
    let formattedTimestamp: string | Date | null = result.last_updated;
    
    if (result.last_updated) {
      // Crawler 寫入的時間是 UTC+8 台灣時間
      // 我們需要將這個時間正確標示為 UTC+8 格式
      
      let dateStr: string;
      if (result.last_updated instanceof Date) {
        // PostgreSQL/MySQL - Date 物件
        dateStr = result.last_updated.toISOString();
      } else {
        // SQLite - 已經是 ISO 字串格式
        const date = new Date(result.last_updated);
        dateStr = date.toISOString();
      }
      
      // 將 Z (UTC) 替換為 +08:00 (UTC+8)，因為實際儲存的就是台灣時間
      formattedTimestamp = dateStr.replace('Z', '+08:00');
    }

    res.status(200).json({ 
      lastUpdated: formattedTimestamp 
    });
  } catch (error: any) {
    logger.logDatabaseError(error, 'status_check');
    res.status(500).json({ error: error.message });
  }
}