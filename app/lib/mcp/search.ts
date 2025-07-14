// 簡化版 MCP 工具實作 - 僅使用資料庫搜尋，避免 Elasticsearch 編譯問題
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { getDbBackend, createContainsCondition, convertToDate } from '@/lib/utils';
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
    'keyword_transcript_only', 
    'semantic_search', 
    'hybrid_search'
  ]).default('keyword_transcript_only'),
  transcription_source: z.enum(['all', 'ly_only']).default('all'),
  max_excerpt_length: z.number().min(100).max(3000).default(1200),
  max_context_sentences: z.number().min(0).max(10).default(5),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  max_results: z.number().max(50).default(20),
});

const GetTranscriptSchema = z.object({
  ivod_id: z.number().positive(),
  transcript_type: z.enum(['auto', 'ly_only', 'ai_only']).default('auto')
});

export async function searchTranscripts(args: unknown) {
  const startTime = Date.now();
  
  try {
    const params = MCPSearchSchema.parse(args);
    
    logger.info('MCP search_transcripts request', {
      metadata: { params: JSON.stringify(params) }
    });

    // 根據搜尋模式執行對應的搜尋邏輯
    const results = await executeSearch(params);

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
        note: `Using ${params.mode} search mode with Prisma query.`
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

// 搜尋模式分派邏輯（符合設計文檔）
async function executeSearch(params: z.infer<typeof MCPSearchSchema>): Promise<any[]> {
  switch (params.mode) {
    case 'keyword_all_fields':
      return await searchAllFields(params);
    case 'keyword_transcript_only':
      return await searchTranscriptOnly(params);
    case 'semantic_search':
      // 未來功能：語意搜尋
      throw new Error('Semantic search is not yet implemented');
    case 'hybrid_search':
      // 未來功能：混合搜尋
      throw new Error('Hybrid search is not yet implemented');
    default:
      return await searchTranscriptOnly(params);
  }
}

// 關鍵字搜尋 - 全部欄位
async function searchAllFields(params: z.infer<typeof MCPSearchSchema>): Promise<any[]> {
  const whereConditions = buildSearchConditions(params, true); // includeAllFields = true
  
  return await performPrismaQuery(params, whereConditions);
}

// 關鍵字搜尋 - 僅逐字稿
async function searchTranscriptOnly(params: z.infer<typeof MCPSearchSchema>): Promise<any[]> {
  const whereConditions = buildSearchConditions(params, false); // includeAllFields = false
  
  return await performPrismaQuery(params, whereConditions);
}

// 執行 Prisma 查詢
async function performPrismaQuery(params: z.infer<typeof MCPSearchSchema>, whereConditions: any): Promise<any[]> {
  const results = await prisma.iVODTranscript.findMany({
    where: whereConditions,
    orderBy: { date: 'desc' },
    take: params.max_results,
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

// 建立搜尋條件 (支援搜尋模式和 MCP array 參數)
function buildSearchConditions(params: z.infer<typeof MCPSearchSchema>, includeAllFields: boolean = true) {
  const dbBackend = getDbBackend();
  const conditions: any[] = [];

  // 關鍵字搜尋（根據模式決定搜尋範圍）
  if (params.query) {
    const searchFields = [];
    
    if (includeAllFields) {
      // 搜尋全部欄位
      searchFields.push(
        createContainsCondition('title', params.query, dbBackend),
        createContainsCondition('meeting_name', params.query, dbBackend),
        createContainsCondition('speaker_name', params.query, dbBackend),
        createContainsCondition('committee_names', params.query, dbBackend)
      );
    }
    
    // 根據 transcription_source 參數決定搜尋的逐字稿欄位
    if (params.transcription_source === 'ly_only') {
      // 僅搜尋立法院官方逐字稿
      searchFields.push(
        createContainsCondition('ly_transcript', params.query, dbBackend)
      );
    } else {
      // 搜尋所有逐字稿欄位（預設）
      searchFields.push(
        createContainsCondition('ai_transcript', params.query, dbBackend),
        createContainsCondition('ly_transcript', params.query, dbBackend)
      );
    }
    
    conditions.push({ OR: searchFields });
  }

  // 發言人條件（支援 array）
  if (params.speakers && params.speakers.length > 0) {
    const speakerConditions = params.speakers.map((speaker: string) =>
      createContainsCondition('speaker_name', speaker, dbBackend)
    );
    conditions.push({ OR: speakerConditions });
  }

  // 會議名稱條件
  if (params.meeting_name) {
    conditions.push(createContainsCondition('meeting_name', params.meeting_name, dbBackend));
  }

  // 委員會條件（支援 array）
  if (params.committees && params.committees.length > 0) {
    const committeeConditions = params.committees.map((committee: string) =>
      createContainsCondition('committee_names', committee, dbBackend)
    );
    conditions.push({ OR: committeeConditions });
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

  // 根據 transcription_source 參數確保有對應的逐字稿內容
  if (params.transcription_source === 'ly_only') {
    // 僅檢查立法院官方逐字稿
    conditions.push({
      ly_transcript: { not: null }
    });
  } else {
    // 確保有任何逐字稿內容（預設）
    conditions.push({
      OR: [
        { ly_transcript: { not: null } },
        { ai_transcript: { not: null } }
      ]
    });
  }

  return conditions.length > 0 ? { AND: conditions } : {};
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