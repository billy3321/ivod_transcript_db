import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '@/lib/prisma';
import { getDbBackend, createContainsCondition, convertToDate } from '@/lib/utils';
import { universalSearch, shouldUseUniversalSearch } from '@/lib/universal-search';
import { 
  withErrorHandler, 
  validateMethod, 
  parseStringParam, 
  parseIntParam,
  createSuccessResponse,
  createErrorResponse,
  APIResponse 
} from '@/lib/api-middleware';
import { IVOD } from '@/types';

interface SearchParams {
  q?: string;
  meeting_name?: string;
  speaker?: string;
  committee?: string;
  date_from?: string;
  date_to?: string;
  ids?: string;
  page: number;
  pageSize: number;
  sort: 'date_desc' | 'date_asc';
}

async function ivodsHandler(req: NextApiRequest, res: NextApiResponse): Promise<APIResponse<IVOD[]>> {
  validateMethod(req, ['GET']);
  
  // Parse and validate parameters
  const searchParams: SearchParams = {
    q: parseStringParam(req.query.q, 'q', ''),
    meeting_name: parseStringParam(req.query.meeting_name, 'meeting_name', ''),
    speaker: parseStringParam(req.query.speaker, 'speaker', ''),
    committee: parseStringParam(req.query.committee, 'committee', ''),
    date_from: parseStringParam(req.query.date_from, 'date_from', ''),
    date_to: parseStringParam(req.query.date_to, 'date_to', ''),
    ids: parseStringParam(req.query.ids, 'ids', ''),
    page: parseIntParam(req.query.page, 'page', 1),
    pageSize: parseIntParam(req.query.pageSize, 'pageSize', 20),
    sort: (parseStringParam(req.query.sort, 'sort', 'date_desc') as 'date_desc' | 'date_asc'),
  };

  // Validate page size
  if (searchParams.pageSize > 100) {
    throw createErrorResponse('Page size cannot exceed 100', 400);
  }

  if (shouldUseUniversalSearch(searchParams)) {
    try {
      const result = await universalSearch(searchParams);
      return createSuccessResponse(result.data, {
        total: result.total,
        page: searchParams.page,
        pageSize: searchParams.pageSize
      });
    } catch (error: any) {
      // Fall through to standard Prisma search
      console.warn('Universal search failed, falling back to Prisma:', error.message);
    }
  }

  // Standard Prisma search (fallback or when universal search is not needed)
  const skip = (searchParams.page - 1) * searchParams.pageSize;
  const orderBy: any = searchParams.sort === 'date_asc' ? { date: 'asc' } : { date: 'desc' };

  let where: any = {};
  const conditions: any[] = [];

  // Get database backend to determine search strategy
  const dbBackend = getDbBackend();
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  
  // General search in multiple fields
  if (searchParams.q) {
    const searchFields = [
      createContainsCondition('title', searchParams.q, dbBackend),
      createContainsCondition('meeting_name', searchParams.q, dbBackend),
      createContainsCondition('speaker_name', searchParams.q, dbBackend),
      createContainsCondition('committee_names', searchParams.q, dbBackend),
      createContainsCondition('meeting_code_str', searchParams.q, dbBackend),
      createContainsCondition('ai_transcript', searchParams.q, dbBackend),
      createContainsCondition('ly_transcript', searchParams.q, dbBackend),
    ];
    
    conditions.push({
      OR: searchFields,
    });
  }

  // Specific field searches
  if (searchParams.meeting_name) {
    const meetingCondition = createContainsCondition('meeting_name', searchParams.meeting_name, dbBackend);
    conditions.push(meetingCondition);
  }

  if (searchParams.speaker) {
    const speakerCondition = createContainsCondition('speaker_name', searchParams.speaker, dbBackend);
    conditions.push(speakerCondition);
  }

  if (searchParams.committee) {
    const committeeCondition = createContainsCondition('committee_names', searchParams.committee, dbBackend);
    conditions.push(committeeCondition);
  }

  // Date range filters
  if (searchParams.date_from) {
    const fromDate = convertToDate(searchParams.date_from);
    if (fromDate) {
      conditions.push({
        date: { gte: fromDate }
      });
    }
  }

  if (searchParams.date_to) {
    const toDate = convertToDate(searchParams.date_to);
    if (toDate) {
      conditions.push({
        date: { lte: toDate }
      });
    }
  }

  // Filter by specific IVOD IDs (for transcript search results)
  if (searchParams.ids) {
    const ivodIds = searchParams.ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
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
        take: searchParams.pageSize,
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
    
    return createSuccessResponse(data, {
      total,
      page: searchParams.page,
      pageSize: searchParams.pageSize
    });
  } catch (error: any) {
    // 檢查是否為表格不存在的錯誤
    if (error.message && error.message.includes('does not exist')) {
      return createSuccessResponse([], {
        total: 0,
        page: searchParams.page,
        pageSize: searchParams.pageSize
      });
    }
    
    throw createErrorResponse('Database query failed', 500);
  }
}

export default withErrorHandler(ivodsHandler);