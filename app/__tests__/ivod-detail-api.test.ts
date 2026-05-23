import type { NextApiRequest, NextApiResponse } from 'next';
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { iVODTranscript: { findUnique: jest.fn() } } }));
import handler from '@/pages/api/ivods/[id]';
import prisma from '@/lib/prisma';

describe('GET /api/ivods/[id]', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    req = { query: {}, method: 'GET', headers: {} };
    res = { status: statusMock, headersSent: false } as any;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns IVOD data wrapped in success response for valid id', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    const mockData = {
      ivod_id: 123,
      date: '2023-01-01',
      title: 'Test Title',
      meeting_name: 'Test Meeting',
      committee_names: ['Committee A'],
      speaker_name: 'Test Speaker',
      video_length: '30:00',
      video_start: '09:00:00',
      video_end: '09:30:00',
      video_type: 'speech',
      category: '質詢',
      meeting_code: 'TEST001',
      meeting_code_str: null,
      meeting_time: '2023-01-01 09:00:00+08:00',
      ivod_url: 'https://example.com/ivod',
      video_url: 'https://example.com/video',
      ai_transcript: 'AI generated transcript',
      ly_transcript: 'Legislative Yuan transcript',
      ai_status: 'success',
      ly_status: 'success',
      last_updated: '2023-01-01 10:00:00+08:00',
    };

    req.query = { id: '123' };
    mockFindUnique.mockResolvedValue(mockData);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { ivod_id: 123 },
      select: expect.any(Object),
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: mockData,
      success: true,
    });
  });

  it('returns 404 when IVOD not found', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    req.query = { id: '999' };
    mockFindUnique.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Not found',
    });
  });

  it('returns 400 for missing id', async () => {
    req.query = {};

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 400 for array id parameter that fails int parse', async () => {
    // parseIntParam picks first element; if non-numeric, it throws
    req.query = { id: ['abc', '456'] };

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 400 for non-numeric id (e.g. "abc")', async () => {
    req.query = { id: 'abc' };

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('returns 400 for zero id', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    req.query = { id: '0' };

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: expect.stringMatching(/positive integer/i),
      })
    );
  });

  it('returns 400 for negative id', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    req.query = { id: '-5' };

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });

  it('handles database errors without leaking error message in non-dev mode', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    req.query = { id: '123' };
    mockFindUnique.mockRejectedValue(new Error('Database connection failed'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Database query failed',
    });
    (process.env as any).NODE_ENV = originalEnv;
  });

  it('returns 404 when underlying table does not exist', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    req.query = { id: '123' };
    mockFindUnique.mockRejectedValue(new Error('relation "ivod_transcripts" does not exist'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: 'Not found',
    });
  });

  it('returns data even when transcript fields are null', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    const mockData = {
      ivod_id: 123,
      date: '2023-01-01',
      meeting_name: 'Test Meeting',
      committee_names: null,
      speaker_name: 'Test Speaker',
      video_length: '30:00',
      ivod_url: null,
      video_url: null,
      ai_transcript: null,
      ly_transcript: null,
    };

    req.query = { id: '123' };
    mockFindUnique.mockResolvedValue(mockData);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: mockData,
      success: true,
    });
  });
});
