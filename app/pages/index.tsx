import Head from 'next/head';
import { useRouter } from 'next/router';
import Pagination from '@/components/Pagination';
import SearchHeader from '@/components/SearchHeader';
import SearchResults from '@/components/SearchResults';
import ClientOnly from '@/components/ClientOnly';
import { useSearchFilters, useSearchResults, useUrlSync } from '@/hooks/useSearch';

export default function Home() {
  const router = useRouter();
  
  // Use custom hooks for state management
  const {
    filters,
    advancedInput,
    setAdvancedInput,
    searchScope,
    setSearchScope,
    searchQuery,
    setSearchQuery,
    sortOrder,
    setSortOrder,
    page,
    setPage,
    showAdvancedSearch,
    setShowAdvancedSearch,
    hasActiveFilters,
    handleSearch,
    handleKeyPress,
    clearFilters,
  } = useSearchFilters();

  // Fetch search results
  const { data, loading, transcriptSearchResults } = useSearchResults(
    filters,
    sortOrder,
    page,
    searchScope,
    router.isReady
  );

  // Sync state with URL
  useUrlSync(filters, searchScope, sortOrder, page, router.isReady);

  return (
    <>
      <Head>
        <title>IVOD 逐字稿檢索系統 - 台灣立法院會議錄影與逐字稿搜尋</title>
        <meta name="description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供第11屆立法院會議錄影、逐字稿搜尋與下載。包含委員會會議、全院會議等完整記錄，支援關鍵字搜尋、立委姓名查詢、會議影片播放與下載。由 g0v 零時政府開發，促進政府透明與公民參與。" />
        <meta name="keywords" content="立法院,IVOD,逐字稿,會議記錄,立法委員,委員會,台灣政治,政府透明,會議錄影,立法過程,國會監督,公民參與,g0v,零時政府,影片下載,會議搜尋" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />
        <meta name="bingbot" content="index, follow" />

        {/* Enhanced Open Graph */}
        <meta property="og:locale" content="zh_TW" />
        <meta property="og:site_name" content="IVOD 逐字稿檢索系統" />
        <meta property="og:title" content="IVOD 逐字稿檢索系統 - 台灣立法院會議錄影與逐字稿搜尋" />
        <meta property="og:description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供第11屆立法院會議錄影、逐字稿搜尋與下載。包含委員會會議、全院會議等完整記錄，支援關鍵字搜尋、立委姓名查詢、會議影片播放與下載。" />
        <meta property="og:url" content={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/og-image.jpg`} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="IVOD 逐字稿檢索系統 - 台灣立法院會議錄影與逐字稿搜尋" />
        <meta property="og:image:type" content="image/jpeg" />

        {/* Enhanced Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@g0vtw" />
        <meta name="twitter:creator" content="@g0vtw" />
        <meta name="twitter:title" content="IVOD 逐字稿檢索系統 - 台灣立法院會議錄影與逐字稿搜尋" />
        <meta name="twitter:description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供完整會議記錄搜尋功能、影片播放與下載。由 g0v 零時政府開發，促進政府透明與公民參與。" />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/og-image.jpg`} />
        <meta name="twitter:image:alt" content="IVOD 逐字稿檢索系統 - 台灣立法院會議錄影與逐字稿搜尋" />

        {/* Dublin Core metadata for academic/government content */}
        <meta name="DC.title" content="IVOD 逐字稿檢索系統" />
        <meta name="DC.creator" content="g0v 零時政府" />
        <meta name="DC.subject" content="台灣立法院,會議記錄,逐字稿,政府透明,公民參與" />
        <meta name="DC.description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供第11屆立法院會議錄影、逐字稿搜尋與下載" />
        <meta name="DC.publisher" content="g0v 零時政府" />
        <meta name="DC.contributor" content="billy3321, Yutin" />
        <meta name="DC.date" content={new Date().toISOString().split('T')[0]} />
        <meta name="DC.type" content="InteractiveResource" />
        <meta name="DC.format" content="text/html" />
        <meta name="DC.identifier" content={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />
        <meta name="DC.source" content="立法院 IVOD 系統" />
        <meta name="DC.language" content="zh-TW" />
        <meta name="DC.coverage" content="台灣" />
        <meta name="DC.rights" content="MIT License" />

        {/* Additional metadata for government/legislative content */}
        <meta name="government.type" content="立法院" />
        <meta name="government.country" content="台灣" />
        <meta name="parliament.session" content="第11屆" />
        <meta name="content.category" content="政府資訊,會議記錄,立法過程" />
        <meta name="accessibility" content="遵循無障礙網頁設計規範" />

        {/* Application specific meta tags */}
        <meta name="application-name" content="IVOD 逐字稿檢索系統" />
        <meta name="msapplication-TileColor" content="#4F46E5" />
        <meta name="msapplication-config" content="/browserconfig.xml" />
        <meta name="theme-color" content="#4F46E5" />

        {/* Language and locale hints */}
        <meta httpEquiv="Content-Language" content="zh-TW" />
        <meta name="language" content="Chinese Traditional" />

        {/* Canonical URL */}
        <link rel="canonical" href={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />

        {/* Additional language/locale hints for international SEO */}
        <link rel="alternate" hrefLang="zh-TW" href={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />
        <link rel="alternate" hrefLang="zh" href={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />
        <link rel="alternate" hrefLang="x-default" href={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />

        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="preconnect" href="https://www.google-analytics.com" />

        {/* Schema.org structured data for website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "IVOD 逐字稿檢索系統",
              "alternateName": "台灣立法院 IVOD 逐字稿檢索系統",
              "description": "台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供第11屆立法院會議錄影、逐字稿搜尋與下載",
              "url": process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw',
              "potentialAction": {
                "@type": "SearchAction",
                "target": {
                  "@type": "EntryPoint",
                  "urlTemplate": `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/?q={search_term_string}`
                },
                "query-input": "required name=search_term_string"
              },
              "publisher": {
                "@type": "Organization",
                "name": "g0v 零時政府",
                "url": "https://g0v.tw"
              },
              "author": {
                "@type": "Organization",
                "name": "g0v 零時政府"
              },
              "inLanguage": "zh-TW",
              "copyrightYear": new Date().getFullYear(),
              "genre": "政府資訊",
              "keywords": "立法院,IVOD,逐字稿,會議記錄,立法委員,委員會,台灣政治,政府透明"
            })
          }}
        />

      </Head>
      
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Section */}
          <SearchHeader
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            searchScope={searchScope}
            setSearchScope={setSearchScope}
            sortOrder={sortOrder}
            setSortOrder={setSortOrder}
            advancedInput={advancedInput}
            setAdvancedInput={setAdvancedInput}
            showAdvancedSearch={showAdvancedSearch}
            setShowAdvancedSearch={setShowAdvancedSearch}
            hasActiveFilters={hasActiveFilters}
            onSearch={handleSearch}
            onClearFilters={clearFilters}
            onKeyPress={handleKeyPress}
          />

          {/* Search Results */}
          <ClientOnly fallback={
            <div className="bg-white rounded-lg shadow-sm p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-500">載入中...</p>
            </div>
          }>
            <SearchResults
              data={data}
              loading={loading}
              searchScope={searchScope}
              searchQuery={filters.q}
              transcriptSearchResults={transcriptSearchResults}
            />

            {/* Pagination */}
            {data && data.meta?.total > 0 && (
              <div className="flex justify-center">
                <Pagination
                  currentPage={page}
                  total={data.meta.total}
                  pageSize={20}
                  onPageChange={setPage}
                />
              </div>
            )}
          </ClientOnly>
        </div>
      </div>
    </>
  );
}