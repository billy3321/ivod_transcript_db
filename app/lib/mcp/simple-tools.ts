// 簡化版 MCP 工具實作 - 僅使用資料庫搜尋，避免 Elasticsearch 編譯問題
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getDbBackend, createContainsCondition, convertToDate } from '@/lib/utils';
import { universalSearch, shouldUseUniversalSearch } from '@/lib/universal-search';
import { extractSearchExcerpt, isTranscriptSearch } from '@/lib/searchHighlight';
import { logger } from '@/lib/logger';
import { TranscriptResult, FullTranscriptResult, SearchParams } from './types';

// 統一搜尋參數驗證
const UnifiedSearchSchema = z.object({
  query: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  topics: z.array(z.string()).optional(),
  committees: z.array(z.string()).optional(),
  search_mode: z.enum(['intersection', 'union']).default('union'),
  scope: z.enum(['all', 'transcript_only']).default('all'),
  excerpt_length: z.number().min(200).max(2000).default(800),
  context_sentences: z.number().min(1).max(10).default(3),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  limit: z.number().min(1).max(100).default(20)
});

const GetTranscriptSchema = z.object({
  ivod_id: z.number().positive(),
  transcript_type: z.enum(['auto', 'ly_only', 'ai_only']).default('auto')
});

export async function searchTranscripts(args: unknown) {
  const startTime = Date.now();
  
  try {
    const params = UnifiedSearchSchema.parse(args);
    
    logger.info('MCP search_transcripts request', {
      metadata: { params: JSON.stringify(params) }
    });

    let results: any[] = [];

    // 使用資料庫搜尋 (暫時不使用 Elasticsearch)
    results = await performDatabaseSearch(params);

    // 格式化結果並提取段落
    const enrichedResults = await Promise.all(
      results.map(async (item: any) => {
        return await formatTranscriptResult(item, params);
      })
    );

    const response = {
      results: enrichedResults,
      metadata: {
        total_found: enrichedResults.length,
        search_params: params,
        excerpt_config: {
          length: params.excerpt_length,
          context_sentences: params.context_sentences
        },
        search_time_ms: Date.now() - startTime,
        success: true,
        note: "Using database search only (Elasticsearch disabled for compatibility)"
      }
    };

    logger.info('MCP search completed', {
      metadata: { 
        results_count: enrichedResults.length,
        search_time_ms: Date.now() - startTime
      }
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };

  } catch (error) {
    logger.error('Error in MCP searchTranscripts:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          results: [],
          metadata: {
            search_time_ms: Date.now() - startTime,
            success: false
          }
        }, null, 2)
      }]
    };
  }
}

// 資料庫搜尋 (重用現有邏輯)
async function performDatabaseSearch(params: SearchParams): Promise<any[]> {
  // 構建搜尋參數
  const searchParams = {
    q: params.query || '',
    meeting_name: params.committees?.join(' ') || '',
    speaker: params.speakers?.join(' ') || '',
    committee: params.committees?.join(' ') || '',
    date_from: params.date_from || '',
    date_to: params.date_to || '',
    page: 1,
    pageSize: params.limit || 20,
    sort: 'date_desc' as const
  };

  // 檢查是否需要使用 Universal Search
  if (shouldUseUniversalSearch(searchParams)) {
    try {
      const result = await universalSearch(searchParams);
      return result.data;
    } catch (error: any) {
      logger.warn('MCP Universal search failed, falling back to Prisma', {
        error: error.message
      });
    }
  }

  // 標準 Prisma 搜尋
  const whereConditions = buildSearchConditions(params);
  
  const results = await prisma.iVODTranscript.findMany({
    where: whereConditions,
    orderBy: { date: 'desc' },
    take: params.limit || 20,
    select: {
      ivod_id: true,
      title: true,
      speaker_name: true,
      meeting_name: true,
      committee_names: true,
      date: true,
      category: true,
      ly_transcript: true,
      ai_transcript: true,
      ivod_url: true
    }
  });

  return results;
}

// 建立搜尋條件
function buildSearchConditions(params: SearchParams) {
  const dbBackend = getDbBackend();
  const conditions: any[] = [];

  // 關鍵字搜尋
  if (params.query) {
    const searchFields = [];
    
    if (params.scope === 'all') {
      // 搜尋全部欄位
      searchFields.push(
        createContainsCondition('title', params.query, dbBackend),
        createContainsCondition('meeting_name', params.query, dbBackend),
        createContainsCondition('speaker_name', params.query, dbBackend),
        createContainsCondition('committee_names', params.query, dbBackend)
      );
    }
    
    // 總是搜尋逐字稿
    searchFields.push(
      createContainsCondition('ai_transcript', params.query, dbBackend),
      createContainsCondition('ly_transcript', params.query, dbBackend)
    );
    
    conditions.push({ OR: searchFields });
  }

  // 立委條件
  if (params.speakers && params.speakers.length > 0) {
    const speakerConditions = params.speakers.map(speaker =>
      createContainsCondition('speaker_name', speaker, dbBackend)
    );
    conditions.push({ OR: speakerConditions });
  }

  // 話題條件
  if (params.topics && params.topics.length > 0) {
    if (params.search_mode === 'intersection') {
      // 交集模式：所有話題都要出現
      params.topics.forEach(topic => {
        conditions.push({
          OR: [
            createContainsCondition('ai_transcript', topic, dbBackend),
            createContainsCondition('ly_transcript', topic, dbBackend),
            createContainsCondition('title', topic, dbBackend),
            createContainsCondition('meeting_name', topic, dbBackend)
          ]
        });
      });
    } else {
      // 聯集模式：任一話題出現
      const topicConditions: any[] = [];
      params.topics.forEach(topic => {
        topicConditions.push(
          createContainsCondition('ai_transcript', topic, dbBackend),
          createContainsCondition('ly_transcript', topic, dbBackend),
          createContainsCondition('title', topic, dbBackend),
          createContainsCondition('meeting_name', topic, dbBackend)
        );
      });
      conditions.push({ OR: topicConditions });
    }
  }

  // 委員會條件
  if (params.committees && params.committees.length > 0) {
    const committeeConditions = params.committees.map(committee =>
      createContainsCondition('committee_names', committee, dbBackend)
    );
    
    if (params.search_mode === 'intersection') {
      params.committees.forEach(committee => {
        conditions.push(createContainsCondition('committee_names', committee, dbBackend));
      });
    } else {
      conditions.push({ OR: committeeConditions });
    }
  }

  // 日期範圍條件
  if (params.date_from || params.date_to) {
    const dateCondition: any = {};
    if (params.date_from) {
      const fromDate = convertToDate(params.date_from);
      if (fromDate) dateCondition.gte = fromDate;
    }
    if (params.date_to) {
      const toDate = convertToDate(params.date_to);
      if (toDate) dateCondition.lte = toDate;
    }
    conditions.push({ date: dateCondition });
  }

  // 確保有逐字稿內容
  conditions.push({
    OR: [
      { ly_transcript: { not: null } },
      { ai_transcript: { not: null } }
    ]
  });

  return conditions.length > 0 ? { AND: conditions } : {};
}

// 格式化搜尋結果並提取段落
async function formatTranscriptResult(item: any, params: SearchParams): Promise<TranscriptResult> {
  // 選擇最佳逐字稿版本
  const transcript = item.ly_transcript || item.ai_transcript;
  const source: "ly_transcript" | "ai_transcript" = item.ly_transcript ? "ly_transcript" : "ai_transcript";

  // 提取相關段落
  const searchTerms = getAllSearchTerms(params);
  const excerpts = await extractExpandedExcerpts(
    transcript,
    searchTerms,
    {
      excerptLength: params.excerpt_length || 800,
      contextSentences: params.context_sentences || 3,
      maxExcerpts: 3
    }
  );

  return {
    ivod_id: item.ivod_id,
    speaker_name: item.speaker_name,
    date: item.date.toISOString().split('T')[0],
    
    meeting_info: {
      title: item.title,
      meeting_name: item.meeting_name,
      committee_names: parseCommitteeNames(item.committee_names),
      category: item.category
    },
    
    transcript: {
      source: source,
      excerpts: excerpts,
      full_length: transcript?.length || 0
    },
    
    ivod_url: item.ivod_url
  };
}

// 提取擴展段落
async function extractExpandedExcerpts(
  transcript: string | null,
  searchTerms: string[],
  options: {
    excerptLength: number;
    contextSentences: number;
    maxExcerpts: number;
  }
) {
  if (!transcript || searchTerms.length === 0) return [];

  const excerpts: any[] = [];
  
  // 使用現有的 extractSearchExcerpt 邏輯
  for (const term of searchTerms) {
    if (term && isTranscriptSearch(term)) {
      const excerpt = extractSearchExcerpt(transcript, term);
      if (excerpt && excerpt.hasMatch) {
        excerpts.push({
          text: excerpt.text,
          relevance_score: 0.8,
          start_position: excerpt.matchPosition,
          end_position: excerpt.matchPosition + term.length
        });
      }
    }
  }

  // 依相關性排序並限制數量
  return excerpts
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, options.maxExcerpts);
}

function getAllSearchTerms(params: SearchParams): string[] {
  const terms: string[] = [];
  
  if (params.query) terms.push(params.query);
  if (params.speakers) terms.push(...params.speakers);
  if (params.topics) terms.push(...params.topics);
  if (params.committees) terms.push(...params.committees);
  
  return terms.filter(Boolean);
}

function parseCommitteeNames(committeeNames: any): string[] {
  if (!committeeNames) return [];
  
  if (typeof committeeNames === 'string') {
    try {
      const parsed = JSON.parse(committeeNames);
      return Array.isArray(parsed) ? parsed : [committeeNames];
    } catch {
      return [committeeNames];
    }
  }
  
  return Array.isArray(committeeNames) ? committeeNames : [String(committeeNames)];
}

// 取得完整會議逐字稿
export async function getMeetingTranscript(args: unknown) {
  const startTime = Date.now();
  
  try {
    const params = GetTranscriptSchema.parse(args);
    
    logger.info('MCP get_meeting_transcript request', {
      metadata: {
        ivod_id: params.ivod_id,
        transcript_type: params.transcript_type
      }
    });

    const result = await prisma.iVODTranscript.findUnique({
      where: { ivod_id: params.ivod_id },
      select: {
        ivod_id: true,
        title: true,
        speaker_name: true,
        meeting_name: true,
        committee_names: true,
        date: true,
        category: true,
        ly_transcript: true,
        ai_transcript: true,
        ly_status: true,
        ai_status: true,
        ivod_url: true
      }
    });

    if (!result) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            error: `No transcript found for IVOD ID: ${params.ivod_id}`,
            success: false
          }, null, 2)
        }]
      };
    }

    // 選擇逐字稿版本
    let content: string | null = null;
    let source: 'ly_transcript' | 'ai_transcript';

    switch (params.transcript_type) {
      case 'ly_only':
        content = result.ly_transcript;
        source = 'ly_transcript';
        break;
      case 'ai_only':
        content = result.ai_transcript;
        source = 'ai_transcript';
        break;
      case 'auto':
      default:
        if (result.ly_transcript && result.ly_status === 'success') {
          content = result.ly_transcript;
          source = 'ly_transcript';
        } else if (result.ai_transcript && result.ai_status === 'success') {
          content = result.ai_transcript;
          source = 'ai_transcript';
        } else {
          content = result.ly_transcript || result.ai_transcript;
          source = result.ly_transcript ? 'ly_transcript' : 'ai_transcript';
        }
    }

    const response: FullTranscriptResult = {
      ivod_id: result.ivod_id,
      speaker_name: result.speaker_name,
      date: result.date.toISOString().split('T')[0],
      
      meeting_info: {
        title: result.title,
        meeting_name: result.meeting_name,
        committee_names: parseCommitteeNames(result.committee_names),
        category: result.category
      },
      
      transcript: {
        source: source,
        content: content,
        full_length: content?.length || 0
      },
      
      ivod_url: result.ivod_url
    };

    logger.info('MCP get_meeting_transcript completed', {
      metadata: {
        ivod_id: params.ivod_id,
        source: source,
        content_length: content?.length || 0,
        search_time_ms: Date.now() - startTime
      }
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ 
          result: response, 
          success: true,
          metadata: {
            search_time_ms: Date.now() - startTime
          }
        }, null, 2)
      }]
    };

  } catch (error) {
    logger.error('Error in MCP getMeetingTranscript:', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    });
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: error instanceof Error ? error.message : 'Unknown error',
          success: false,
          metadata: {
            search_time_ms: Date.now() - startTime
          }
        }, null, 2)
      }]
    };
  }
}