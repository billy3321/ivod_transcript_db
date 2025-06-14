import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useRouter } from 'next/router';
import { IVOD } from '@/types';
import { SearchScope } from '@/components/SearchHeader';

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

export const useSearchFilters = () => {
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
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState<'date_desc' | 'date_asc'>('date_desc');
  const [page, setPage] = useState(1);
  const [showAdvancedSearch, setShowAdvancedSearch] = useState(false);

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
  }, [router.isReady, router.asPath, router.query]);

  // Reset page when filters change (but not page itself)
  const prevFiltersRef = useRef<SearchFilters>(filters);
  useEffect(() => {
    const prevFilters = prevFiltersRef.current;
    const hasFilterChanged = Object.keys(filters).some(key => 
      filters[key as keyof SearchFilters] !== prevFilters[key as keyof SearchFilters]
    );
    
    if (hasFilterChanged && page !== 1) {
      setPage(1);
    }
    
    prevFiltersRef.current = filters;
  }, [filters, page]);

  const handleSearch = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      q: searchQuery,
      meeting_name: advancedInput.meeting_name,
      speaker: advancedInput.speaker,
      committee: advancedInput.committee,
      date_from: advancedInput.date_from,
      date_to: advancedInput.date_to
    }));
  }, [searchQuery, advancedInput]);

  const handleKeyPress = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  }, [handleSearch]);

  const clearFilters = useCallback(() => {
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
  }, []);

  const hasActiveFilters = useMemo(() => 
    Object.values(filters).some(Boolean) || Object.values(advancedInput).some(Boolean),
    [filters, advancedInput]
  );

  return {
    filters,
    setFilters,
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
  };
};

export const useSearchResults = (
  filters: SearchFilters,
  sortOrder: 'date_desc' | 'date_asc',
  page: number,
  searchScope: SearchScope,
  routerReady: boolean
) => {
  const [data, setData] = useState<{ data: IVOD[]; meta: { total: number; page: number; pageSize: number } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [transcriptSearchResults, setTranscriptSearchResults] = useState<{ id: number; transcript: string }[]>([]);
  const mountedRef = useRef(true);

  // Safe state setters that check if component is still mounted
  const safeSetData = useCallback((newData: { data: IVOD[]; meta: { total: number; page: number; pageSize: number } } | null) => {
    if (mountedRef.current) {
      setData(newData);
    }
  }, []);

  const safeSetTranscriptSearchResults = useCallback((results: { id: number; transcript: string }[]) => {
    if (mountedRef.current) {
      setTranscriptSearchResults(results);
    }
  }, []);

  const safeSetLoading = useCallback((isLoading: boolean) => {
    if (mountedRef.current) {
      setLoading(isLoading);
    }
  }, []);

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

  // Fetch data when search params change
  useEffect(() => {
    if (!routerReady) return;
    
    const controller = new AbortController();
    safeSetLoading(true);
    
    const fetchData = async () => {
      try {
        if (searchScope === 'transcript' && filters.q) {
          // For transcript-only search, use /api/search first, then get IVOD details
          const searchResponse = await fetch(`/api/search?q=${encodeURIComponent(filters.q)}`, {
            signal: controller.signal
          });
          const searchData = await searchResponse.json();
          const searchResultsWithExcerpts = searchData.data || [];
          safeSetTranscriptSearchResults(searchResultsWithExcerpts);
          
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
            
            const ivodResponse = await fetch(`/api/ivods?${transcriptSearchParams.toString()}`, {
              signal: controller.signal
            });
            const ivodData = await ivodResponse.json();
            
            // Merge search excerpts into IVOD data
            if (searchResultsWithExcerpts.length > 0 && ivodData.data) {
              const transcriptMap = new Map(searchResultsWithExcerpts.map((item: any) => [item.id, item.excerpt]));
              ivodData.data = ivodData.data.map((ivod: any) => ({
                ...ivod,
                excerpt: transcriptMap.get(ivod.ivod_id)
              }));
            }
            safeSetData(ivodData);
          } else {
            safeSetData({ data: [], meta: { total: 0, page: page, pageSize: 20 } });
          }
        } else if (filters.q && searchScope === 'all') {
          // For general search with query, also get search excerpts
          const searchResponse = await fetch(`/api/search?q=${encodeURIComponent(filters.q)}`, {
            signal: controller.signal
          });
          const searchData = await searchResponse.json();
          const searchResultsWithExcerpts = searchData.data || [];
          safeSetTranscriptSearchResults(searchResultsWithExcerpts);
          
          if (searchData.data && searchData.data.length > 0) {
            // Get IVOD IDs from search results to ensure we only get matching records
            const ivodIds = searchData.data.map((item: any) => item.id);
            
            // Create search params without q parameter, only including other filters
            const matchingSearchParams = new URLSearchParams();
            Object.entries(filters).forEach(([key, value]) => {
              if (value && key !== 'q') matchingSearchParams.append(key, value);
            });
            matchingSearchParams.append('sort', sortOrder);
            matchingSearchParams.append('page', page.toString());
            matchingSearchParams.append('pageSize', '20');
            matchingSearchParams.append('ids', ivodIds.join(','));
            
            const ivodResponse = await fetch(`/api/ivods?${matchingSearchParams.toString()}`, {
              signal: controller.signal
            });
            const ivodData = await ivodResponse.json();
            
            // Merge excerpts into IVOD data
            if (searchResultsWithExcerpts.length > 0 && ivodData.data) {
              const transcriptMap = new Map(searchResultsWithExcerpts.map((item: any) => [item.id, item.excerpt]));
              ivodData.data = ivodData.data.map((ivod: any) => ({
                ...ivod,
                excerpt: transcriptMap.get(ivod.ivod_id)
              }));
            }
            safeSetData(ivodData);
          } else {
            safeSetData({ data: [], meta: { total: 0, page: page, pageSize: 20 } });
          }
        } else {
          // No query or other search conditions, just get IVOD data
          const ivodResponse = await fetch(`/api/ivods?${searchParams}`, {
            signal: controller.signal
          });
          const ivodData = await ivodResponse.json();
          safeSetData(ivodData);
          safeSetTranscriptSearchResults([]);
        }
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          console.error('Error fetching data:', error);
          safeSetData({ data: [], meta: { total: 0, page: page, pageSize: 20 } });
          safeSetTranscriptSearchResults([]);
        }
      } finally {
        // Only update loading state if component is still mounted and request wasn't aborted
        if (!controller.signal.aborted && mountedRef.current) {
          safeSetLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      controller.abort();
    };
  }, [searchParams, filters, sortOrder, page, searchScope, routerReady]);

  // Cleanup effect - set mounted to false only on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    data,
    loading,
    transcriptSearchResults,
  };
};

export const useUrlSync = (
  filters: SearchFilters,
  searchScope: SearchScope,
  sortOrder: 'date_desc' | 'date_asc',
  page: number,
  routerReady: boolean
) => {
  const router = useRouter();

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
    if (!routerReady) return;
    
    const timeoutId = setTimeout(() => {
      const currentQueryString = new URLSearchParams(router.query as any).toString();
      const newQueryString = new URLSearchParams(urlQueryParams).toString();
      
      if (currentQueryString !== newQueryString) {
        router.push({
          pathname: '/',
          query: urlQueryParams
        }, undefined, { shallow: true });
      }
    }, 300); // Increased debounce time for better performance

    return () => clearTimeout(timeoutId);
  }, [urlQueryParams, router, routerReady]);
};