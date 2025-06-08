import type { NextApiRequest, NextApiResponse } from 'next';
// Mock Elasticsearch and Prisma clients before importing the handler
jest.mock('@/lib/elastic', () => ({ 
  __esModule: true, 
  default: { search: jest.fn() },
  esConfig: { index: 'test_index' }
}));
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { iVODTranscript: { findMany: jest.fn() } } }));
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  getDbBackend: jest.fn(),
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logApiError: jest.fn(),
  }
}));
jest.mock('@/lib/searchParser', () => ({
  parseAdvancedSearchQuery: jest.fn(),
  buildElasticsearchQuery: jest.fn(),
  buildDatabaseQuery: jest.fn(),
}));
jest.mock('@/lib/searchHighlight', () => ({
  extractSearchExcerpt: jest.fn(),
  isTranscriptSearch: jest.fn(),
}));
import handler from '@/pages/api/search';
import client from '@/lib/elastic';
import prisma from '@/lib/prisma';
import { getDbBackend } from '@/lib/utils';
import { parseAdvancedSearchQuery, buildElasticsearchQuery } from '@/lib/searchParser';
import { isTranscriptSearch } from '@/lib/searchHighlight';

describe('GET /api/search', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    req = { 
      query: { q: 'test' },
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      url: '/api/search'
    };
    res = { status: statusMock };
    
    // Enable Elasticsearch for tests
    process.env.ENABLE_ELASTICSEARCH = 'true';
    
    // Setup default mock returns
    (parseAdvancedSearchQuery as jest.Mock).mockReturnValue({
      hasAdvancedSyntax: false,
      parseSuccess: true
    });
    (buildElasticsearchQuery as jest.Mock).mockReturnValue({ match_all: {} });
    (isTranscriptSearch as jest.Mock).mockReturnValue(true);
    
    // Mock buildDatabaseQuery to return the expected database query
    const { buildDatabaseQuery } = require('@/lib/searchParser');
    (buildDatabaseQuery as jest.Mock).mockImplementation((parsedQuery, dbBackend) => {
      if (dbBackend === 'sqlite') {
        return {
          OR: [
            { ai_transcript: { contains: 'test' } },
            { ly_transcript: { contains: 'test' } },
          ]
        };
      } else {
        return {
          OR: [
            { ai_transcript: { contains: 'test', mode: 'insensitive' } },
            { ly_transcript: { contains: 'test', mode: 'insensitive' } },
          ]
        };
      }
    });
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns data from Elasticsearch when ES is available', async () => {
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockResolvedValue({
      hits: {
        hits: [
          { _source: { ivod_id: 1, ai_transcript: 'foo', ly_transcript: null } },
          { _source: { ivod_id: 2, ai_transcript: null, ly_transcript: 'bar' } },
        ],
      },
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockSearch).toHaveBeenCalledWith({
      index: expect.any(String),
      body: expect.any(Object),
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [
        { id: 1, transcript: 'foo' },
        { id: 2, transcript: 'bar' },
      ],
      success: true,
      meta: {
        fallback: false,
        parsed: expect.any(Object)
      }
    });
  });

  it('falls back to DB when Elasticsearch throws error (PostgreSQL/MySQL)', async () => {
    (getDbBackend as jest.Mock).mockReturnValue('postgresql');
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockRejectedValue(new Error('ES down'));
    const mockFind = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFind.mockResolvedValue([
      { ivod_id: 3, ai_transcript: null, ly_transcript: 'fallback' },
    ]);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockSearch).toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledWith({
      where: {
        OR: [
          { ai_transcript: { contains: 'test', mode: 'insensitive' } },
          { ly_transcript: { contains: 'test', mode: 'insensitive' } },
        ],
      },
      select: { ivod_id: true, ai_transcript: true, ly_transcript: true },
      take: 100
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [{ id: 3, transcript: 'fallback' }],
      success: true,
      meta: {
        fallback: true,
        parsed: expect.any(Object)
      }
    });
  });

  it('handles query array by taking first element', async () => {
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockResolvedValue({
      hits: { hits: [] },
    });
    
    req = { 
      query: { q: ['valid query', 'second element'] },
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      url: '/api/search'
    };
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [],
      success: true,
      meta: {
        fallback: false,
        parsed: expect.any(Object)
      }
    });
  });

  it('returns empty results on empty query string', async () => {
    req = { 
      query: { q: '' },
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      url: '/api/search'
    };
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ 
      data: [],
      success: true,
      meta: {
        fallback: false,
        parsed: {
          hasAdvancedSyntax: false,
          parseSuccess: true
        }
      }
    });
  });

  it('returns empty results on missing query parameter', async () => {
    req = { 
      query: {},
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      url: '/api/search'
    };
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ 
      data: [],
      success: true,
      meta: {
        fallback: false,
        parsed: {
          hasAdvancedSyntax: false,
          parseSuccess: true
        }
      }
    });
  });

  it('prioritizes ly_transcript over ai_transcript in ES results', async () => {
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockResolvedValue({
      hits: {
        hits: [
          { _source: { ivod_id: 1, ai_transcript: 'ai content', ly_transcript: 'ly content' } },
          { _source: { ivod_id: 2, ai_transcript: '', ly_transcript: 'ly only' } },
          { _source: { ivod_id: 3, ai_transcript: null, ly_transcript: 'ly null ai' } },
        ],
      },
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(jsonMock).toHaveBeenCalledWith({
      data: [
        { id: 1, transcript: 'ly content', excerpt: undefined },
        { id: 2, transcript: 'ly only', excerpt: undefined },
        { id: 3, transcript: 'ly null ai', excerpt: undefined },
      ],
      success: true,
      meta: {
        fallback: false,
        parsed: expect.any(Object)
      }
    });
  });

  it('falls back to DB when Elasticsearch throws error (SQLite)', async () => {
    (getDbBackend as jest.Mock).mockReturnValue('sqlite');
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockRejectedValue(new Error('ES down'));
    const mockFind = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFind.mockResolvedValue([
      { ivod_id: 3, ai_transcript: null, ly_transcript: 'fallback' },
    ]);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockSearch).toHaveBeenCalled();
    expect(mockFind).toHaveBeenCalledWith({
      where: {
        OR: [
          { ai_transcript: { contains: 'test' } },
          { ly_transcript: { contains: 'test' } },
        ],
      },
      select: { ivod_id: true, ai_transcript: true, ly_transcript: true },
      take: 100
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [{ id: 3, transcript: 'fallback' }],
      success: true,
      meta: {
        fallback: true,
        parsed: expect.any(Object)
      }
    });
  });

  it('prioritizes ly_transcript over ai_transcript in DB fallback', async () => {
    (getDbBackend as jest.Mock).mockReturnValue('postgresql');
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockRejectedValue(new Error('ES unavailable'));
    const mockFind = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFind.mockResolvedValue([
      { ivod_id: 1, ai_transcript: 'ai content', ly_transcript: 'ly content' },
      { ivod_id: 2, ai_transcript: '', ly_transcript: 'ly only' },
      { ivod_id: 3, ai_transcript: null, ly_transcript: 'ly null ai' },
    ]);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(jsonMock).toHaveBeenCalledWith({
      data: [
        { id: 1, transcript: 'ly content', excerpt: undefined },
        { id: 2, transcript: 'ly only', excerpt: undefined },
        { id: 3, transcript: 'ly null ai', excerpt: undefined },
      ],
      success: true,
      meta: {
        fallback: true,
        parsed: expect.any(Object)
      }
    });
  });

  it('handles Elasticsearch connection timeout', async () => {
    (getDbBackend as jest.Mock).mockReturnValue('postgresql');
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockRejectedValue(new Error('Connection timeout'));
    const mockFind = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFind.mockResolvedValue([]);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFind).toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [],
      success: true,
      meta: {
        fallback: true,
        parsed: expect.any(Object)
      }
    });
  });

  it('handles database error during fallback', async () => {
    (getDbBackend as jest.Mock).mockReturnValue('postgresql');
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockRejectedValue(new Error('ES down'));
    const mockFind = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFind.mockRejectedValue(new Error('Database error'));

    await handler(req as NextApiRequest, res as NextApiResponse);
    
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ 
      success: false, 
      error: 'Internal server error'
    });
  });

  it('handles empty results from Elasticsearch', async () => {
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockResolvedValue({
      hits: { hits: [] },
    });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [],
      success: true,
      meta: {
        fallback: false,
        parsed: expect.any(Object)
      }
    });
  });

  it('handles empty results from database fallback', async () => {
    (getDbBackend as jest.Mock).mockReturnValue('postgresql');
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockRejectedValue(new Error('ES error'));
    const mockFind = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFind.mockResolvedValue([]);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [],
      success: true,
      meta: {
        fallback: true,
        parsed: expect.any(Object)
      }
    });
  });

  it('constructs proper ES query', async () => {
    const mockSearch = (client.search as unknown) as jest.Mock;
    mockSearch.mockResolvedValue({
      hits: { hits: [] },
    });

    req = { 
      query: { q: 'search term' },
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      url: '/api/search'
    };
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockSearch).toHaveBeenCalledWith({
      index: expect.any(String),
      body: expect.objectContaining({
        query: expect.any(Object),
        _source: ['ivod_id', 'ai_transcript', 'ly_transcript'],
        size: 100
      }),
    });
  });
});