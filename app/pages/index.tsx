import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { IVOD } from '@/types';
import List from '@/components/List';
import Pagination from '@/components/Pagination';

interface SearchFilters {
  q: string;
  meeting_name: string;
  speaker: string;
  committee: string;
  date_from: string;
  date_to: string;
}

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
      setSortOrder(sort as 'date_desc' | 'date_asc');
      setPage(parseInt(urlPage as string) || 1);
    }
  }, [router.isReady, router.query]);

  // Memoize search params to prevent unnecessary re-renders
  const searchParams = useMemo(() => {
    const params = new URLSearchParams();
    
    // Add all active filters to params
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    params.append('sort', sortOrder);
    params.append('page', page.toString());
    params.append('pageSize', '20');
    
    return params.toString();
  }, [filters, sortOrder, page]);

  // Memoize URL query params to prevent unnecessary router updates
  const urlQueryParams = useMemo(() => {
    const queryParams: any = {};
    Object.entries(filters).forEach(([key, value]) => {
      if (value) queryParams[key] = value;
    });
    
    if (sortOrder !== 'date_desc') queryParams.sort = sortOrder;
    if (page !== 1) queryParams.page = page.toString();
    
    return queryParams;
  }, [filters, sortOrder, page]);

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
    
    Promise.all([
      fetch(`/api/ivods?${searchParams}`).then(res => res.json()),
      filters.q 
        ? fetch(`/api/search?q=${encodeURIComponent(filters.q)}`).then(res => res.json())
        : Promise.resolve({ data: [] })
    ])
    .then(([ivodData, searchData]) => {
      setData(ivodData);
      setTranscriptSearchResults(searchData.data || []);
    })
    .catch(error => {
      console.error('Error fetching data:', error);
      setData({ data: [], total: 0 });
      setTranscriptSearchResults([]);
    })
    .finally(() => setLoading(false));
  }, [searchParams, filters.q, router.isReady]);

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
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
    setSortOrder('date_desc');
  };

  const hasActiveFilters = Object.values(filters).some(Boolean);

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-700">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>IVOD 逐字稿檢索系統</title>
        <meta name="description" content="台灣立法院 IVOD 逐字稿檢索與瀏覽系統" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* Simple Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">IVOD 逐字稿檢索系統</h1>
            <p className="mt-1 text-gray-600">台灣立法院會議錄影與逐字稿檢索</p>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Search Section */}
          <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
            {/* Main Search */}
            <div className="relative mb-4">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="搜尋會議名稱、立委姓名、逐字稿內容..."
                value={filters.q}
                onChange={(e) => handleFilterChange('q', e.target.value)}
                className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Search Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <button
                onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
              >
                <svg className={`w-4 h-4 mr-1 transform transition-transform ${showAdvancedSearch ? 'rotate-180' : ''}`} fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
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
                    value={filters.meeting_name}
                    onChange={(e) => handleFilterChange('meeting_name', e.target.value)}
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
                    value={filters.speaker}
                    onChange={(e) => handleFilterChange('speaker', e.target.value)}
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
                    value={filters.committee}
                    onChange={(e) => handleFilterChange('committee', e.target.value)}
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
                    value={filters.date_from}
                    onChange={(e) => handleFilterChange('date_from', e.target.value)}
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
                    value={filters.date_to}
                    onChange={(e) => handleFilterChange('date_to', e.target.value)}
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
                {transcriptSearchResults.length > 0 && (
                  <span className="ml-2 text-blue-600">
                    ・{transcriptSearchResults.length} 筆逐字稿符合關鍵字
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
            {data?.data && data.data.length > 0 ? (
              <List items={data.data} />
            ) : (
              !loading && (
                <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">沒有找到符合的資料</h3>
                  <p className="text-gray-500">請嘗試調整搜尋條件或清除篩選</p>
                </div>
              )
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
        </main>
      </div>
    </>
  );
}