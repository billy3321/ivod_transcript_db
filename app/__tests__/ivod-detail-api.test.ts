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
    req = { query: {} };
    res = { status: statusMock };
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns IVOD data for valid id', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    const mockData = {
      ivod_id: 123,
      date: '2023-01-01',
      meeting_name: 'Test Meeting',
      committee_names: ['Committee A'],
      speaker_name: 'Test Speaker',
      video_length: '30:00',
      ivod_url: 'https://example.com/ivod',
      video_url: 'https://example.com/video',
      ai_transcript: 'AI generated transcript',
      ly_transcript: 'Legislative Yuan transcript'
    };
    
    req.query = { id: '123' };
    mockFindUnique.mockResolvedValue(mockData);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { ivod_id: 123 },
      select: {
        ivod_id: true,
        date: true,
        meeting_name: true,
        committee_names: true,
        speaker_name: true,
        video_length: true,
        ivod_url: true,
        video_url: true,
        ai_transcript: true,
        ly_transcript: true,
      },
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ data: mockData });
  });

  it('returns 404 when IVOD not found', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    
    req.query = { id: '999' };
    mockFindUnique.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { ivod_id: 999 },
      select: expect.any(Object),
    });
    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Not found' });
  });

  it('returns 400 for missing id', async () => {
    req.query = {};

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid id' });
  });

  it('returns 400 for array id parameter', async () => {
    req.query = { id: ['123', '456'] };

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Invalid id' });
  });

  it('handles non-numeric id by converting to number', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    
    req.query = { id: '123abc' };
    mockFindUnique.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { ivod_id: 123 }, // parseInt converts '123abc' to 123
      select: expect.any(Object),
    });
  });

  it('handles database errors gracefully', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    
    req.query = { id: '123' };
    mockFindUnique.mockRejectedValue(new Error('Database connection failed'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ error: 'Database connection failed' });
  });

  it('handles zero id correctly', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    
    req.query = { id: '0' };
    mockFindUnique.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { ivod_id: 0 },
      select: expect.any(Object),
    });
    expect(statusMock).toHaveBeenCalledWith(404);
  });

  it('handles negative id correctly', async () => {
    const mockFindUnique = (prisma.iVODTranscript.findUnique as unknown) as jest.Mock;
    
    req.query = { id: '-5' };
    mockFindUnique.mockResolvedValue(null);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { ivod_id: -5 },
      select: expect.any(Object),
    });
  });

  it('returns data with null transcript fields', async () => {
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
      ly_transcript: null
    };
    
    req.query = { id: '123' };
    mockFindUnique.mockResolvedValue(mockData);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ data: mockData });
  });
});