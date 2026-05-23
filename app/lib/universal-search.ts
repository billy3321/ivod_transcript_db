import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getDbBackend, convertToDate } from '@/lib/utils';
import { logger } from '@/lib/logger';

/**
 * Universal search using LIKE queries for partial matching.
 * 跨後端支援（SQLite / PostgreSQL / MySQL）。
 *
 * 設計重點：
 * 1. 使用 Prisma.sql / Prisma.join → 由 driver 處理占位符與型別綁定，避免 $queryRawUnsafe
 * 2. committee_names 在三後端 schema 不同（PG: String[] / MySQL: Json / SQLite: String），
 *    依後端產生不同 SQL fragment
 */

type DbBackend = 'sqlite' | 'postgresql' | 'mysql';

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

interface IVODRow {
  ivod_id: number;
  date: Date | string;
  title: string | null;
  meeting_name: string | null;
  committee_names: any;
  speaker_name: string | null;
  video_length: string | null;
  video_start: string | null;
  video_end: string | null;
  video_type: string | null;
  category: string | null;
  meeting_code: string | null;
  meeting_code_str: string | null;
  meeting_time: Date | string | null;
}

/**
 * 根據後端產生 committee_names LIKE 條件
 *
 * - PostgreSQL：committee_names 是 String[] 陣列，先 array_to_string 轉成逗號字串再 ILIKE
 * - MySQL：committee_names 是 JSON，MySQL 在 LIKE 比對時會自動轉成 JSON 字串，能 work 但用 JSON_SEARCH 更明確
 * - SQLite：committee_names 是 String，直接 LIKE
 */
function committeeContainsSql(backend: DbBackend, value: string): Prisma.Sql {
  const pattern = `%${value}%`;
  switch (backend) {
    case 'postgresql':
      return Prisma.sql`array_to_string(committee_names, ',') ILIKE ${pattern}`;
    case 'mysql':
      // MySQL 的 JSON 欄位用 JSON_SEARCH 較精確；但 JSON_SEARCH 只搜尋 JSON 字串值
      // 加上 fallback：committee_names IS NOT NULL AND JSON_SEARCH(...) IS NOT NULL
      return Prisma.sql`JSON_SEARCH(committee_names, 'one', ${pattern}) IS NOT NULL`;
    case 'sqlite':
    default:
      return Prisma.sql`committee_names LIKE ${pattern}`;
  }
}

/**
 * 一般字串欄位的 LIKE（依後端決定是否大小寫不敏感）
 */
function fieldContainsSql(
  backend: DbBackend,
  column: 'title' | 'meeting_name' | 'speaker_name' | 'meeting_code_str' | 'ai_transcript' | 'ly_transcript',
  value: string
): Prisma.Sql {
  const pattern = `%${value}%`;
  // PostgreSQL: ILIKE; MySQL/SQLite: LIKE (MySQL collation 預設不分大小寫)
  const op = backend === 'postgresql' ? 'ILIKE' : 'LIKE';
  // 欄位名稱安全（只接受 union type，非 user input），可用 Prisma.raw
  return Prisma.sql`${Prisma.raw(column)} ${Prisma.raw(op)} ${pattern}`;
}

/**
 * Universal search function using parameterized raw SQL
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
    sort = 'date_desc',
  } = params;

  const dbBackend = getDbBackend();
  const skip = (page - 1) * pageSize;

  // 累積 WHERE 條件
  const conditions: Prisma.Sql[] = [];

  // 一般搜尋 q：跨多個欄位 OR
  if (q && typeof q === 'string') {
    const qConds = [
      fieldContainsSql(dbBackend, 'title', q),
      fieldContainsSql(dbBackend, 'meeting_name', q),
      fieldContainsSql(dbBackend, 'speaker_name', q),
      committeeContainsSql(dbBackend, q),
      fieldContainsSql(dbBackend, 'meeting_code_str', q),
      fieldContainsSql(dbBackend, 'ai_transcript', q),
      fieldContainsSql(dbBackend, 'ly_transcript', q),
    ];
    conditions.push(Prisma.sql`(${Prisma.join(qConds, ' OR ')})`);
  }

  if (meeting_name && typeof meeting_name === 'string') {
    conditions.push(fieldContainsSql(dbBackend, 'meeting_name', meeting_name));
  }

  if (speaker && typeof speaker === 'string') {
    conditions.push(fieldContainsSql(dbBackend, 'speaker_name', speaker));
  }

  if (committee && typeof committee === 'string') {
    conditions.push(committeeContainsSql(dbBackend, committee));
  }

  if (date_from && typeof date_from === 'string') {
    const fromDate = convertToDate(date_from);
    if (fromDate) {
      conditions.push(Prisma.sql`date >= ${fromDate}`);
    }
  }

  if (date_to && typeof date_to === 'string') {
    const toDate = convertToDate(date_to);
    if (toDate) {
      conditions.push(Prisma.sql`date <= ${toDate}`);
    }
  }

  if (ids && typeof ids === 'string') {
    const ivodIds = ids
      .split(',')
      .map(id => parseInt(id.trim(), 10))
      .filter(id => Number.isInteger(id) && id > 0);
    if (ivodIds.length > 0) {
      conditions.push(Prisma.sql`ivod_id IN (${Prisma.join(ivodIds)})`);
    }
  }

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.empty;

  // sort 只接受兩個白名單值
  const orderByClause =
    sort === 'date_asc'
      ? Prisma.sql`ORDER BY date ASC`
      : Prisma.sql`ORDER BY date DESC`;

  try {
    const dataQuery = Prisma.sql`
      SELECT ivod_id, date, title, meeting_name, committee_names, speaker_name,
             video_length, video_start, video_end, video_type, category,
             meeting_code, meeting_code_str, meeting_time
      FROM ivod_transcripts
      ${whereClause}
      ${orderByClause}
      LIMIT ${pageSize} OFFSET ${skip}
    `;

    const countQuery = Prisma.sql`
      SELECT COUNT(*) AS count
      FROM ivod_transcripts
      ${whereClause}
    `;

    const [data, totalResult] = await Promise.all([
      prisma.$queryRaw<IVODRow[]>(dataQuery),
      prisma.$queryRaw<Array<{ count: bigint | number }>>(countQuery),
    ]);

    const total =
      Array.isArray(totalResult) && totalResult[0]
        ? Number(totalResult[0].count)
        : 0;

    logger.info('Universal search query completed successfully', {
      metadata: {
        resultsCount: Array.isArray(data) ? data.length : 0,
        totalCount: total,
        page,
        pageSize,
        dbBackend,
        usedUniversalSearch: true,
      },
    });

    return {
      data: Array.isArray(data) ? data : [],
      total,
    };
  } catch (error: any) {
    logger.logDatabaseError(error, 'universal_search', {
      params,
      dbBackend,
    });

    throw error;
  }
}

/**
 * Check if we should use universal search for this request.
 * 當有 meeting_name / speaker / committee 任一字串欄位需要 LIKE partial match 時使用。
 */
export function shouldUseUniversalSearch(params: SearchParams): boolean {
  const { meeting_name, speaker, committee } = params;
  return !!(meeting_name || speaker || committee);
}
