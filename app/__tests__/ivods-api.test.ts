import type { NextApiRequest, NextApiResponse } from 'next';
jest.mock('@/lib/prisma', () => ({ __esModule: true, default: { iVODTranscript: { findMany: jest.fn(), count: jest.fn() } } }));
jest.mock('@/lib/utils', () => ({ 
  ...jest.requireActual('@/lib/utils'),
  getDbBackend: jest.fn(),
  createContainsCondition: jest.fn(),
  convertToDate: jest.fn()
}));
jest.mock('@/lib/universal-search', () => ({
  universalSearch: jest.fn(),
  shouldUseUniversalSearch: jest.fn()
}));
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logApiError: jest.fn(),
  }
}));
import handler from '@/pages/api/ivods';
import prisma from '@/lib/prisma';
import { getDbBackend, createContainsCondition, convertToDate } from '@/lib/utils';
import { shouldUseUniversalSearch } from '@/lib/universal-search';

describe('GET /api/ivods', () => {
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let req: Partial<NextApiRequest>;
  let res: Partial<NextApiResponse>;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn(() => ({ json: jsonMock }));
    req = { 
      query: {},
      method: 'GET',
      headers: { 'user-agent': 'test-agent' },
      url: '/api/ivods'
    };
    res = { status: statusMock };
    (getDbBackend as jest.Mock).mockReturnValue('postgresql'); // Default to PostgreSQL for most tests
    
    // Set up universal search to not be used by default
    (shouldUseUniversalSearch as jest.Mock).mockReturnValue(false);
    
    // Set up default mock implementations
    (createContainsCondition as jest.Mock).mockImplementation((field, value, backend) => ({
      [field]: { contains: value, ...(backend !== 'sqlite' ? { mode: 'insensitive' } : {}) }
    }));
    (convertToDate as jest.Mock).mockImplementation((dateStr) => dateStr);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('returns paginated data with default parameters', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    mockFindMany.mockResolvedValue([
      { ivod_id: 1, date: '2023-01-01', meeting_name: 'Meeting 1' }
    ]);
    mockCount.mockResolvedValue(100);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { date: 'desc' },
      skip: 0,
      take: 20,
      select: {
        ivod_id: true,
        date: true,
        title: true,
        meeting_name: true,
        committee_names: true,
        speaker_name: true,
        video_length: true,
        video_start: true,
        video_end: true,
        video_type: true,
        category: true,
        meeting_code: true,
        meeting_code_str: true,
        meeting_time: true,
      },
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [{ ivod_id: 1, date: '2023-01-01', meeting_name: 'Meeting 1' }],
      success: true,
      meta: {
        total: 100,
        page: 1,
        pageSize: 20
      }
    });
  });

  it('handles pagination parameters correctly', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { page: '3', pageSize: '5' };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(50);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { date: 'desc' },
      skip: 10, // (3-1) * 5
      take: 5,
      select: expect.any(Object),
    });
  });

  it('handles general search query', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { q: 'test search' };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        AND: [{
          OR: [
            { title: { contains: 'test search', mode: 'insensitive' } },
            { meeting_name: { contains: 'test search', mode: 'insensitive' } },
            { speaker_name: { contains: 'test search', mode: 'insensitive' } },
            { committee_names: { contains: 'test search', mode: 'insensitive' } },
            { meeting_code_str: { contains: 'test search', mode: 'insensitive' } },
            { ai_transcript: { contains: 'test search', mode: 'insensitive' } },
            { ly_transcript: { contains: 'test search', mode: 'insensitive' } },
          ],
        }]
      },
      orderBy: { date: 'desc' },
      skip: 0,
      take: 20,
      select: expect.any(Object),
    });
  });

  it('handles specific field searches', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { 
      meeting_name: 'Test Meeting',
      speaker: 'Test Speaker',
      committee: 'Test Committee'
    };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { meeting_name: { contains: 'Test Meeting', mode: 'insensitive' } },
          { speaker_name: { contains: 'Test Speaker', mode: 'insensitive' } },
          { committee_names: { contains: 'Test Committee', mode: 'insensitive' } },
        ]
      },
      orderBy: { date: 'desc' },
      skip: 0,
      take: 20,
      select: expect.any(Object),
    });
  });

  it('handles date range filters', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { 
      date_from: '2023-01-01',
      date_to: '2023-12-31'
    };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          { date: { gte: '2023-01-01' } },
          { date: { lte: '2023-12-31' } },
        ]
      },
      orderBy: { date: 'desc' },
      skip: 0,
      take: 20,
      select: expect.any(Object),
    });
  });

  it('handles ascending date sort', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { sort: 'date_asc' };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { date: 'asc' },
      skip: 0,
      take: 20,
      select: expect.any(Object),
    });
  });

  it('combines multiple filters correctly', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { 
      q: 'general search',
      meeting_name: 'Specific Meeting',
      date_from: '2023-01-01'
    };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: 'general search', mode: 'insensitive' } },
              { meeting_name: { contains: 'general search', mode: 'insensitive' } },
              { speaker_name: { contains: 'general search', mode: 'insensitive' } },
              { committee_names: { contains: 'general search', mode: 'insensitive' } },
              { meeting_code_str: { contains: 'general search', mode: 'insensitive' } },
              { ai_transcript: { contains: 'general search', mode: 'insensitive' } },
              { ly_transcript: { contains: 'general search', mode: 'insensitive' } },
            ],
          },
          { meeting_name: { contains: 'Specific Meeting', mode: 'insensitive' } },
          { date: { gte: '2023-01-01' } },
        ]
      },
      orderBy: { date: 'desc' },
      skip: 0,
      take: 20,
      select: expect.any(Object),
    });
  });

  it('handles database errors gracefully', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    mockFindMany.mockRejectedValue(new Error('Database connection failed'));

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ 
      success: false,
      error: 'Internal server error' // Test environment uses generic error message
    });
  });

  it('handles array query parameters by taking first element', async () => {
    const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
    const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
    
    req.query = { 
      q: ['search1', 'search2'], // parseStringParam takes first element 'search1'
      meeting_name: 'Valid Meeting'
    };
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await handler(req as NextApiRequest, res as NextApiResponse);

    expect(mockFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            OR: [
              { title: { contains: 'search1', mode: 'insensitive' } },
              { meeting_name: { contains: 'search1', mode: 'insensitive' } },
              { speaker_name: { contains: 'search1', mode: 'insensitive' } },
              { committee_names: { contains: 'search1', mode: 'insensitive' } },
              { meeting_code_str: { contains: 'search1', mode: 'insensitive' } },
              { ai_transcript: { contains: 'search1', mode: 'insensitive' } },
              { ly_transcript: { contains: 'search1', mode: 'insensitive' } },
            ],
          },
          { meeting_name: { contains: 'Valid Meeting', mode: 'insensitive' } },
        ]
      },
      orderBy: { date: 'desc' },
      skip: 0,
      take: 20,
      select: expect.any(Object),
    });
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({
      data: [],
      success: true,
      meta: {
        total: 0,
        page: 1,
        pageSize: 20
      }
    });
  });

  describe('SQLite database backend', () => {
    beforeEach(() => {
      (getDbBackend as jest.Mock).mockReturnValue('sqlite');
    });

    it('handles general search query without mode insensitive', async () => {
      const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
      const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
      
      req.query = { q: 'test search' };
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          AND: [{
            OR: [
              { title: { contains: 'test search' } },
              { meeting_name: { contains: 'test search' } },
              { speaker_name: { contains: 'test search' } },
              { committee_names: { contains: 'test search' } },
              { meeting_code_str: { contains: 'test search' } },
              { ai_transcript: { contains: 'test search' } },
              { ly_transcript: { contains: 'test search' } },
            ],
          }]
        },
        orderBy: { date: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: [],
        success: true,
        meta: {
          total: 0,
          page: 1,
          pageSize: 20
        }
      });
    });

    it('handles specific field searches without mode insensitive', async () => {
      const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
      const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
      
      req.query = { 
        meeting_name: 'Test Meeting',
        speaker: 'Test Speaker'
      };
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { meeting_name: { contains: 'Test Meeting' } },
            { speaker_name: { contains: 'Test Speaker' } },
          ]
        },
        orderBy: { date: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: [],
        success: true,
        meta: {
          total: 0,
          page: 1,
          pageSize: 20
        }
      });
    });

    it('handles IVOD ID filtering', async () => {
      const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
      const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
      
      req.query = { ids: '123,456,789' };
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { ivod_id: { in: [123, 456, 789] } },
          ]
        },
        orderBy: { date: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: [],
        success: true,
        meta: {
          total: 0,
          page: 1,
          pageSize: 20
        }
      });
    });

    it('ignores invalid IVOD IDs', async () => {
      const mockFindMany = (prisma.iVODTranscript.findMany as unknown) as jest.Mock;
      const mockCount = (prisma.iVODTranscript.count as unknown) as jest.Mock;
      
      req.query = { ids: 'abc,123,def,456' };
      mockFindMany.mockResolvedValue([]);
      mockCount.mockResolvedValue(0);

      await handler(req as NextApiRequest, res as NextApiResponse);

      expect(mockFindMany).toHaveBeenCalledWith({
        where: {
          AND: [
            { ivod_id: { in: [123, 456] } },
          ]
        },
        orderBy: { date: 'desc' },
        skip: 0,
        take: 20,
        select: expect.any(Object),
      });
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        data: [],
        success: true,
        meta: {
          total: 0,
          page: 1,
          pageSize: 20
        }
      });
    });
  });
});