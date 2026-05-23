/**
 * Tests for sitemap.xml.tsx
 * 驗證 XML escape 與直連 prisma
 */

const mockFindMany = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: { iVODTranscript: { findMany: (...args: any[]) => mockFindMany(...args) } },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logDatabaseError: jest.fn(),
  },
}));

import { escapeXml, generateSiteMap, getServerSideProps } from '@/pages/sitemap.xml';

describe('sitemap escapeXml', () => {
  it('escapes ampersand', () => {
    expect(escapeXml('Tom & Jerry')).toBe('Tom &amp; Jerry');
  });
  it('escapes <, >, ", \'', () => {
    expect(escapeXml('<a href="b">c</a> \'d\'')).toBe(
      '&lt;a href=&quot;b&quot;&gt;c&lt;/a&gt; &apos;d&apos;'
    );
  });
  it('handles null/undefined', () => {
    expect(escapeXml(null)).toBe('');
    expect(escapeXml(undefined)).toBe('');
  });
  it('escapes & first to avoid double-escape', () => {
    // 確保 '&' 不會在 '&amp;lt;' 之類的順序錯誤產生
    expect(escapeXml('&<')).toBe('&amp;&lt;');
  });
});

describe('sitemap generateSiteMap', () => {
  it('produces well-formed XML even with special chars in meeting_name', () => {
    const xml = generateSiteMap(
      [
        {
          ivod_id: 1,
          date: '2025-01-01T00:00:00Z',
          meeting_name: 'Foo & Bar <test>',
        },
      ],
      'https://example.com'
    );
    expect(xml).toContain('<news:title>Foo &amp; Bar &lt;test&gt;</news:title>');
    expect(xml).toContain('<loc>https://example.com/ivod/1</loc>');
    // 確保沒有 raw '<test>' 或 'Foo & Bar' 沒被 escape
    expect(xml).not.toContain('Foo & Bar <test>');
  });

  it('escapes baseUrl too (for safety)', () => {
    const xml = generateSiteMap([], 'https://x.com/?a=1&b=2');
    expect(xml).toContain('https://x.com/?a=1&amp;b=2');
  });

  it('handles null meeting_name with fallback', () => {
    const xml = generateSiteMap(
      [{ ivod_id: 42, date: '2025-06-15', meeting_name: null }],
      'https://x.com'
    );
    expect(xml).toContain('立法院會議 2025-06-15');
  });

  it('includes home and about pages', () => {
    const xml = generateSiteMap([], 'https://x.com');
    expect(xml).toContain('<loc>https://x.com</loc>');
    expect(xml).toContain('<loc>https://x.com/about</loc>');
  });

  it('falls back to current time for invalid date', () => {
    // invalid date → 不該拋 exception
    const xml = generateSiteMap(
      [{ ivod_id: 1, date: 'not-a-date', meeting_name: 'OK' }],
      'https://x.com'
    );
    // 應該還是合法 XML
    expect(xml).toContain('<loc>https://x.com/ivod/1</loc>');
    expect(xml).toContain('<lastmod>'); // 有 lastmod
  });
});

describe('sitemap getServerSideProps', () => {
  beforeEach(() => {
    mockFindMany.mockReset();
  });

  function buildCtx(rows: any[]) {
    const headers: Record<string, any> = {};
    const writeMock = jest.fn();
    const endMock = jest.fn();
    const setHeaderMock = jest.fn();
    const res = {
      setHeader: setHeaderMock,
      write: writeMock,
      end: endMock,
    } as any;
    const req = {
      headers: { host: 'localhost:3000', 'x-forwarded-proto': 'https' },
    } as any;
    mockFindMany.mockResolvedValue(rows);
    return { req, res, writeMock, endMock, setHeaderMock, headers };
  }

  it('calls prisma.findMany directly (no fetch self)', async () => {
    const { req, res } = buildCtx([
      { ivod_id: 1, date: new Date(), meeting_name: 'A' },
    ]);
    await getServerSideProps({ req, res, params: {}, query: {}, resolvedUrl: '/sitemap.xml' } as any);
    expect(mockFindMany).toHaveBeenCalledTimes(1);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        select: { ivod_id: true, date: true, meeting_name: true },
        orderBy: { date: 'desc' },
        take: 5000,
      })
    );
  });

  it('writes XML with content-type', async () => {
    const { req, res, writeMock, setHeaderMock, endMock } = buildCtx([]);
    await getServerSideProps({ req, res, params: {}, query: {}, resolvedUrl: '/sitemap.xml' } as any);
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Content-Type',
      'text/xml; charset=utf-8'
    );
    expect(setHeaderMock).toHaveBeenCalledWith(
      'Cache-Control',
      'public, s-maxage=86400, stale-while-revalidate'
    );
    expect(writeMock).toHaveBeenCalledTimes(1);
    expect(writeMock.mock.calls[0][0]).toContain('<?xml');
    expect(endMock).toHaveBeenCalledTimes(1);
  });

  it('returns minimal sitemap when prisma errors', async () => {
    const { req, res, writeMock } = buildCtx([]);
    mockFindMany.mockReset();
    mockFindMany.mockRejectedValue(new Error('DB down'));
    await getServerSideProps({ req, res, params: {}, query: {}, resolvedUrl: '/sitemap.xml' } as any);
    // 仍寫出 XML（minimal）
    expect(writeMock).toHaveBeenCalledTimes(1);
    const xml = writeMock.mock.calls[0][0];
    expect(xml).toContain('<?xml');
    expect(xml).toContain('<urlset');
    // 沒有 ivod 條目
    expect(xml).not.toContain('/ivod/');
  });

  it('uses NEXT_PUBLIC_SITE_URL when set', async () => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://override.example.com';
    const { req, res, writeMock } = buildCtx([]);
    await getServerSideProps({ req, res, params: {}, query: {}, resolvedUrl: '/sitemap.xml' } as any);
    expect(writeMock.mock.calls[0][0]).toContain('https://override.example.com');
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });
});
