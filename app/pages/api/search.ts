import type { NextApiRequest, NextApiResponse } from 'next';
import client, { esConfig } from '@/lib/elastic';
import prisma from '@/lib/prisma';
import { getDbBackend } from '@/lib/utils';
import { parseAdvancedSearchQuery, buildElasticsearchQuery, buildDatabaseQuery } from '@/lib/searchParser';
import { extractSearchExcerpt, isTranscriptSearch } from '@/lib/searchHighlight';
import { logger } from '@/lib/logger';
import { 
  withErrorHandler, 
  validateMethod, 
  parseStringParam, 
  createSuccessResponse,
  createErrorResponse,
  APIResponse 
} from '@/lib/api-middleware';

interface SearchResult {
  id: number;
  transcript: string | null;
  excerpt?: {
    text: string;
    plainText: string;
    hasMatch: boolean;
    matchPosition: number;
  };
}

async function searchHandler(req: NextApiRequest, res: NextApiResponse): Promise<APIResponse<SearchResult[]>> {
  validateMethod(req, ['GET']);
  
  const q = parseStringParam(req.query.q, 'q', '');
  
  // If query is empty, return empty results
  if (!q.trim()) {
    return createSuccessResponse([], {
      fallback: false,
      parsed: {
        hasAdvancedSyntax: false,
        parseSuccess: true
      }
    } as any);
  }

  // Parse the advanced search query
  const parsedQuery = parseAdvancedSearchQuery(q);
  
  let hits: SearchResult[] = [];
  let usedES = true;
  
  // Check if Elasticsearch is enabled
  const esEnabled = process.env.ENABLE_ELASTICSEARCH !== 'false';
  
  if (!esEnabled) {
    logger.info('Elasticsearch disabled, using database search', {
      metadata: {
        query: q,
        reason: 'ENABLE_ELASTICSEARCH=false'
      }
    });
    usedES = false;
  } else {
    try {
      // Try Elasticsearch with advanced query building
      const esQuery = buildElasticsearchQuery(parsedQuery);
      const result = await client.search({
        index: esConfig.index,
        body: {
          query: esQuery,
          _source: ['ivod_id', 'ai_transcript', 'ly_transcript'],
          size: 100
        },
      });
      
      hits = result.hits.hits.map(hit => {
        // 優先使用 ly_transcript，如果沒有才使用 ai_transcript
        const lyTranscript = (hit._source as any).ly_transcript;
        const aiTranscript = (hit._source as any).ai_transcript;
        const transcript = lyTranscript || aiTranscript;
        
        const searchExcerpt = (q && q.trim() && isTranscriptSearch(q as string)) 
          ? extractSearchExcerpt(transcript, q as string)
          : undefined;
        
        return {
          id: (hit._source as any).ivod_id,
          transcript,
          excerpt: searchExcerpt?.hasMatch ? searchExcerpt : undefined
        };
      });
      
      logger.info('Elasticsearch search completed', {
        metadata: {
          query: q,
          resultsCount: hits.length,
          hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax
        }
      });
    } catch (error: any) {
      // Elasticsearch failed or not reachable; fallback to DB search
      logger.warn('Elasticsearch search failed, falling back to database', {
        error: error.message,
        action: 'elasticsearch_fallback',
        metadata: {
          query: q,
          hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax
        }
      });
      usedES = false;
    }
  }
  
  // Use database search if ES is disabled or failed
  if (!usedES) {
    const dbBackend = getDbBackend();
    
    try {
      // Build database query conditions using the advanced parser
      const whereConditions = buildDatabaseQuery(parsedQuery, dbBackend);
      
      const records = await prisma.iVODTranscript.findMany({
        where: whereConditions,
        select: {
          ivod_id: true,
          ai_transcript: true,
          ly_transcript: true,
        },
        take: 100 // Limit results similar to Elasticsearch
      });
      
      hits = records.map(rec => {
        // 優先使用 ly_transcript，如果沒有才使用 ai_transcript
        const transcript = rec.ly_transcript || rec.ai_transcript;
        const searchExcerpt = (q && q.trim() && isTranscriptSearch(q as string))
          ? extractSearchExcerpt(transcript, q as string)
          : undefined;
        
        return {
          id: rec.ivod_id,
          transcript,
          excerpt: searchExcerpt?.hasMatch ? searchExcerpt : undefined
        };
      });
      
      logger.info('Database fallback search completed', {
        metadata: {
          query: q,
          resultsCount: hits.length,
          dbBackend: dbBackend,
          hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax
        }
      });
    } catch (dbError: any) {
      // 檢查是否為表格不存在的錯誤
      if (dbError.message && dbError.message.includes('does not exist')) {
        logger.warn('Database table does not exist for search, returning empty result', {
          metadata: { tableName: 'ivod_transcripts', query: q }
        });
        hits = [];
      } else {
        throw createErrorResponse('Database search failed', 500);
      }
    }
  }
  
  return createSuccessResponse(hits, {
    fallback: !usedES,
    parsed: {
      hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax,
      parseSuccess: parsedQuery.parseSuccess
    }
  } as any);
}

export default withErrorHandler(searchHandler);