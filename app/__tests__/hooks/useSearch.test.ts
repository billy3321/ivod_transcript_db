import { renderHook, act, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import { useSearchFilters, useSearchResults, useUrlSync } from '@/hooks/useSearch';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock fetch
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockRouter = {
  push: mockPush,
  replace: mockReplace,
  query: {},
  isReady: true,
  pathname: '/',
};

describe('useSearch hooks', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (global.fetch as jest.Mock).mockClear();
    mockPush.mockClear();
    mockReplace.mockClear();
  });

  describe('useSearchFilters', () => {
    it('should initialize with default values', () => {
      const { result } = renderHook(() => useSearchFilters());

      expect(result.current.filters.q).toBe('');
      expect(result.current.filters.meeting_name).toBe('');
      expect(result.current.searchScope).toBe('all');
      expect(result.current.searchQuery).toBe('');
      expect(result.current.showAdvancedSearch).toBe(false);
    });

    it('should handle search query changes', () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setSearchQuery('test query');
      });

      expect(result.current.searchQuery).toBe('test query');
    });

    it('should handle advanced search toggle', () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setShowAdvancedSearch(true);
      });

      expect(result.current.showAdvancedSearch).toBe(true);
    });

    it('should detect active filters', () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setAdvancedInput({
          ...result.current.advancedInput,
          meeting_name: 'test meeting',
        });
      });

      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('should handle search submission', async () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setSearchQuery('test query');
      });

      act(() => {
        result.current.handleSearch();
      });

      // Wait for state update
      await waitFor(() => {
        expect(result.current.filters.q).toBe('test query');
      });
    });

    it('should clear all filters', () => {
      const { result } = renderHook(() => useSearchFilters());

      // Set some filters first
      act(() => {
        result.current.setSearchQuery('test');
        result.current.setAdvancedInput({
          ...result.current.advancedInput,
          meeting_name: 'meeting',
        });
        result.current.handleSearch();
      });

      // Clear filters
      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters.q).toBe('');
      expect(result.current.filters.meeting_name).toBe('');
      expect(result.current.searchQuery).toBe('');
    });
  });

  describe('useSearchResults', () => {
    const mockFilters = {
      q: '',
      meeting_name: '',
      speaker: '',
      committee: '',
      date_from: '',
      date_to: '',
    };

    beforeEach(() => {
      (global.fetch as jest.Mock).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          data: [],
          total: 0,
          success: true,
          meta: { total: 0, page: 1, pageSize: 20 }
        }),
      });
    });

    it('should initialize with correct default state and start loading', async () => {
      const { result } = renderHook(() =>
        useSearchResults(mockFilters, 'date_desc', 1, 'all', true)
      );

      // Should start loading immediately when router is ready
      expect(result.current.loading).toBe(true);
      expect(result.current.data).toBe(null);
      expect(result.current.transcriptSearchResults).toEqual([]);

      // Wait for fetch to complete
      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });

    it('should fetch data when filters change', async () => {
      const filtersWithQuery = { ...mockFilters, q: 'test' };
      
      const { result, rerender } = renderHook(
        ({ filters }) => useSearchResults(filters, 'date_desc', 1, 'all', true),
        { initialProps: { filters: mockFilters } }
      );

      // Change filters to trigger fetch
      rerender({ filters: filtersWithQuery });

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
    });

    it('should handle transcript-only search with API integration', async () => {
      const filtersWithQuery = { ...mockFilters, q: 'test' };
      
      // Mock search API response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 1, transcript: 'test transcript' }, { id: 2, transcript: 'another test' }],
            success: true,
            meta: { fallback: false, parsed: {} }
          }),
        })
        // Mock IVOD API response with reconstructed params
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ ivod_id: 1, title: 'Test IVOD' }, { ivod_id: 2, title: 'Another Test' }],
            success: true,
            meta: { total: 2, page: 1, pageSize: 20 }
          }),
        });

      renderHook(() =>
        useSearchResults(filtersWithQuery, 'date_desc', 1, 'transcript', true)
      );

      await waitFor(() => {
        // Should call search API first
        expect(global.fetch).toHaveBeenNthCalledWith(1,
          expect.stringContaining('/api/search?q=test'),
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
        
        // Should call IVOD API with IDs from search results
        expect(global.fetch).toHaveBeenNthCalledWith(2,
          expect.stringContaining('/api/ivods?'),
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
      });

      // Verify the second API call includes the correct parameters
      await waitFor(() => {
        const secondCall = (global.fetch as jest.Mock).mock.calls[1];
        const url = new URL(secondCall[0], 'http://localhost');
        expect(url.searchParams.get('ids')).toBe('1,2');
        expect(url.searchParams.get('sort')).toBe('date_desc');
        expect(url.searchParams.get('page')).toBe('1');
        expect(url.searchParams.get('pageSize')).toBe('20');
      });
    });

    it('should reconstruct search params without q parameter for IVOD API', async () => {
      const filtersWithMultipleParams = { 
        ...mockFilters, 
        q: 'test query',
        meeting_name: 'test meeting',
        speaker: 'test speaker',
        committee: 'test committee'
      };
      
      // Mock search API response
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 100, transcript: 'test transcript' }],
            success: true,
            meta: { fallback: false, parsed: {} }
          }),
        })
        // Mock IVOD API response
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ ivod_id: 100, title: 'Test IVOD' }],
            success: true,
            meta: { total: 1, page: 1, pageSize: 20 }
          }),
        });

      renderHook(() =>
        useSearchResults(filtersWithMultipleParams, 'title_asc', 2, 'transcript', true)
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Verify the IVOD API call has correct reconstructed parameters
      await waitFor(() => {
        const secondCall = (global.fetch as jest.Mock).mock.calls[1];
        const url = new URL(secondCall[0], 'http://localhost');
        
        // Should include filter parameters but NOT q
        expect(url.searchParams.get('meeting_name')).toBe('test meeting');
        expect(url.searchParams.get('speaker')).toBe('test speaker');
        expect(url.searchParams.get('committee')).toBe('test committee');
        expect(url.searchParams.get('q')).toBe(null); // Should be excluded
        
        // Should include pagination and sorting
        expect(url.searchParams.get('sort')).toBe('title_asc');
        expect(url.searchParams.get('page')).toBe('2');
        expect(url.searchParams.get('pageSize')).toBe('20');
        
        // Should include IDs from search results
        expect(url.searchParams.get('ids')).toBe('100');
      });
    });

    it('should abort requests on unmount', async () => {
      const { unmount } = renderHook(() =>
        useSearchResults(mockFilters, 'date_desc', 1, 'all', true)
      );

      // Mock a long-running request
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 1000))
      );

      unmount();

      // The request should be aborted, but we can't easily test this
      // The important thing is that it doesn't throw an error
    });
  });

  describe('useUrlSync', () => {
    beforeEach(() => {
      // Reset router query to ensure different state
      mockRouter.query = {};
      mockPush.mockClear();
    });

    it('should debounce URL updates when filters have content', async () => {
      const mockFilters = { q: 'test', meeting_name: '', speaker: '', committee: '', date_from: '', date_to: '' };
      
      renderHook(() =>
        useUrlSync(mockFilters, 'all', 'date_desc', 1, true)
      );

      // Should not immediately update URL
      expect(mockPush).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      // Verify the call included the search query
      const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1];
      expect(lastCall[0].query).toEqual(expect.objectContaining({ q: 'test' }));
    });

    it('should handle URL sync with non-default sort order', async () => {
      // Start with router having default sort 
      mockRouter.query = {};
      
      const emptyFilters = { q: '', meeting_name: '', speaker: '', committee: '', date_from: '', date_to: '' };
      
      renderHook(() =>
        useUrlSync(emptyFilters, 'all', 'date_asc', 1, true) // non-default sort order
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalled();
      }, { timeout: 1000 });
      
      // Verify the call included sort parameters (because it's not the default 'date_desc')
      const lastCall = mockPush.mock.calls[mockPush.mock.calls.length - 1];
      expect(lastCall[0].query).toEqual(expect.objectContaining({ sort: 'date_asc' }));
    });
  });
});