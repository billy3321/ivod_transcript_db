/**
 * 共用 Prisma where builder for IVODTranscript 搜尋
 *
 * 三個搜尋端 (pages/api/ivods.ts、pages/api/search.ts fallback、lib/mcp/search.ts)
 * 原本各自 build where 條件，邏輯略有差異但概念一致。
 * 此 builder 收集所有變體並產生一致的 where input。
 */

import type { DbBackend } from '@/lib/utils';
import { createContainsCondition, convertToDate } from '@/lib/utils';

export interface BuildIVODWhereOptions {
  dbBackend: DbBackend;

  /**
   * 一般關鍵字（單一字串）。
   * - queryScope='all'（預設）：搜尋 title / meeting_name / speaker_name / committee_names /
   *   meeting_code_str（若 includeMeetingCode=true） + 逐字稿（受 transcriptionSource 影響）
   * - queryScope='transcript_only'：僅搜尋逐字稿欄位
   */
  query?: string;
  queryScope?: 'all' | 'transcript_only';

  /**
   * 控制逐字稿來源
   * - 'all' (default): ly_transcript OR ai_transcript
   * - 'ly_only': 只搜 ly_transcript
   */
  transcriptionSource?: 'all' | 'ly_only';

  /** 一般 q 搜尋是否包含 meeting_code_str（/api/ivods 行為） */
  includeMeetingCode?: boolean;

  // 單值過濾（partial LIKE，與 q 一起用 AND）
  meetingName?: string;
  speaker?: string;
  committee?: string;

  // Array 過濾（MCP 用，OR 邏輯）
  speakers?: string[];
  committees?: string[];

  // 日期範圍
  dateFrom?: string;
  dateTo?: string;

  // 指定 IVOD IDs 集合
  ivodIds?: number[];

  // 要求有逐字稿存在（依 transcriptionSource 決定條件）
  requireTranscript?: boolean;
}

/**
 * 建立 Prisma IVODTranscript where 條件。
 * 回傳 `{}` 表示無過濾條件。
 */
export function buildIVODWhere(opts: BuildIVODWhereOptions): Record<string, any> {
  const {
    dbBackend,
    query,
    queryScope = 'all',
    transcriptionSource = 'all',
    includeMeetingCode = false,
    meetingName,
    speaker,
    committee,
    speakers,
    committees,
    dateFrom,
    dateTo,
    ivodIds,
    requireTranscript = false,
  } = opts;

  const conditions: any[] = [];

  // 關鍵字搜尋
  if (query) {
    const searchFields: any[] = [];

    if (queryScope === 'all') {
      searchFields.push(
        createContainsCondition('title', query, dbBackend),
        createContainsCondition('meeting_name', query, dbBackend),
        createContainsCondition('speaker_name', query, dbBackend),
        createContainsCondition('committee_names', query, dbBackend)
      );
      if (includeMeetingCode) {
        searchFields.push(createContainsCondition('meeting_code_str', query, dbBackend));
      }
    }

    // 逐字稿欄位
    if (transcriptionSource === 'ly_only') {
      searchFields.push(createContainsCondition('ly_transcript', query, dbBackend));
    } else {
      searchFields.push(
        createContainsCondition('ai_transcript', query, dbBackend),
        createContainsCondition('ly_transcript', query, dbBackend)
      );
    }

    conditions.push({ OR: searchFields });
  }

  // 單值過濾（與 q 一起 AND）
  if (meetingName) {
    conditions.push(createContainsCondition('meeting_name', meetingName, dbBackend));
  }

  if (speaker) {
    conditions.push(createContainsCondition('speaker_name', speaker, dbBackend));
  }

  if (committee) {
    conditions.push(createContainsCondition('committee_names', committee, dbBackend));
  }

  // Array 過濾（OR within group）
  if (speakers && speakers.length > 0) {
    const sConds = speakers.map(s => createContainsCondition('speaker_name', s, dbBackend));
    conditions.push({ OR: sConds });
  }

  if (committees && committees.length > 0) {
    const cConds = committees.map(c => createContainsCondition('committee_names', c, dbBackend));
    conditions.push({ OR: cConds });
  }

  // 日期範圍
  if (dateFrom || dateTo) {
    const dateCondition: any = {};
    if (dateFrom) {
      const d = convertToDate(dateFrom);
      if (d) dateCondition.gte = d;
    }
    if (dateTo) {
      const d = convertToDate(dateTo);
      if (d) dateCondition.lte = d;
    }
    if (Object.keys(dateCondition).length > 0) {
      conditions.push({ date: dateCondition });
    }
  }

  // IVOD IDs
  if (ivodIds && ivodIds.length > 0) {
    conditions.push({ ivod_id: { in: ivodIds } });
  }

  // 要求有逐字稿
  if (requireTranscript) {
    if (transcriptionSource === 'ly_only') {
      conditions.push({ ly_transcript: { not: null } });
    } else {
      conditions.push({
        OR: [{ ly_transcript: { not: null } }, { ai_transcript: { not: null } }],
      });
    }
  }

  return conditions.length > 0 ? { AND: conditions } : {};
}

/**
 * Parse comma-separated id string → number array (filter invalid)
 */
export function parseIvodIds(raw: string | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isInteger(n) && n > 0);
}
