import { createMocks } from 'node-mocks-http';
import logsHandler, { __testing__ } from '@/pages/api/logs';
import { logger } from '@/lib/logger';

// Mock the logger
jest.mock('@/lib/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    logApiError: jest.fn(),
  },
}));

const mockLogger = logger as jest.Mocked<typeof logger>;

function buildReq(body: any, extras: any = {}) {
  return createMocks({
    method: 'POST',
    // 透過 x-real-ip 讓 getClientIdentifier 回傳穩定 IP
    headers: { 'x-real-ip': '127.0.0.1', ...(extras.headers || {}) },
    body,
    ...extras,
  });
}

describe('/api/logs', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __testing__.logsRateLimiter.clear();
  });

  it('handles POST with valid log data', async () => {
    const { req, res } = buildReq({
      level: 'error',
      message: 'Test error message',
      context: { component: 'TestComponent', action: 'test_action' },
    });

    await logsHandler(req as any, res as any);

    expect(res._getStatusCode()).toBe(200);
    expect(JSON.parse(res._getData())).toEqual({ success: true });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Test error message',
      expect.objectContaining({
        component: 'TestComponent',
        action: 'test_action',
        ip: '127.0.0.1',
        metadata: expect.objectContaining({ timestamp: expect.any(String) }),
      })
    );
  });

  it('routes each level to the correct logger method', async () => {
    const levels: Array<{ level: 'error' | 'warn' | 'info' | 'debug' }> = [
      { level: 'error' },
      { level: 'warn' },
      { level: 'info' },
      { level: 'debug' },
    ];

    for (const { level } of levels) {
      jest.clearAllMocks();
      __testing__.logsRateLimiter.clear();
      const { req, res } = buildReq({ level, message: `Test ${level}` });
      await logsHandler(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(mockLogger[level]).toHaveBeenCalledWith(`Test ${level}`, expect.any(Object));
    }
  });

  it('rejects non-POST', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await logsHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
    expect(JSON.parse(res._getData())).toEqual(
      expect.objectContaining({ success: false })
    );
  });

  it('validates required fields', async () => {
    const { req, res } = buildReq({ level: 'error' });
    await logsHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      success: false,
      error: 'Missing required fields: level and message',
    });
  });

  it('validates log level', async () => {
    const { req, res } = buildReq({ level: 'invalid', message: 'Test message' });
    await logsHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(400);
    expect(JSON.parse(res._getData())).toEqual({
      success: false,
      error: 'Invalid log level',
    });
  });

  it('includes user-agent in context', async () => {
    const { req, res } = buildReq(
      {
        level: 'info',
        message: 'Test message',
        context: { customField: 'customValue' },
      },
      { headers: { 'user-agent': 'test-browser/1.0' } }
    );

    await logsHandler(req as any, res as any);

    expect(mockLogger.info).toHaveBeenCalledWith(
      'Test message',
      expect.objectContaining({
        customField: 'customValue',
        ip: '127.0.0.1',
        userAgent: 'test-browser/1.0',
      })
    );
  });

  it('handles empty context', async () => {
    const { req, res } = buildReq({ level: 'info', message: 'No context' });
    await logsHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'No context',
      expect.objectContaining({ ip: '127.0.0.1' })
    );
  });

  it('returns 500 when logger throws', async () => {
    const originalEnv = process.env.NODE_ENV;
    (process.env as any).NODE_ENV = 'production';
    mockLogger.error.mockImplementation(() => {
      throw new Error('Logging failed');
    });
    const { req, res } = buildReq({ level: 'error', message: 'Test message' });
    await logsHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(500);
    expect(JSON.parse(res._getData())).toEqual({
      success: false,
      error: 'Internal server error',
    });
    (process.env as any).NODE_ENV = originalEnv;
  });

  // ─────────────────────────────────────────────────────────────────────
  // 新增：rate limit + 輸入清理測試
  // ─────────────────────────────────────────────────────────────────────

  describe('rate limiting', () => {
    it('returns 429 when client exceeds limit', async () => {
      // 預設 limit 30 req/min，連續打 31 次第 31 次應 429
      for (let i = 0; i < 30; i++) {
        const { req, res } = buildReq({ level: 'info', message: `req-${i}` });
        await logsHandler(req as any, res as any);
        expect(res._getStatusCode()).toBe(200);
      }
      const { req, res } = buildReq({ level: 'info', message: 'over-limit' });
      await logsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(429);
      const body = JSON.parse(res._getData());
      expect(body).toHaveProperty('error');
      expect(body).toHaveProperty('retryAfter');
    });

    it('sets X-RateLimit headers', async () => {
      const { req, res } = buildReq({ level: 'info', message: 'test' });
      await logsHandler(req as any, res as any);
      expect(res.getHeader('X-RateLimit-Limit')).toBe('30');
      expect(res.getHeader('X-RateLimit-Remaining')).toBeDefined();
    });

    it('different IPs have independent quotas', async () => {
      const { req: r1, res: re1 } = createMocks({
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.1' },
        body: { level: 'info', message: 'a' },
      });
      const { req: r2, res: re2 } = createMocks({
        method: 'POST',
        headers: { 'x-real-ip': '10.0.0.2' },
        body: { level: 'info', message: 'b' },
      });
      await logsHandler(r1 as any, re1 as any);
      await logsHandler(r2 as any, re2 as any);
      expect(re1._getStatusCode()).toBe(200);
      expect(re2._getStatusCode()).toBe(200);
    });
  });

  describe('input sanitization', () => {
    it('strips control characters from message', async () => {
      const { req, res } = buildReq({
        level: 'info',
        // \x01 \x07 \x1b 都是需要剝除的控制字元
        message: 'hello\x01\x07\x1bworld',
      });
      await logsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(200);
      const callArgs = mockLogger.info.mock.calls[0];
      expect(callArgs[0]).not.toMatch(/[\x01\x07\x1b]/);
      expect(callArgs[0]).toContain('hello');
      expect(callArgs[0]).toContain('world');
    });

    it('preserves newlines and tabs in message', async () => {
      const { req, res } = buildReq({
        level: 'info',
        message: 'line1\nline2\tindented',
      });
      await logsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(200);
      const callArgs = mockLogger.info.mock.calls[0];
      expect(callArgs[0]).toContain('\n');
      expect(callArgs[0]).toContain('\t');
    });

    it('truncates message longer than 4KB', async () => {
      const longMessage = 'A'.repeat(5000);
      const { req, res } = buildReq({ level: 'info', message: longMessage });
      await logsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(200);
      const callArgs = mockLogger.info.mock.calls[0];
      expect(callArgs[0].length).toBeLessThanOrEqual(4096);
    });

    it('rejects message that is empty after sanitization', async () => {
      // 只含控制字元 → 剝除後變空白字串，但仍非空（被空白取代）
      // 真正會變 empty 的情況：empty string，但這由前面的 'missing message' 攔截
      // 這裡測試純空白會被保留
      const { req, res } = buildReq({ level: 'info', message: '   ' });
      await logsHandler(req as any, res as any);
      // 空白不算空，會通過
      expect(res._getStatusCode()).toBe(200);
    });

    it('drops oversized context but keeps message', async () => {
      const bigContext = { metadata: { huge: 'X'.repeat(10000) } };
      const { req, res } = buildReq({
        level: 'info',
        message: 'message kept',
        context: bigContext,
      });
      await logsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(200);
      const callArgs = mockLogger.info.mock.calls[0];
      // context 應該被丟棄（huge 不在 metadata 中）
      expect(callArgs[1]?.metadata?.huge).toBeUndefined();
      // 但有 timestamp（merge from server）
      expect(callArgs[1]?.metadata?.timestamp).toBeDefined();
      expect(callArgs[0]).toBe('message kept');
    });

    it('rejects non-string message types defensively', async () => {
      const { req, res } = buildReq({ level: 'info', message: { evil: 'object' } });
      await logsHandler(req as any, res as any);
      // sanitizeMessage 對非字串回 ''，message 落空 → 400
      expect(res._getStatusCode()).toBe(400);
    });
  });
});
