import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getDbBackend } from '@/lib/utils';
import { logger } from '@/lib/logger';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { 
    q, 
    meeting_name,
    speaker,
    committee,
    date_from,
    date_to,
    page = '1', 
    pageSize = '20', 
    sort = 'date_desc',
    ids
  } = req.query;
  
  // Log the API request with search parameters
  logger.logApiRequest(req, {
    searchParams: {
      q, meeting_name, speaker, committee, date_from, date_to, page, pageSize, sort, ids
    }
  });
  
  const pageNum = parseInt(page as string, 10);
  const size = parseInt(pageSize as string, 10);
  const skip = (pageNum - 1) * size;

  const orderBy: any = sort === 'date_asc' ? { date: 'asc' } : { date: 'desc' };

  let where: any = {};
  const conditions: any[] = [];

  // Get database backend to determine search strategy
  const dbBackend = getDbBackend();
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  
  // General search in multiple fields
  if (q && typeof q === 'string') {
    const searchFields = isInsensitiveSupported 
      ? [
          { title: { contains: q, mode: 'insensitive' as const } },
          { meeting_name: { contains: q, mode: 'insensitive' as const } },
          { speaker_name: { contains: q, mode: 'insensitive' as const } },
          { committee_names: { contains: q, mode: 'insensitive' as const } },
          { meeting_code_str: { contains: q, mode: 'insensitive' as const } },
          { ai_transcript: { contains: q, mode: 'insensitive' as const } },
          { ly_transcript: { contains: q, mode: 'insensitive' as const } },
        ]
      : [
          { title: { contains: q } },
          { meeting_name: { contains: q } },
          { speaker_name: { contains: q } },
          { committee_names: { contains: q } },
          { meeting_code_str: { contains: q } },
          { ai_transcript: { contains: q } },
          { ly_transcript: { contains: q } },
        ];
    
    conditions.push({
      OR: searchFields,
    });
  }

  // Specific field searches
  if (meeting_name && typeof meeting_name === 'string') {
    conditions.push({
      meeting_name: isInsensitiveSupported 
        ? { contains: meeting_name, mode: 'insensitive' as const }
        : { contains: meeting_name }
    });
  }

  if (speaker && typeof speaker === 'string') {
    conditions.push({
      speaker_name: isInsensitiveSupported 
        ? { contains: speaker, mode: 'insensitive' as const }
        : { contains: speaker }
    });
  }

  if (committee && typeof committee === 'string') {
    conditions.push({
      committee_names: isInsensitiveSupported 
        ? { contains: committee, mode: 'insensitive' as const }
        : { contains: committee }
    });
  }

  // Date range filters
  if (date_from && typeof date_from === 'string') {
    conditions.push({
      date: { gte: date_from }
    });
  }

  if (date_to && typeof date_to === 'string') {
    conditions.push({
      date: { lte: date_to }
    });
  }

  // Filter by specific IVOD IDs (for transcript search results)
  if (ids && typeof ids === 'string') {
    const ivodIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (ivodIds.length > 0) {
      conditions.push({
        ivod_id: { in: ivodIds }
      });
    }
  }

  // Combine all conditions with AND
  if (conditions.length > 0) {
    where = { AND: conditions };
  }

  try {
    const [data, total] = await Promise.all([
      prisma.iVODTranscript.findMany({
        where,
        orderBy,
        skip,
        take: size,
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
        },
      }),
      prisma.iVODTranscript.count({ where }),
    ]);
    
    logger.info('IVOD list query completed successfully', {
      resultsCount: data.length,
      totalCount: total,
      page: pageNum,
      pageSize: size
    });
    
    res.status(200).json({ data, total });
  } catch (error: any) {
    logger.logDatabaseError(error, 'ivods_list', {
      where,
      orderBy,
      skip,
      take: size
    });
    res.status(500).json({ error: error.message });
  }
}