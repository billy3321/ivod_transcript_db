import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';
import {
  withErrorHandler,
  validateMethod,
  parseIntParam,
  createSuccessResponse,
  createErrorResponse,
  APIResponse,
} from '@/lib/api-middleware';

async function ivodDetailHandler(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<APIResponse<any>> {
  validateMethod(req, ['GET']);

  const ivodId = parseIntParam(req.query.id, 'id');
  if (!Number.isInteger(ivodId) || ivodId <= 0) {
    throw createErrorResponse('Invalid id: must be a positive integer', 400);
  }

  logger.logApiRequest(req, { ivodId });

  try {
    const data = await prisma.iVODTranscript.findUnique({
      where: { ivod_id: ivodId },
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
        action: 'ivod_detail_not_found',
        metadata: { ivodId },
      });
      throw createErrorResponse('Not found', 404);
    }

    logger.info('IVOD detail retrieved successfully', {
      metadata: {
        ivodId,
        hasAiTranscript: !!data.ai_transcript,
        hasLyTranscript: !!data.ly_transcript,
      },
    });

    return createSuccessResponse(data);
  } catch (error: any) {
    if (error?.statusCode) {
      throw error;
    }

    if (error?.message && error.message.includes('does not exist')) {
      logger.warn('Database table does not exist for IVOD detail', {
        metadata: { tableName: 'ivod_transcripts', ivodId },
      });
      throw createErrorResponse('Not found', 404);
    }

    logger.logDatabaseError(error, 'ivod_detail', { ivodId });
    throw createErrorResponse('Database query failed', 500);
  }
}

export default withErrorHandler(ivodDetailHandler);
