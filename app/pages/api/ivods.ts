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
    // Helper function to create contains condition with database-specific field handling
    const createContainsCondition = (field: string, value: string) => {
      // Special handling for committee_names field based on database backend
      if (field === 'committee_names') {
        if (dbBackend === 'postgresql') {
          // PostgreSQL array field - use 'has' for array contains operation
          return { [field]: { has: value } };
        } else if (dbBackend === 'mysql') {
          // MySQL JSON field - use string_contains for JSON search
          return { [field]: { string_contains: value } };
        } else {
          // SQLite string field - use regular contains
          return { [field]: { contains: value } };
        }
      }
      
      // For MySQL, case insensitive mode is not supported on string fields
      if (dbBackend === 'mysql') {
        return { [field]: { contains: value } };
      }
      
      return isInsensitiveSupported
        ? { [field]: { contains: value, mode: 'insensitive' as const } }
        : { [field]: { contains: value } };
    };

    const searchFields = [
      createContainsCondition('title', q),
      createContainsCondition('meeting_name', q),
      createContainsCondition('speaker_name', q),
      createContainsCondition('committee_names', q),
      createContainsCondition('meeting_code_str', q),
      createContainsCondition('ai_transcript', q),
      createContainsCondition('ly_transcript', q),
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
    // Handle committee_names field based on database backend
    let committeeCondition;
    if (dbBackend === 'postgresql') {
      // PostgreSQL array field - use 'has' for array contains operation
      committeeCondition = { has: committee };
    } else if (dbBackend === 'mysql') {
      // MySQL JSON field - use string_contains for JSON search
      committeeCondition = { string_contains: committee };
    } else {
      // SQLite string field - use regular contains with case sensitivity if supported
      committeeCondition = isInsensitiveSupported 
        ? { contains: committee, mode: 'insensitive' as const }
        : { contains: committee };
    }
        
    conditions.push({
      committee_names: committeeCondition
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
      metadata: {
        resultsCount: data.length,
        totalCount: total,
        page: pageNum,
        pageSize: size
      }
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