import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id } = req.query;
  
  logger.logApiRequest(req, { ivodId: id });
  
  if (!id || Array.isArray(id)) {
    logger.warn('Invalid IVOD ID provided', {
      method: req.method,
      url: req.url,
      providedId: id
    });
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  try {
    const data = await prisma.iVODTranscript.findUnique({
      where: { ivod_id: parseInt(id, 10) },
      select: {
        ivod_id: true,
        date: true,
        title: true,
        meeting_name: true,
        committee_names: true,
        speaker_name: true,
        video_length: true,
        video_start: true,
        video_end: true,
        video_type: true,
        category: true,
        meeting_code: true,
        meeting_code_str: true,
        meeting_time: true,
        ivod_url: true,
        video_url: true,
        ai_transcript: true,
        ly_transcript: true,
        ai_status: true,
        ly_status: true,
        last_updated: true,
      },
    });
    
    if (!data) {
      logger.warn('IVOD not found', {
        ivodId: id,
        action: 'ivod_detail_not_found'
      });
      res.status(404).json({ error: 'Not found' });
    } else {
      logger.info('IVOD detail retrieved successfully', {
        ivodId: id,
        hasAiTranscript: !!data.ai_transcript,
        hasLyTranscript: !!data.ly_transcript
      });
      res.status(200).json({ data });
    }
  } catch (error: any) {
    logger.logDatabaseError(error, 'ivod_detail', {
      ivodId: id
    });
    res.status(500).json({ error: error.message });
  }
}