/**
 * Tests for /api/admin/logs
 * Path traversal, auth, DELETE, listing, reading
 */
import { createMocks } from 'node-mocks-http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logApiError: jest.fn(),
  },
}));

import adminLogsHandler from '@/pages/api/admin/logs';

const TOKEN = 'test-admin-token-secret-12345';

describe('/api/admin/logs', () => {
  let tmpLogDir: string;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    tmpLogDir = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-logs-test-'));
    process.env.LOG_PATH = tmpLogDir;
    process.env.ADMIN_TOKEN = TOKEN;
  });

  afterEach(() => {
    if (fs.existsSync(tmpLogDir)) {
      fs.rmSync(tmpLogDir, { recursive: true, force: true });
    }
    process.env = { ...originalEnv };
  });

  function authHeaders(token = TOKEN) {
    return { authorization: `Bearer ${token}` };
  }

  describe('Authentication', () => {
    it('returns 401 without Authorization header', async () => {
      const { req, res } = createMocks({ method: 'GET' });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(401);
    });

    it('returns 401 with non-Bearer scheme', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: { authorization: 'Basic foo' },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(401);
    });

    it('returns 401 with wrong token', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders('wrong-token'),
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(401);
    });

    it('returns 401 when token differs only by length (timingSafeEqual rejects)', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(TOKEN + 'X'),
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(401);
    });

    it('returns 401 when ADMIN_TOKEN env not set', async () => {
      delete process.env.ADMIN_TOKEN;
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders('anything'),
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(401);
    });

    it('accepts valid token', async () => {
      const { req, res } = createMocks({ method: 'GET', headers: authHeaders() });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(200);
    });
  });

  describe('GET (list files)', () => {
    it('returns empty list when log directory is empty', async () => {
      const { req, res } = createMocks({ method: 'GET', headers: authHeaders() });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ files: [] });
    });

    it('returns log files sorted by mtime desc', async () => {
      const f1 = path.join(tmpLogDir, 'a.log');
      const f2 = path.join(tmpLogDir, 'b.log');
      fs.writeFileSync(f1, 'line 1\n');
      fs.writeFileSync(f2, 'line 2\n');
      // 讓 f2 比 f1 新
      const newer = new Date();
      const older = new Date(newer.getTime() - 60000);
      fs.utimesSync(f1, older, older);
      fs.utimesSync(f2, newer, newer);

      const { req, res } = createMocks({ method: 'GET', headers: authHeaders() });
      await adminLogsHandler(req as any, res as any);

      const data = JSON.parse(res._getData());
      expect(data.files.length).toBe(2);
      expect(data.files[0].name).toBe('b.log');
      expect(data.files[1].name).toBe('a.log');
      expect(data.files[0].size).toBeGreaterThan(0);
    });

    it('only returns .log files (excludes .txt etc.)', async () => {
      fs.writeFileSync(path.join(tmpLogDir, 'real.log'), 'x');
      fs.writeFileSync(path.join(tmpLogDir, 'README.txt'), 'x');
      fs.writeFileSync(path.join(tmpLogDir, '.hidden'), 'x');

      const { req, res } = createMocks({ method: 'GET', headers: authHeaders() });
      await adminLogsHandler(req as any, res as any);

      const data = JSON.parse(res._getData());
      expect(data.files.length).toBe(1);
      expect(data.files[0].name).toBe('real.log');
    });
  });

  describe('GET ?file= (read file)', () => {
    it('returns parsed log entries', async () => {
      const content = [
        '2026-05-01T10:00:00.000Z [INFO] First message',
        '2026-05-01T10:00:01.000Z [WARN] Second message',
        '',
        'unstructured log line',
      ].join('\n');
      fs.writeFileSync(path.join(tmpLogDir, 'app.log'), content);

      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(),
        query: { file: 'app.log' },
      });
      await adminLogsHandler(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.entries.length).toBe(3); // empty line filtered out
      expect(data.entries[0].level).toBe('INFO');
      expect(data.entries[0].message).toBe('First message');
      expect(data.entries[2].message).toBe('unstructured log line');
      expect(data.totalLines).toBe(3);
    });

    it('respects lines parameter (last N)', async () => {
      const lines = Array.from({ length: 200 }, (_, i) => `line-${i}`).join('\n');
      fs.writeFileSync(path.join(tmpLogDir, 'big.log'), lines);

      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(),
        query: { file: 'big.log', lines: '50' },
      });
      await adminLogsHandler(req as any, res as any);

      const data = JSON.parse(res._getData());
      expect(data.entries.length).toBe(50);
      expect(data.entries[0].message).toBe('line-150');
      expect(data.entries[49].message).toBe('line-199');
    });

    it('returns 404 for non-existent file', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(),
        query: { file: 'nope.log' },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(404);
    });
  });

  describe('Path traversal protection', () => {
    it('rejects absolute path with 403', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(),
        query: { file: '/etc/passwd' },
      });
      await adminLogsHandler(req as any, res as any);
      // path.join 會把絕對路徑當成接續 → 變成 logDir/etc/passwd，可能 404
      // 但若是 `../../etc/passwd` 應該被 403 擋住
      // 兩種都 OK，不外洩
      expect([403, 404]).toContain(res._getStatusCode());
    });

    it('rejects ../../../etc/passwd with 403', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(),
        query: { file: '../../../etc/passwd' },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(403);
    });

    it('rejects ../sibling-file with 403 (outside log dir)', async () => {
      const { req, res } = createMocks({
        method: 'GET',
        headers: authHeaders(),
        query: { file: '../something.log' },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(403);
    });

    it('rejects DELETE with ../../../etc/passwd', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        headers: authHeaders(),
        body: { file: '../../../etc/passwd' },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(403);
    });
  });

  describe('DELETE', () => {
    it('deletes a log file successfully', async () => {
      const target = path.join(tmpLogDir, 'todelete.log');
      fs.writeFileSync(target, 'content');
      expect(fs.existsSync(target)).toBe(true);

      const { req, res } = createMocks({
        method: 'DELETE',
        headers: authHeaders(),
        body: { file: 'todelete.log' },
      });
      await adminLogsHandler(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      expect(JSON.parse(res._getData())).toEqual({ success: true });
      expect(fs.existsSync(target)).toBe(false);
    });

    it('returns 400 when no file specified', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        headers: authHeaders(),
        body: {},
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(400);
    });

    it('returns 400 when file is non-string', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        headers: authHeaders(),
        body: { file: 123 },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(400);
    });

    it('returns 404 when target file does not exist', async () => {
      const { req, res } = createMocks({
        method: 'DELETE',
        headers: authHeaders(),
        body: { file: 'nope.log' },
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(404);
    });
  });

  describe('Method handling', () => {
    it('returns 405 for unsupported method', async () => {
      const { req, res } = createMocks({
        method: 'PATCH',
        headers: authHeaders(),
      });
      await adminLogsHandler(req as any, res as any);
      expect(res._getStatusCode()).toBe(405);
    });
  });
});
