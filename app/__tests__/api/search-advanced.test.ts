import { createMocks } from 'node-mocks-http';
import searchHandler from '@/pages/api/search';
import { parseAdvancedSearchQuery } from '@/lib/searchParser';

// Mock the search parser
jest.mock('@/lib/searchParser', () => ({
  parseAdvancedSearchQuery: jest.fn(),
  buildElasticsearchQuery: jest.fn(),
  buildDatabaseQuery: jest.fn(),
}));

// Mock Elasticsearch client
jest.mock('@/lib/elastic', () => ({
  __esModule: true,
  default: { search: jest.fn() },
  esConfig: { index: 'test_index' }
}));

// Mock Prisma
jest.mock('@/lib/prisma', () => ({
  iVODTranscript: {
    findMany: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    logApiRequest: jest.fn(),
    logApiError: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    logDatabaseError: jest.fn(),
  },
}));

// Mock utils
jest.mock('@/lib/utils', () => ({
  getDbBackend: jest.fn().mockReturnValue('postgresql'),
}));

// Mock search highlight
jest.mock('@/lib/searchHighlight', () => ({
  extractSearchExcerpt: jest.fn(),
  isTranscriptSearch: jest.fn().mockReturnValue(true),
}));

import client from '@/lib/elastic';
import prisma from '@/lib/prisma';
import { buildElasticsearchQuery, buildDatabaseQuery } from '@/lib/searchParser';

const mockClient = client as jest.Mocked<typeof client>;
const mockPrisma = prisma as jest.Mocked<typeof prisma>;
const mockParseAdvancedSearchQuery = parseAdvancedSearchQuery as jest.MockedFunction<typeof parseAdvancedSearchQuery>;
const mockBuildElasticsearchQuery = buildElasticsearchQuery as jest.MockedFunction<typeof buildElasticsearchQuery>;
const mockBuildDatabaseQuery = buildDatabaseQuery as jest.MockedFunction<typeof buildDatabaseQuery>;

describe('/api/search - Advanced Search', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle simple text search', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: 'hello world' },
    });

    // Mock parsed query
    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: ['hello', 'world'],
      quotedPhrases: [],
      excludedTerms: [],
      excludedPhrases: [],
      originalQuery: 'hello world',
      hasAdvancedSyntax: false,
      parseSuccess: true,
    });

    // Mock Elasticsearch query
    mockBuildElasticsearchQuery.mockReturnValue({
      bool: {
        must: [
          {
            multi_match: {
              query: 'hello world',
              fields: ['ai_transcript', 'ly_transcript'],
              type: 'best_fields',
              operator: 'or',
            },
          },
        ],
      },
    });

    // Mock Elasticsearch response
    mockClient.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              ivod_id: 123,
              ai_transcript: 'hello world transcript',
              ly_transcript: null,
            },
          },
        ],
      },
    } as any);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.data).toHaveLength(1);
    expect(responseData.data[0].id).toBe(123);
    expect(responseData.meta.fallback).toBe(false);
    expect(responseData.meta.parsed.hasAdvancedSyntax).toBe(false);
  });

  it('should handle quoted phrase search', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: '"exact phrase"' },
    });

    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: [],
      quotedPhrases: ['exact phrase'],
      excludedTerms: [],
      excludedPhrases: [],
      originalQuery: '"exact phrase"',
      hasAdvancedSyntax: true,
      parseSuccess: true,
    });

    mockBuildElasticsearchQuery.mockReturnValue({
      bool: {
        must: [
          {
            multi_match: {
              query: 'exact phrase',
              fields: ['ai_transcript', 'ly_transcript'],
              type: 'phrase',
            },
          },
        ],
      },
    });

    mockClient.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              ivod_id: 456,
              ai_transcript: 'this contains exact phrase here',
              ly_transcript: null,
            },
          },
        ],
      },
    } as any);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.meta.parsed.hasAdvancedSyntax).toBe(true);
    expect(mockBuildElasticsearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        quotedPhrases: ['exact phrase'],
        hasAdvancedSyntax: true,
      })
    );
  });

  it('should handle field-specific search', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: 'title:"meeting" speaker:"john"' },
    });

    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: [],
      quotedPhrases: [],
      title: ['meeting'],
      speaker: ['john'],
      excludedTerms: [],
      excludedPhrases: [],
      originalQuery: 'title:"meeting" speaker:"john"',
      hasAdvancedSyntax: true,
      parseSuccess: true,
    });

    mockBuildElasticsearchQuery.mockReturnValue({
      bool: {
        must: [
          {
            multi_match: {
              query: 'meeting',
              fields: ['title'],
              type: 'best_fields',
            },
          },
          {
            multi_match: {
              query: 'john',
              fields: ['speaker_name'],
              type: 'best_fields',
            },
          },
        ],
      },
    });

    mockClient.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              ivod_id: 789,
              ai_transcript: 'transcript content',
              ly_transcript: null,
            },
          },
        ],
      },
    } as any);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockBuildElasticsearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        title: ['meeting'],
        speaker: ['john'],
        hasAdvancedSyntax: true,
      })
    );
  });

  it('should handle exclusion search', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: 'hello -world -"bad phrase"' },
    });

    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: ['hello'],
      quotedPhrases: [],
      excludedTerms: ['world'],
      excludedPhrases: ['bad phrase'],
      originalQuery: 'hello -world -"bad phrase"',
      hasAdvancedSyntax: true,
      parseSuccess: true,
    });

    mockBuildElasticsearchQuery.mockReturnValue({
      bool: {
        must: [
          {
            multi_match: {
              query: 'hello',
              fields: ['ai_transcript', 'ly_transcript'],
              type: 'best_fields',
            },
          },
        ],
        must_not: [
          {
            multi_match: {
              query: 'world',
              fields: ['ai_transcript', 'ly_transcript'],
              type: 'best_fields',
            },
          },
          {
            multi_match: {
              query: 'bad phrase',
              fields: ['ai_transcript', 'ly_transcript'],
              type: 'phrase',
            },
          },
        ],
      },
    });

    mockClient.search.mockResolvedValue({
      hits: {
        hits: [
          {
            _source: {
              ivod_id: 101,
              ai_transcript: 'hello there',
              ly_transcript: null,
            },
          },
        ],
      },
    } as any);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockBuildElasticsearchQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        generalTerms: ['hello'],
        excludedTerms: ['world'],
        excludedPhrases: ['bad phrase'],
        hasAdvancedSyntax: true,
      })
    );
  });

  it('should fallback to database search when Elasticsearch fails', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: 'test query' },
    });

    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: ['test', 'query'],
      quotedPhrases: [],
      excludedTerms: [],
      excludedPhrases: [],
      originalQuery: 'test query',
      hasAdvancedSyntax: false,
      parseSuccess: true,
    });

    mockBuildElasticsearchQuery.mockReturnValue({
      bool: {
        must: [
          {
            multi_match: {
              query: 'test query',
              fields: ['ai_transcript', 'ly_transcript'],
            },
          },
        ],
      },
    });

    // Mock Elasticsearch failure
    mockClient.search.mockRejectedValue(new Error('ES connection failed'));

    // Mock database fallback
    mockBuildDatabaseQuery.mockReturnValue({
      AND: [
        {
          OR: [
            { ai_transcript: { contains: 'test', mode: 'insensitive' } },
            { ly_transcript: { contains: 'test', mode: 'insensitive' } },
          ],
        },
        {
          OR: [
            { ai_transcript: { contains: 'query', mode: 'insensitive' } },
            { ly_transcript: { contains: 'query', mode: 'insensitive' } },
          ],
        },
      ],
    });

    mockPrisma.iVODTranscript.findMany.mockResolvedValue([
      {
        ivod_id: 202,
        ai_transcript: 'test query result',
        ly_transcript: null,
      },
    ]);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.data).toHaveLength(1);
    expect(responseData.data[0].id).toBe(202);
    expect(responseData.meta.fallback).toBe(true);
    expect(mockBuildDatabaseQuery).toHaveBeenCalledWith(
      expect.objectContaining({
        generalTerms: ['test', 'query'],
        hasAdvancedSyntax: false,
      }),
      'postgresql'
    );
  });

  it('should handle parse failure gracefully', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: 'complex query' },
    });

    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: ['complex query'], // Fallback to simple search
      quotedPhrases: [],
      excludedTerms: [],
      excludedPhrases: [],
      originalQuery: 'complex query',
      hasAdvancedSyntax: false,
      parseSuccess: false,
    });

    mockBuildElasticsearchQuery.mockReturnValue({
      bool: {
        must: [
          {
            multi_match: {
              query: 'complex query',
              fields: ['ai_transcript', 'ly_transcript'],
            },
          },
        ],
      },
    });

    mockClient.search.mockResolvedValue({
      hits: {
        hits: [],
      },
    } as any);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    const responseData = JSON.parse(res._getData());
    expect(responseData.meta.parsed.parseSuccess).toBe(false);
    expect(responseData.meta.parsed.hasAdvancedSyntax).toBe(false);
  });

  it('should handle array queries by taking first element', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      query: { q: ['query1', 'query2'] },
    });

    mockParseAdvancedSearchQuery.mockReturnValue({
      generalTerms: ['query1'],
      hasAdvancedSyntax: false,
      parseSuccess: true,
      fieldTerms: {},
      excludeTerms: [],
    });

    mockBuildElasticsearchQuery.mockReturnValue({
      multi_match: {
        query: 'query1',
        fields: ['ai_transcript', 'ly_transcript'],
      },
    });

    mockClient.search.mockResolvedValue({
      hits: {
        hits: [],
      },
    } as any);

    await searchHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockParseAdvancedSearchQuery).toHaveBeenCalledWith('query1');
  });
});