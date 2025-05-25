import type { NextApiRequest, NextApiResponse } from 'next';
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { iVODTranscript: { findFirst: jest.fn() } } }));
import handler from '@/pages/api/database-status';
import prisma from '@/lib/prisma';

describe('GET /api/database-status', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    req = { method: 'GET' };
    res = { status: statusMock };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns the latest last_updated timestamp', async () => {
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    const mockData = {
      last_updated: '2023-01-01 10:00:00+08:00'
    };
    
    mockFindFirst.mockResolvedValue(mockData);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindFirst).toHaveBeenCalledWith({
      select: {
        last_updated: true,
      },
      orderBy: {
        last_updated: 'desc',
      },
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ 
      lastUpdated: '2023-01-01 10:00:00+08:00' 
    });
  });

  it('returns 404 when no data found', async () => {
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    
    mockFindFirst.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'No data found' });
  });

  it('returns 405 for non-GET methods', async () => {
    req.method = 'POST';

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(405);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Method not allowed' });
  });

  it('handles database errors gracefully', async () => {
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    
    mockFindFirst.mockRejectedValue(new Error('Database connection failed'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Database connection failed' });
  });
});