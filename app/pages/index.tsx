import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import { IVOD } from '@/types';
import List from '@/components/List';
import Pagination from '@/components/Pagination';
import Icon from '@/components/Icon';
import ChevronIcon from '@/components/ChevronIcon';
import ClientOnly from '@/components/ClientOnly';

interface SearchFilters {
  q: string;
  meeting_name: string;
  speaker: string;
  committee: string;
  date_from: string;
  date_to: string;
}

interface AdvancedSearchInput {
  meeting_name: string;
  speaker: string;
  committee: string;
  date_from: string;
  date_to: string;
}

type SearchScope = 'all' | 'transcript';

export default function Home() {
  const router = useRouter();
  const [filters, setFilters] = useState<SearchFilters>({
    q: '',
    meeting_name: '',
    speaker: '',
    committee: '',
    date_from: '',
    date_to: ''
  });
  const [advancedInput, setAdvancedInput] = useState<AdvancedSearchInput>({
    meeting_name: '',
    speaker: '',
    committee: '',
    date_from: '',
    date_to: ''
  });
  const [searchScope, setSearchScope] = useState<SearchScope>('all');
  const [searchQuery, setSearchQuery] = useState(''); // Input field value
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ data: IVOD[]; total: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);
  const [transcriptSearchResults, setTranscriptSearchResults] = useState<{ id: number; transcript: string }[]>([]);

  // Initialize state from URL parameters
  useEffect(() => {
    if (router.isReady) {
      const {
        q = '',
        meeting_name = '',
        speaker = '',
        committee = '',
        date_from = '',
        date_to = '',
        sort = 'date_desc',
        scope = 'all',
        page: urlPage = '1'
      } = router.query;

      setFilters({
        q: q as string,
        meeting_name: meeting_name as string,
        speaker: speaker as string,
        committee: committee as string,
        date_from: date_from as string,
        date_to: date_to as string
      });
      setAdvancedInput({
        meeting_name: meeting_name as string,
        speaker: speaker as string,
        committee: committee as string,
        date_from: date_from as string,
        date_to: date_to as string
      });
      setSearchQuery(q as string);
      setSearchScope(scope as SearchScope);
      setSortOrder(sort as 'date_desc' | 'date_asc');
      setPage(parseInt(urlPage as string) || 1);
    }
  }, [router.isReady, router.asPath, router.query]); // Include router.query but asPath should prevent unnecessary re-renders

  // Memoize search params to prevent unnecessary re-renders
  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    
    // Add all active filters to params, but exclude 'q' for transcript-only search
    Object.entries(filters).forEach(([key, value]) => {
      if (value && !(searchScope === 'transcript' && key === 'q')) {
        params.append(key, value);
      }
    });
    
    params.append('sort', sortOrder);
    params.append('page', page.toString());
    params.append('pageSize', '20');
    
    return params.toString();
  }, [filters, sortOrder, page, searchScope]);

  // Memoize URL query params to prevent unnecessary router updates
  const urlQueryParams = useMemo(() => {
    const queryParams: any = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams[key] = value;
    });
    
    if (searchScope !== 'all') queryParams.scope = searchScope;
    if (sortOrder !== 'date_desc') queryParams.sort = sortOrder;
    if (page !== 1) queryParams.page = page.toString();
    
    return queryParams;
  }, [filters, searchScope, sortOrder, page]);

  // Update URL when filters change (debounced)
  useEffect(() => {
    if (!router.isReady) return;
    
    const timeoutId = setTimeout(() => {
      const currentQueryString = new URLSearchParams(router.query as any).toString();
      const newQueryString = new URLSearchParams(urlQueryParams).toString();
      
      if (currentQueryString !== newQueryString) {
        router.push({
          pathname: '/',
          query: urlQueryParams
        }, undefined, { shallow: true });
      }
    }, 100); // Small debounce to prevent rapid URL updates

    return () => clearTimeout(timeoutId);
  }, [urlQueryParams, router]);

  // Reset page when filters change (but not page itself)
  useEffect(() => {
    const { q, meeting_name, speaker, committee, date_from, date_to } = filters;
    if (q || meeting_name || speaker || committee || date_from || date_to) {
      setPage(1);
    }
  }, [filters]);

  // Fetch data when search params change
  useEffect(() => {
    if (!router.isReady) return;
    
    setLoading(true);
    
    if (searchScope === 'transcript' && filters.q) {
      // For transcript-only search, use /api/search first, then get IVOD details
      let searchResultsWithExcerpts: any[] = [];
      
      fetch(`/api/search?q=${encodeURIComponent(filters.q)}`)
        .then(res => res.json())
        .then(searchData => {
          searchResultsWithExcerpts = searchData.data || [];
          setTranscriptSearchResults(searchResultsWithExcerpts);
          
          if (searchData.data && searchData.data.length > 0) {
            // Get IVOD IDs from search results
            const ivodIds = searchData.data.map((item: any) => item.id);
            
            // Create search params without q parameter for /api/ivods
            const transcriptSearchParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
              if (value && key !== 'q') transcriptSearchParams.append(key, value);
            });
            transcriptSearchParams.append('sort', sortOrder);
            transcriptSearchParams.append('page', page.toString());
            transcriptSearchParams.append('pageSize', '20');
            transcriptSearchParams.append('ids', ivodIds.join(','));
            
            return fetch(`/api/ivods?${transcriptSearchParams.toString()}`).then(res => res.json());
          } else {
            return { data: [], total: 0 };
          }
        })
        .then(ivodData => {
          // 將搜尋摘要合併到 IVOD 資料中
          if (searchResultsWithExcerpts.length > 0 && ivodData.data) {
            const transcriptMap = new Map(searchResultsWithExcerpts.map((item: any) => [item.id, item.excerpt]));
            ivodData.data = ivodData.data.map((ivod: any) => ({
              ...ivod,
              excerpt: transcriptMap.get(ivod.ivod_id)
            }));
          }
          setData(ivodData);
        })
        .catch(error => {
          console.error('Error fetching transcript search data:', error);
          setData({ data: [], total: 0 });
          setTranscriptSearchResults([]);
        })
        .finally(() => setLoading(false));
    } else {
      // For general search or no query, use /api/ivods normally
      Promise.all([
        fetch(`/api/ivods?${searchParams}`).then(res => res.json()),
        Promise.resolve({ data: [] })
      ])
      .then(([ivodData, searchData]) => {
        setData(ivodData);
        setTranscriptSearchResults([]);
      })
      .catch(error => {
        console.error('Error fetching data:', error);
        setData({ data: [], total: 0 });
        setTranscriptSearchResults([]);
      })
      .finally(() => setLoading(false));
    }
  }, [searchParams, filters, sortOrder, page, searchScope, router.isReady]);

  const handleAdvancedInputChange = (key: keyof AdvancedSearchInput, value: string) => {
    setAdvancedInput(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    // Update filters with both main search and advanced search inputs
    setFilters(prev => ({
      ...prev,
      q: searchQuery,
      meeting_name: advancedInput.meeting_name,
      speaker: advancedInput.speaker,
      committee: advancedInput.committee,
      date_from: advancedInput.date_from,
      date_to: advancedInput.date_to
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const clearFilters = () => {
    setFilters({
      q: '',
      meeting_name: '',
      speaker: '',
      committee: '',
      date_from: '',
      date_to: ''
    });
    setAdvancedInput({
      meeting_name: '',
      speaker: '',
      committee: '',
      date_from: '',
      date_to: ''
    });
    setSearchQuery('');
    setSearchScope('all');
    setSortOrder('date_desc');
  };

  const hasActiveFilters = Object.values(filters).some(Boolean) || Object.values(advancedInput).some(Boolean);

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
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            {/* Main Search */}
            <div className="space-y-4 mb-4">
              {/* Mobile: Vertical Layout, Desktop: Horizontal Layout */}
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search Input - Full Width on Mobile, First on Desktop */}
                <div className="relative flex-1 order-1 sm:order-2">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Icon type="search" className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder={searchScope === 'all' ? "搜尋會議名稱、立委姓名、逐字稿內容..." : "搜尋逐字稿內容..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Mobile: Second Row with Dropdown and Button */}
                <div className="flex gap-3 order-2 sm:order-1 sm:contents">
                  {/* Search Scope Dropdown */}
                  <select
                    value={searchScope}
                    onChange={(e) => setSearchScope(e.target.value as SearchScope)}
                    className="flex-1 sm:flex-shrink-0 sm:flex-initial border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
                  >
                    <option value="all">搜尋全部欄位</option>
                    <option value="transcript">僅搜尋逐字稿</option>
                  </select>

                  {/* Search Button */}
                  <button
                    onClick={handleSearch}
                    className="flex-1 sm:flex-shrink-0 sm:flex-initial bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors order-3"
                  >
                    搜尋
                  </button>
                </div>
              </div>
            </div>

            {/* Advanced Search Syntax Help */}
            <div className="mt-3 text-xs text-gray-600">
              <details className="group">
                <summary className="cursor-pointer text-blue-600 hover:text-blue-800 select-none">
                  進階搜尋語法
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs space-y-1">
                  <div><strong>引號搜尋：</strong> <code>&quot;完整詞組&quot;</code> - 搜尋完整詞組</div>
                  <div><strong>布林運算：</strong> <code>預算 AND 教育</code>, <code>王委員 OR 李委員</code> - AND/OR 邏輯</div>
                  <div><strong>群組搜尋：</strong> <code>(預算 OR 教育) AND 委員會</code> - 括弧分組</div>
                  <div><strong>欄位搜尋：</strong> <code>title:&quot;會議名稱&quot;</code>, <code>speaker:&quot;立委名稱&quot;</code>, <code>meeting:&quot;會議&quot;</code></div>
                  <div><strong>排除搜尋：</strong> <code>-詞彙</code> 或 <code>-&quot;詞組&quot;</code> - 排除特定內容</div>
                  <div><strong>複合範例：</strong> <code>(speaker:&quot;王委員&quot; OR speaker:&quot;李委員&quot;) AND &quot;預算&quot; -&quot;國防&quot;</code></div>
                </div>
              </details>
            </div>

            {/* Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <button
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <ChevronIcon isRotated={showAdvancedSearch} className="w-4 h-4 mr-1" />
                進階搜尋
              </button>
              
              <div className="flex items-center space-x-4">
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-sm text-gray-500 hover:text-gray-700"
                  >
                    清除篩選
                  </button>
                )}
                
                <select
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value as 'date_desc' | 'date_asc')}
                  className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="date_desc">最新優先</option>
                  <option value="date_asc">最舊優先</option>
                </select>
              </div>
            </div>

            {/* Advanced Search Fields */}
            {showAdvancedSearch && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
                <div>
                  <label htmlFor="meeting_name" className="block text-sm font-medium text-gray-700 mb-1">
                    會議名稱
                  </label>
                  <input
                    id="meeting_name"
                    type="text"
                    placeholder="例：委員會全體會議"
                    value={advancedInput.meeting_name}
                    onChange={(e) => handleAdvancedInputChange('meeting_name', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="speaker" className="block text-sm font-medium text-gray-700 mb-1">
                    立委姓名
                  </label>
                  <input
                    id="speaker"
                    type="text"
                    placeholder="例：王委員"
                    value={advancedInput.speaker}
                    onChange={(e) => handleAdvancedInputChange('speaker', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="committee" className="block text-sm font-medium text-gray-700 mb-1">
                    委員會
                  </label>
                  <input
                    id="committee"
                    type="text"
                    placeholder="例：教育文化"
                    value={advancedInput.committee}
                    onChange={(e) => handleAdvancedInputChange('committee', e.target.value)}
                    onKeyPress={handleKeyPress}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="date_from" className="block text-sm font-medium text-gray-700 mb-1">
                    開始日期
                  </label>
                  <input
                    id="date_from"
                    type="date"
                    value={advancedInput.date_from}
                    onChange={(e) => handleAdvancedInputChange('date_from', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                
                <div>
                  <label htmlFor="date_to" className="block text-sm font-medium text-gray-700 mb-1">
                    結束日期
                  </label>
                  <input
                    id="date_to"
                    type="date"
                    value={advancedInput.date_to}
                    onChange={(e) => handleAdvancedInputChange('date_to', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Results Count */}
          {data && (
            <div className="mb-6 flex items-center justify-between">
              <p className="text-sm text-gray-700">
                找到 <span className="font-semibold">{data.total}</span> 筆 IVOD 紀錄
                {searchScope === 'transcript' && transcriptSearchResults.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    ・{transcriptSearchResults.length} 筆逐字稿符合關鍵字
                  </span>
                )}
                {searchScope === 'all' && filters.q && (
                  <span className="ml-2 text-green-600">
                    ・搜尋範圍：全部欄位
                  </span>
                )}
                {searchScope === 'transcript' && filters.q && (
                  <span className="ml-2 text-orange-600">
                    ・搜尋範圍：僅逐字稿
                  </span>
                )}
              </p>
              
              {loading && (
                <div className="flex items-center text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  搜尋中...
                </div>
              )}
            </div>
          )}

          {/* IVOD List */}
          <div className="mb-8">
            {loading && !data ? (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-gray-700">載入中...</p>
              </div>
            ) : data?.data && data.data.length > 0 ? (
              <List items={data.data} />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center" suppressHydrationWarning>
                <Icon type="search" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">沒有找到符合的資料</h3>
                <p className="text-gray-500">請嘗試調整搜尋條件或清除篩選</p>
              </div>
            )}
          </div>

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