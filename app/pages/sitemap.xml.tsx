import { GetServerSideProps } from 'next';
import prisma from '@/lib/prisma';
import { logger } from '@/lib/logger';

interface SitemapProps {}

interface SitemapItem {
  ivod_id: number;
  date: Date | string | null;
  meeting_name: string | null;
}

const SITEMAP_DEFAULT_BASE_URL = 'https://ivod-search.g0v.tw';
const SITEMAP_MAX_ITEMS = 5000;

/**
 * XML escape — 把 & < > " ' 轉成對應 entity
 * 防止資料庫內容含特殊字元時破壞 sitemap 結構
 */
export function escapeXml(value: unknown): string {
  if (value == null) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoSafe(date: Date | string | null | undefined, fallback: Date): string {
  if (!date) return fallback.toISOString();
  try {
    const d = date instanceof Date ? date : new Date(date);
    return isNaN(d.getTime()) ? fallback.toISOString() : d.toISOString();
  } catch {
    return fallback.toISOString();
  }
}

export function generateSiteMap(ivods: SitemapItem[], baseUrlRaw: string): string {
  const baseUrl = escapeXml(baseUrlRaw);
  const now = new Date();
  const nowIso = now.toISOString();

  const urls = ivods
    .map(({ ivod_id, date, meeting_name }) => {
      const lastmod = toIsoSafe(date, now);
      const titleText = meeting_name ? String(meeting_name) : `立法院會議 ${date ?? ''}`;
      const title = escapeXml(titleText);
      return `
  <url>
    <loc>${baseUrl}/ivod/${ivod_id}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.9</priority>
    <news:news>
      <news:publication>
        <news:name>IVOD 逐字稿檢索系統</news:name>
        <news:language>zh-tw</news:language>
      </news:publication>
      <news:publication_date>${lastmod}</news:publication_date>
      <news:title>${title}</news:title>
      <news:keywords>立法院,IVOD,逐字稿,會議記錄</news:keywords>
    </news:news>
  </url>`;
    })
    .join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${nowIso}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>${urls}
</urlset>`;
}

function getBaseUrl(req: { headers: { host?: string; 'x-forwarded-proto'?: string | string[] } }): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  const protoRaw = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoRaw) ? protoRaw[0] : protoRaw || 'https';
  const host = req.headers.host;
  return host ? `${proto}://${host}` : SITEMAP_DEFAULT_BASE_URL;
}

export const getServerSideProps: GetServerSideProps<SitemapProps> = async ({ res, req }) => {
  const baseUrl = getBaseUrl(req as any);

  let ivods: SitemapItem[] = [];
  try {
    // 直接打 prisma，避免 fetch self
    ivods = await prisma.iVODTranscript.findMany({
      select: {
        ivod_id: true,
        date: true,
        meeting_name: true,
      },
      orderBy: { date: 'desc' },
      take: SITEMAP_MAX_ITEMS,
    });
  } catch (error: any) {
    logger.logDatabaseError(error, 'sitemap_findMany', {});
    // 失敗時走只有首頁的 minimal sitemap
    ivods = [];
  }

  const sitemap = generateSiteMap(ivods, baseUrl);

  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
  res.write(sitemap);
  res.end();

  return { props: {} };
};

// This component won't be rendered as we're handling the response in getServerSideProps
export default function SiteMap() {
  return null;
}
