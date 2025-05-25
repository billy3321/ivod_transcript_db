import { GetServerSideProps } from 'next';

interface SitemapProps {}

function generateSiteMap(ivods: any[]) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw';
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
  <!-- Homepage -->
  <url>
    <loc>${baseUrl}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  
  <!-- About page -->
  <url>
    <loc>${baseUrl}/about</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
  
  <!-- IVOD detail pages -->
  ${ivods
    .map(({ ivod_id, date, meeting_name }) => {
      const lastmod = date ? new Date(date).toISOString() : new Date().toISOString();
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
      <news:title>${meeting_name || `立法院會議 ${date}`}</news:title>
      <news:keywords>立法院,IVOD,逐字稿,會議記錄</news:keywords>
    </news:news>
  </url>`;
    })
    .join('')}
</urlset>`;
}

export const getServerSideProps: GetServerSideProps<SitemapProps> = async ({ res, req }) => {
  try {
    // Get the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers.host;
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `${protocol}://${host}`;
    
    // Fetch all IVOD records for sitemap
    const response = await fetch(`${baseUrl}/api/ivods?pageSize=10000`);
    const data = await response.json();
    
    // Generate the sitemap
    const sitemap = generateSiteMap(data.data || []);

    // Set appropriate headers
    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate');
    
    // Write the sitemap
    res.write(sitemap);
    res.end();

    return {
      props: {},
    };
  } catch (error) {
    console.error('Error generating sitemap:', error);
    
    // Return minimal sitemap on error
    const minimalSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/about</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>`;

    res.setHeader('Content-Type', 'text/xml; charset=utf-8');
    res.write(minimalSitemap);
    res.end();

    return {
      props: {},
    };
  }
};

// This component won't be rendered as we're handling the response in getServerSideProps
export default function SiteMap() {
  return null;
}