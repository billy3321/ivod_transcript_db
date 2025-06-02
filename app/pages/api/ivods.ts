import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getDbBackend, createContainsCondition, convertToDate } from '@/lib/utils';
import { universalSearch, shouldUseUniversalSearch } from '@/lib/universal-search';
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

  // Check if we should use universal search for better partial matching
  const searchParams = {
    q: q as string,
    meeting_name: meeting_name as string,
    speaker: speaker as string,
    committee: committee as string,
    date_from: date_from as string,
    date_to: date_to as string,
    ids: ids as string,
    page: pageNum,
    pageSize: size,
    sort: sort as 'date_desc' | 'date_asc'
  };

  if (shouldUseUniversalSearch(searchParams)) {
    try {
      const result = await universalSearch(searchParams);
      return res.status(200).json(result);
    } catch (error: any) {
      logger.logDatabaseError(error, 'universal_search_fallback', searchParams);
      // Fall through to standard Prisma search
    }
  }

  // Standard Prisma search (fallback or when universal search is not needed)
  const skip = (pageNum - 1) * size;
  const orderBy: any = sort === 'date_asc' ? { date: 'asc' } : { date: 'desc' };

  let where: any = {};
  const conditions: any[] = [];

  // Get database backend to determine search strategy
  const dbBackend = getDbBackend();
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  
  // General search in multiple fields
  if (q && typeof q === 'string') {
    const searchFields = [
      createContainsCondition('title', q, dbBackend),
      createContainsCondition('meeting_name', q, dbBackend),
      createContainsCondition('speaker_name', q, dbBackend),
      createContainsCondition('committee_names', q, dbBackend),
      createContainsCondition('meeting_code_str', q, dbBackend),
      createContainsCondition('ai_transcript', q, dbBackend),
      createContainsCondition('ly_transcript', q, dbBackend),
    ];
    
    conditions.push({
      OR: searchFields,
    });
  }

  // Specific field searches
  if (meeting_name && typeof meeting_name === 'string') {
    const meetingCondition = createContainsCondition('meeting_name', meeting_name, dbBackend);
    conditions.push(meetingCondition);
  }

  if (speaker && typeof speaker === 'string') {
    const speakerCondition = createContainsCondition('speaker_name', speaker, dbBackend);
    conditions.push(speakerCondition);
  }

  if (committee && typeof committee === 'string') {
    const committeeCondition = createContainsCondition('committee_names', committee, dbBackend);
    conditions.push(committeeCondition);
  }

  // Date range filters
  if (date_from && typeof date_from === 'string') {
    const fromDate = convertToDate(date_from);
    if (fromDate) {
      conditions.push({
        date: { gte: fromDate }
      });
    }
  }

  if (date_to && typeof date_to === 'string') {
    const toDate = convertToDate(date_to);
    if (toDate) {
      conditions.push({
        date: { lte: toDate }
      });
    }
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
      metadata: {
        resultsCount: data.length,
        totalCount: total,
        page: pageNum,
        pageSize: size
      }
    });
    
    res.status(200).json({ data, total });
  } catch (error: any) {
    // 檢查是否為表格不存在的錯誤
    if (error.message && error.message.includes('does not exist')) {
      logger.warn('Database table does not exist, returning empty result', {
        metadata: { tableName: 'ivod_transcripts', query: where }
      });
      return res.status(200).json({ data: [], total: 0 });
    }
    
    logger.logDatabaseError(error, 'ivods_list', {
      where,
      orderBy,
      skip,
      take: size
    });
    res.status(500).json({ error: error.message });
  }
}