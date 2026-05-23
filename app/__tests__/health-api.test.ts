/**
 * Tests for /api/health (public) 與 /api/admin/health (admin)
 */
import { createMocks } from 'node-mocks-http';

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { $queryRaw: jest.fn() },
}));

jest.mock('@/lib/elastic', () => ({
  __esModule: true,
  default: { ping: jest.fn() },
}));

import prisma from '@/lib/prisma';
import esClient from '@/lib/elastic';
import publicHandler from '@/pages/api/health';
import adminHandler from '@/pages/api/admin/health';

const mockQueryRaw = prisma.$queryRaw as unknown as jest.Mock;
const mockEsPing = esClient.ping as unknown as jest.Mock;

describe('/api/health (public)', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns 200 with status when DB healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ '1': 1 }]);
    const { req, res } = createMocks({ method: 'GET' });
    await publicHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe('healthy');
    expect(body.timestamp).toBeDefined();
  });

  it('returns 503 when DB unhealthy', async () => {
    mockQueryRaw.mockRejectedValue(new Error('connection refused'));
    const { req, res } = createMocks({ method: 'GET' });
    await publicHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe('unhealthy');
  });

  it('does NOT expose memory/version/uptime/services', async () => {
    mockQueryRaw.mockResolvedValue([{ '1': 1 }]);
    const { req, res } = createMocks({ method: 'GET' });
    await publicHandler(req as any, res as any);
    const body = JSON.parse(res._getData());
    expect(body.memory).toBeUndefined();
    expect(body.uptime).toBeUndefined();
    expect(body.version).toBeUndefined();
    expect(body.services).toBeUndefined();
    // 確認真的只有兩個欄位
    expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
  });

  it('rejects non-GET methods', async () => {
    const { req, res } = createMocks({ method: 'POST' });
    await publicHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('sets X-Response-Time and no-store cache headers', async () => {
    mockQueryRaw.mockResolvedValue([{ '1': 1 }]);
    const { req, res } = createMocks({ method: 'GET' });
    await publicHandler(req as any, res as any);
    expect(res.getHeader('X-Response-Time')).toMatch(/ms$/);
    expect(res.getHeader('Cache-Control')).toBe('no-store');
  });
});

describe('/api/admin/health (admin)', () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    mockQueryRaw.mockReset();
    mockEsPing.mockReset();
    process.env.ADMIN_TOKEN = 'test-admin-secret';
    delete process.env.ES_HOST;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('rejects request without Bearer token', async () => {
    const { req, res } = createMocks({ method: 'GET' });
    await adminHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('rejects invalid token', async () => {
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer wrong-token' },
    });
    await adminHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });

  it('returns detailed health with valid token', async () => {
    mockQueryRaw.mockResolvedValue([{ '1': 1 }]);
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer test-admin-secret' },
    });
    await adminHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(200);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe('healthy');
    expect(body.memory).toBeDefined();
    expect(body.uptime).toBeDefined();
    expect(body.version).toBeDefined();
    expect(body.services).toBeDefined();
    expect(body.services.database).toBe('healthy');
  });

  it('includes elasticsearch status when ES_HOST is set', async () => {
    mockQueryRaw.mockResolvedValue([{ '1': 1 }]);
    mockEsPing.mockResolvedValue({});
    process.env.ES_HOST = 'localhost';
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer test-admin-secret' },
    });
    await adminHandler(req as any, res as any);
    const body = JSON.parse(res._getData());
    expect(body.services.elasticsearch).toBe('healthy');
  });

  it('returns 503 when DB unhealthy even with valid auth', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB down'));
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer test-admin-secret' },
    });
    await adminHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(503);
    const body = JSON.parse(res._getData());
    expect(body.status).toBe('unhealthy');
    expect(body.services.database).toBe('unhealthy');
  });

  it('rejects non-GET methods', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { authorization: 'Bearer test-admin-secret' },
    });
    await adminHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(405);
  });

  it('rejects when ADMIN_TOKEN env not set', async () => {
    delete process.env.ADMIN_TOKEN;
    const { req, res } = createMocks({
      method: 'GET',
      headers: { authorization: 'Bearer anything' },
    });
    await adminHandler(req as any, res as any);
    expect(res._getStatusCode()).toBe(401);
  });
});
