import type { NextApiRequest, NextApiResponse } from 'next';
import client from '@/lib/elastic';
import prisma from '@/lib/prisma';
import { getDbBackend } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { parseAdvancedSearchQuery, buildElasticsearchQuery, buildDatabaseQuery } from '@/lib/searchParser';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { q = '' } = req.query;
  
  if (Array.isArray(q)) {
    logger.warn('Invalid query parameter received', {
      method: req.method,
      url: req.url,
      metadata: {
        query: q
      }
    });
    res.status(400).json({ error: 'Invalid query' });
    return;
  }

  // Parse the advanced search query
  const parsedQuery = parseAdvancedSearchQuery(q as string);
  
  // Log the search request with parsed information
  logger.logApiRequest(req, { 
    query: q,
    searchType: 'transcript',
    hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax,
    parseSuccess: parsedQuery.parseSuccess
  });
  
  let hits: Array<{ id: number; transcript: string | null }> = [];
  let usedES = true;
  
  try {
    // Try Elasticsearch with advanced query building
    const esQuery = buildElasticsearchQuery(parsedQuery);
    const result = await client.search({
      index: process.env.NEXT_PUBLIC_ES_INDEX,
      body: {
        query: esQuery,
        _source: ['ivod_id', 'ai_transcript', 'ly_transcript'],
        size: 100
      },
    });
    
    hits = result.hits.hits.map(hit => ({
      id: (hit._source as any).ivod_id,
      transcript: (hit._source as any).ai_transcript || (hit._source as any).ly_transcript,
    }));
    
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
      
      hits = records.map(rec => ({
        id: rec.ivod_id,
        transcript: rec.ai_transcript || rec.ly_transcript,
      }));
      
      logger.info('Database fallback search completed', {
        metadata: {
          query: q,
          resultsCount: hits.length,
          dbBackend: dbBackend,
          hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax
        }
      });
    } catch (dbError: any) {
      logger.logDatabaseError(dbError, 'search', {
        query: q,
        parsedQuery: parsedQuery
      });
      res.status(500).json({ error: 'Search failed' });
      return;
    }
  }
  
  logger.info('Search completed successfully', {
    metadata: {
      query: q,
      resultsCount: hits.length,
      usedElasticsearch: usedES,
      hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax
    }
  });
  
  res.status(200).json({ 
    data: hits, 
    fallback: !usedES,
    parsed: {
      hasAdvancedSyntax: parsedQuery.hasAdvancedSyntax,
      parseSuccess: parsedQuery.parseSuccess
    }
  });
}