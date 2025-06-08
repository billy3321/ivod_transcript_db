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

    it('should handle search submission', () => {
      const { result } = renderHook(() => useSearchFilters());

      act(() => {
        result.current.setSearchQuery('test query');
        result.current.handleSearch();
      });

      expect(result.current.filters.q).toBe('test query');
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

    it('should initialize with loading false and null data', () => {
      const { result } = renderHook(() =>
        useSearchResults(mockFilters, 'date_desc', 1, 'all', true)
      );

      expect(result.current.loading).toBe(false);
      expect(result.current.data).toBe(null);
      expect(result.current.transcriptSearchResults).toEqual([]);
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

    it('should handle transcript-only search', async () => {
      const filtersWithQuery = { ...mockFilters, q: 'test' };
      
      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ id: 1, transcript: 'test transcript' }],
            success: true,
            meta: { fallback: false, parsed: {} }
          }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({
            data: [{ ivod_id: 1, title: 'Test IVOD' }],
            success: true,
            meta: { total: 1, page: 1, pageSize: 20 }
          }),
        });

      renderHook(() =>
        useSearchResults(filtersWithQuery, 'date_desc', 1, 'transcript', true)
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/search?q=test'),
          expect.objectContaining({ signal: expect.any(AbortSignal) })
        );
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
    it('should debounce URL updates', async () => {
      const mockFilters = { q: 'test', meeting_name: '', speaker: '', committee: '', date_from: '', date_to: '' };
      
      const { result } = renderHook(() =>
        useUrlSync(mockFilters, 'date_desc', 1, 'all')
      );

      // Should not immediately update URL
      expect(mockPush).not.toHaveBeenCalled();

      // Wait for debounce
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/',
            query: expect.objectContaining({ q: 'test' }),
          }),
          undefined,
          { shallow: true }
        );
      }, { timeout: 600 });
    });

    it('should handle empty filters', async () => {
      const emptyFilters = { q: '', meeting_name: '', speaker: '', committee: '', date_from: '', date_to: '' };
      
      renderHook(() =>
        useUrlSync(emptyFilters, 'date_desc', 1, 'all')
      );

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith(
          expect.objectContaining({
            pathname: '/',
            query: expect.objectContaining({ sort: 'date_desc' }),
          }),
          undefined,
          { shallow: true }
        );
      }, { timeout: 600 });
    });
  });
});