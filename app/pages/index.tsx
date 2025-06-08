import Head from 'next/head';
import { useRouter } from 'next/router';
import Pagination from '@/components/Pagination';
import SearchHeader from '@/components/SearchHeader';
import SearchResults from '@/components/SearchResults';
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
        <meta name="description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供第11屆立法院會議錄影、逐字稿搜尋與下載。包含委員會會議、全院會議等完整記錄，支援關鍵字搜尋、立委姓名查詢。" />
        <meta name="keywords" content="立法院,IVOD,逐字稿,會議記錄,立法委員,委員會,台灣政治,政府透明,會議錄影,立法過程" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph */}
        <meta property="og:title" content="IVOD 逐字稿檢索系統 - 台灣立法院會議錄影與逐字稿搜尋" />
        <meta property="og:description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供第11屆立法院會議錄影、逐字稿搜尋與下載。" />
        <meta property="og:url" content={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />
        <meta property="og:type" content="website" />
        <meta property="og:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/og-image.jpg`} />
        
        {/* Twitter Card */}
        <meta name="twitter:title" content="IVOD 逐字稿檢索系統" />
        <meta name="twitter:description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統，提供完整會議記錄搜尋功能。" />
        <meta name="twitter:image" content={`${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/twitter-image.jpg`} />
        
        {/* Additional meta tags */}
        <meta name="application-name" content="IVOD 逐字稿檢索系統" />
        <meta name="msapplication-TileColor" content="#4F46E5" />
        
        {/* Canonical URL */}
        <link rel="canonical" href={process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'} />
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
          <SearchResults
            data={data}
            loading={loading}
            searchScope={searchScope}
            searchQuery={filters.q}
            transcriptSearchResults={transcriptSearchResults}
          />

          {/* Pagination */}
          {data && data.total > 0 && (
            <div className="flex justify-center">
              <Pagination
                currentPage={page}
                total={data.total}
                pageSize={20}
                onPageChange={setPage}
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}