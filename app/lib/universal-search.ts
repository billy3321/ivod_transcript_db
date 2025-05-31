import prisma from '@/lib/prisma';
import { getDbBackend, convertToDate } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Universal search using LIKE queries for partial matching
 * Works across all database backends (SQLite, PostgreSQL, MySQL)
 */

interface SearchParams {
  q?: string;
  meeting_name?: string;
  speaker?: string;
  committee?: string;
  date_from?: string;
  date_to?: string;
  ids?: string;
  page?: number;
  pageSize?: number;
  sort?: 'date_asc' | 'date_desc';
}

interface SearchResult {
  data: any[];
  total: number;
}

/**
 * Universal search function using raw SQL LIKE queries
 * This provides consistent partial matching across all database backends
 */
export async function universalSearch(params: SearchParams): Promise<SearchResult> {
  const {
    q,
    meeting_name,
    speaker,
    committee,
    date_from,
    date_to,
    ids,
    page = 1,
    pageSize = 20,
    sort = 'date_desc'
  } = params;

  const dbBackend = getDbBackend();
  const skip = (page - 1) * pageSize;
  const orderByClause = sort === 'date_asc' ? 'ORDER BY date ASC' : 'ORDER BY date DESC';

  // Build WHERE conditions
  const whereConditions: string[] = [];
  const queryParams: any[] = [];

  // General search (q parameter)
  if (q && typeof q === 'string') {
    whereConditions.push(`(
      title LIKE ? OR 
      meeting_name LIKE ? OR 
      speaker_name LIKE ? OR 
      committee_names LIKE ? OR 
      meeting_code_str LIKE ? OR 
      ai_transcript LIKE ? OR 
      ly_transcript LIKE ?
    )`);
    const qPattern = `%${q}%`;
    queryParams.push(qPattern, qPattern, qPattern, qPattern, qPattern, qPattern, qPattern);
  }

  // Specific field searches with LIKE for partial matching
  if (meeting_name && typeof meeting_name === 'string') {
    whereConditions.push('meeting_name LIKE ?');
    queryParams.push(`%${meeting_name}%`);
  }

  if (speaker && typeof speaker === 'string') {
    whereConditions.push('speaker_name LIKE ?');
    queryParams.push(`%${speaker}%`);
  }

  if (committee && typeof committee === 'string') {
    whereConditions.push('committee_names LIKE ?');
    queryParams.push(`%${committee}%`);
  }

  // Date range filters
  if (date_from && typeof date_from === 'string') {
    const fromDate = convertToDate(date_from);
    if (fromDate) {
      whereConditions.push('date >= ?');
      queryParams.push(fromDate);
    }
  }

  if (date_to && typeof date_to === 'string') {
    const toDate = convertToDate(date_to);
    if (toDate) {
      whereConditions.push('date <= ?');
      queryParams.push(toDate);
    }
  }

  // IDs filter
  if (ids && typeof ids === 'string') {
    const ivodIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    if (ivodIds.length > 0) {
      whereConditions.push(`ivod_id IN (${ivodIds.map(() => '?').join(',')})`);
      queryParams.push(...ivodIds);
    }
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  try {
    // Build SQL queries
    const dataQuery = `
      SELECT ivod_id, date, title, meeting_name, committee_names, speaker_name, 
             video_length, video_start, video_end, video_type, category, 
             meeting_code, meeting_code_str, meeting_time
      FROM ivod_transcripts 
      ${whereClause} 
      ${orderByClause}
      LIMIT ? OFFSET ?
    `;

    const countQuery = `
      SELECT COUNT(*) as count 
      FROM ivod_transcripts 
      ${whereClause}
    `;

    // Add pagination parameters
    const finalParams = [...queryParams, pageSize, skip];
    const countParams = [...queryParams];

    // Execute queries
    const [data, totalResult] = await Promise.all([
      prisma.$queryRawUnsafe(dataQuery, ...finalParams),
      prisma.$queryRawUnsafe(countQuery, ...countParams)
    ]);

    const total = Array.isArray(totalResult) && totalResult[0] ? Number(totalResult[0].count) : 0;

    logger.info('Universal search query completed successfully', {
      metadata: {
        resultsCount: Array.isArray(data) ? data.length : 0,
        totalCount: total,
        page,
        pageSize,
        dbBackend,
        usedUniversalSearch: true
      }
    });

    return {
      data: Array.isArray(data) ? data : [],
      total
    };

  } catch (error: any) {
    logger.logDatabaseError(error, 'universal_search', {
      params,
      whereConditions,
      queryParams,
      dbBackend
    });
    
    throw error;
  }
}

/**
 * Check if we should use universal search for this request
 * Universal search is recommended when we need partial matching on string fields
 */
export function shouldUseUniversalSearch(params: SearchParams): boolean {
  const { meeting_name, speaker, committee } = params;
  
  // Use universal search if any string field filters are present
  // These benefit most from LIKE partial matching
  return !!(meeting_name || speaker || committee);
}