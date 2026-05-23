// 簡化版 MCP 工具實作 - 僅使用資料庫搜尋，避免 Elasticsearch 編譯問題
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getDbBackend } from '@/lib/utils';
import { buildIVODWhere } from '@/lib/search/where-builder';
import { extractSearchExcerpt, isTranscriptSearch } from '@/lib/searchHighlight';
import { logger } from '@/lib/logger';
import { TranscriptResult, FullTranscriptResult, SearchParams } from './types';

// MCP 搜尋參數驗證（符合設計文檔的完整 schema）
const MCPSearchSchema = z.object({
  query: z.string().optional(),
  speakers: z.array(z.string()).optional(),
  committees: z.array(z.string()).optional(),
  meeting_name: z.string().optional(),
  mode: z.enum([
    'keyword_all_fields', 
    'keyword_transcript_only'
  ]).default('keyword_transcript_only'),
  transcription_source: z.enum(['all', 'ly_only']).default('all'),
  max_excerpt_length: z.number().min(100).max(3000).default(1200),
  max_context_sentences: z.number().min(0).max(10).default(5),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  max_results: z.number().max(50).default(20),
  cursor: z.string().optional(),
});

const GetTranscriptSchema = z.object({
  ivod_id: z.number().positive(),
  transcript_type: z.enum(['auto', 'ly_only', 'ai_only']).default('auto')
});

export async function searchTranscripts(args: unknown): Promise<{ content: any[], nextCursor?: string }> {
  const startTime = Date.now();
  
  try {
    const params = MCPSearchSchema.parse(args);
    
    logger.info('MCP search_transcripts request', {
      metadata: { params: JSON.stringify(params) }
    });

    // 根據搜尋模式執行對應的搜尋邏輯
    const { results, nextCursor } = await executeSearch(params);

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
        search_time_ms: Date.now() - startTime,
        success: true,
        search_mode: params.mode,
        note: `Using ${params.mode} search mode with Prisma query.`,
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
      }],
      nextCursor
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

// 搜尋模式分派邏輯（符合設計文檔）
async function executeSearch(params: z.infer<typeof MCPSearchSchema>): Promise<{ results: any[], nextCursor?: string }> {
  switch (params.mode) {
    case 'keyword_all_fields':
      return await searchAllFields(params);
    case 'keyword_transcript_only':
      return await searchTranscriptOnly(params);
    default:
      return await searchTranscriptOnly(params);
  }
}

// 關鍵字搜尋 - 全部欄位
async function searchAllFields(params: z.infer<typeof MCPSearchSchema>): Promise<{ results: any[], nextCursor?: string }>{
  const whereConditions = buildSearchConditions(params, true); // includeAllFields = true
  
  return await performPrismaQuery(params, whereConditions);
}

// 關鍵字搜尋 - 僅逐字稿
async function searchTranscriptOnly(params: z.infer<typeof MCPSearchSchema>): Promise<{ results: any[], nextCursor?: string }> {
  const whereConditions = buildSearchConditions(params, false); // includeAllFields = false
  
  return await performPrismaQuery(params, whereConditions);
}

// 執行 Prisma 查詢
async function performPrismaQuery(params: z.infer<typeof MCPSearchSchema>, whereConditions: any): Promise<{ results: any[], nextCursor?: string }> {
  const take = params.max_results;
  
  // 優雅處理無效游標
  let cursor: { ivod_id: number } | undefined = undefined;
  if (params.cursor) {
    const cursorId = parseInt(params.cursor, 10);
    if (isNaN(cursorId) || cursorId <= 0) {
      // 無效游標時從頭開始，而不是拋出錯誤
      logger.warn('Invalid cursor provided, starting from beginning', { 
        metadata: { component: 'MCP_Search', cursor: params.cursor }
      });
      cursor = undefined;
    } else {
      cursor = { ivod_id: cursorId };
    }
  }

  const results = await prisma.iVODTranscript.findMany({
    where: whereConditions,
    orderBy: { date: 'desc' },
    take: take + 1,
    cursor,
    skip: cursor ? 1 : 0,
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

  let nextCursor: string | undefined = undefined;
  if (results.length > take) {
    const nextItem = results.pop();
    if (nextItem) {
      nextCursor = nextItem.ivod_id.toString();
    }
  }

  return { results, nextCursor };
}

// 建立搜尋條件 (支援搜尋模式和 MCP array 參數)
function buildSearchConditions(params: z.infer<typeof MCPSearchSchema>, includeAllFields: boolean = true) {
  return buildIVODWhere({
    dbBackend: getDbBackend(),
    query: params.query,
    queryScope: includeAllFields ? 'all' : 'transcript_only',
    transcriptionSource: params.transcription_source,
    meetingName: params.meeting_name,
    speakers: params.speakers,
    committees: params.committees,
    dateFrom: params.date_from,
    dateTo: params.date_to,
    requireTranscript: true,
  });
}

// 格式化搜尋結果並提取段落
async function formatTranscriptResult(item: any, params: any): Promise<TranscriptResult> {
  // 根據 transcription_source 參數選擇逐字稿版本
  let transcript: string | null;
  let source: "ly_transcript" | "ai_transcript";
  
  if (params.transcription_source === 'ly_only') {
    // 僅使用立法院官方逐字稿
    transcript = item.ly_transcript;
    source = "ly_transcript";
  } else {
    // 優先使用立法院官方逐字稿，如果沒有則使用AI逐字稿（預設）
    transcript = item.ly_transcript || item.ai_transcript;
    source = item.ly_transcript ? "ly_transcript" : "ai_transcript";
  }

  // 提取相關段落（使用 params 中的細粒度控制參數）
  const searchTerms = getAllSearchTerms(params);
  const excerpts = await extractContextualExcerpts(transcript, searchTerms, {
    contextSentences: params.max_context_sentences,
    maxExcerpts: Math.max(3, Math.ceil(params.max_excerpt_length / 400)), // 至少3個段落，最多根據長度調整
    maxLength: params.max_excerpt_length
  });

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

// 提取包含上下文的逐字稿段落
async function extractContextualExcerpts(
  transcript: string | null,
  searchTerms: string[],
  options: {
    contextSentences: number;
    maxExcerpts: number;
    maxLength: number;
  }
): Promise<any[]> {
  if (!transcript || searchTerms.length === 0) return [];

  // 將逐字稿按句子分割
  const sentences = transcript.match(/[^.!?]+[.!?]+/g) || [];
  if (sentences.length === 0) return [];

  const excerpts: any[] = [];

  for (const term of searchTerms) {
    if (!term || !isTranscriptSearch(term)) continue;

    for (let i = 0; i < sentences.length; i++) {
      if (sentences[i].includes(term)) {
        const start = Math.max(0, i - options.contextSentences);
        const end = Math.min(sentences.length, i + options.contextSentences + 1);
        
        let contextText = sentences.slice(start, end).join(' ').trim();
        
        // 控制段落長度
        if (contextText.length > options.maxLength) {
          contextText = contextText.substring(0, options.maxLength) + '...';
        }
        
        // 避免重複加入相似的段落
        if (!excerpts.some(e => e.text.includes(contextText.substring(0, 100)))) {
          excerpts.push({
            text: contextText,
            relevance_score: 0.9, // 給予較高的相關性分數
            match_term: term,
            sentence_index: i,
            excerpt_length: contextText.length
          });
        }

        if (excerpts.length >= options.maxExcerpts) break;
      }
    }
    if (excerpts.length >= options.maxExcerpts) break;
  }

  // 依句子順序排序
  return excerpts.sort((a, b) => a.sentence_index - b.sentence_index);
}

function getAllSearchTerms(params: z.infer<typeof MCPSearchSchema>): string[] {
  const terms: (string | undefined)[] = [];
  
  terms.push(params.query);
  
  if (params.speakers) {
    terms.push(...params.speakers);
  }
  
  if (params.committees) {
    terms.push(...params.committees);
  }

  if (params.meeting_name) {
    terms.push(params.meeting_name);
  }
  
  return terms.filter((term): term is string => !!term);
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
      speaker_name: result.speaker_name || '',
      date: result.date.toISOString().split('T')[0],
      
      meeting_info: {
        title: result.title || '',
        meeting_name: result.meeting_name || '',
        committee_names: parseCommitteeNames(result.committee_names),
        category: result.category || '',
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