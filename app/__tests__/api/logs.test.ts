import { createMocks } from 'node-mocks-http';
import logsHandler from '@/pages/api/logs';
import { logger } from '@/lib/logger';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    getClientIP: jest.fn().mockReturnValue('127.0.0.1'),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

describe('/api/logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should handle POST requests with valid log data', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        level: 'error',
        message: 'Test error message',
        context: {
          component: 'TestComponent',
          action: 'test_action',
        },
      },
    });

    await logsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ success: true });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Test error message',
      expect.objectContaining({
        component: 'TestComponent',
        action: 'test_action',
        ip: '127.0.0.1',
        timestamp: expect.any(String),
      })
    );
  });

  it('should handle different log levels', async () => {
    const levels: Array<{ level: 'error' | 'warn' | 'info' | 'debug', method: string }> = [
      { level: 'error', method: 'error' },
      { level: 'warn', method: 'warn' },
      { level: 'info', method: 'info' },
      { level: 'debug', method: 'debug' },
    ];

    for (const { level, method } of levels) {
      const { req, res } = createMocks({
        method: 'POST',
        body: {
          level,
          message: `Test ${level} message`,
        },
      });

      await logsHandler(req, res);

      expect(res._getStatusCode()).toBe(200);
      expect(mockLogger[method as keyof typeof mockLogger]).toHaveBeenCalledWith(
        `Test ${level} message`,
        expect.any(Object)
      );

      jest.clearAllMocks();
    }
  });

  it('should reject non-POST requests', async () => {
    const { req, res } = createMocks({
      method: 'GET',
    });

    await logsHandler(req, res);

    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Method not allowed' });
  });

  it('should validate required fields', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        level: 'error',
        // missing message
      },
    });

    await logsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      error: 'Missing required fields: level and message',
    });
  });

  it('should validate log level', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        level: 'invalid',
        message: 'Test message',
      },
    });

    await logsHandler(req, res);

    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Invalid log level' });
  });

  it('should include request metadata in context', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'user-agent': 'test-browser/1.0',
      },
      body: {
        level: 'info',
        message: 'Test message',
        context: {
          customField: 'customValue',
        },
      },
    });

    await logsHandler(req, res);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Test message',
      expect.objectContaining({
        customField: 'customValue',
        ip: '127.0.0.1',
        userAgent: 'test-browser/1.0',
        timestamp: expect.any(String),
      })
    );
  });

  it('should handle empty context', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      body: {
        level: 'info',
        message: 'Test message without context',
      },
    });

    await logsHandler(req, res);

    expect(res._getStatusCode()).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Test message without context',
      expect.objectContaining({
        ip: '127.0.0.1',
        timestamp: expect.any(String),
      })
    );
  });

  it('should handle errors during logging', async () => {
    // Mock logger to throw an error
    mockLogger.error.mockImplementation(() => {
      throw new Error('Logging failed');
    });

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        level: 'error',
        message: 'Test message',
      },
    });

    await logsHandler(req, res);

    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({ error: 'Internal server error' });
  });
});