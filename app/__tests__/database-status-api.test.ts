import type { NextApiRequest, NextApiResponse } from 'next';
jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { iVODTranscript: { findFirst: jest.fn() } },
}));
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
    req = { method: 'GET', headers: {} };
    res = { status: statusMock, headersSent: false } as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns wrapped lastUpdated for string input', async () => {
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    mockFindFirst.mockResolvedValue({ last_updated: '2023-01-01 10:00:00' });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindFirst).toHaveBeenCalledWith({
      select: { last_updated: true },
      orderBy: { last_updated: 'desc' },
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: { lastUpdated: '2023-01-01T02:00:00.000+08:00' },
      success: true,
    });
  });

  it('returns wrapped lastUpdated for Date input', async () => {
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    mockFindFirst.mockResolvedValue({ last_updated: new Date('2023-01-01 10:00:00') });

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: { lastUpdated: '2023-01-01T02:00:00.000+08:00' },
      success: true,
    });
  });

  it('returns 404 when no data found', async () => {
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    mockFindFirst.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'No data found',
    });
  });

  it('returns 405 for non-GET methods', async () => {
    req.method = 'POST';

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(405);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('handles database errors without leaking message in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    const mockFindFirst = (prisma.iVODTranscript.findFirst as unknown) as jest.Mock;
    mockFindFirst.mockRejectedValue(new Error('Database connection failed'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Internal server error',
    });
    (process.env as any).NODE_ENV = originalEnv;
  });
});
