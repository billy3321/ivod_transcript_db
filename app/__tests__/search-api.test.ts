import type { NextApiRequest, NextApiResponse } from 'next';
// Mock Elasticsearch and Prisma clients before importing the handler
jest.mock('@/lib/elastic', () => ({ __esModule: true, default: { search: jest.fn() } }));
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { iVODTranscript: { findMany: jest.fn() } } }));
import handler from '@/pages/api/search';
import client from '@/lib/elastic';
import prisma from '@/lib/prisma';

describe('GET /api/search', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    req = { query: { q: 'test' } };
    res = { status: statusMock };
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
      index: process.env.NEXT_PUBLIC_ES_INDEX,
      body: expect.any(Object),
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [
        { id: 1, transcript: 'foo' },
        { id: 2, transcript: 'bar' },
      ],
      fallback: false,
    });
  });

  it('falls back to DB when Elasticsearch throws error', async () => {
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
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [{ id: 3, transcript: 'fallback' }],
      fallback: true,
    });
  });

  it('returns 400 on invalid query array', async () => {
    req = { query: { q: ['a', 'b'] } };
    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid query' });
  });
});