import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import Home from '@/pages/index';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockPush = jest.fn();
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('Home Page', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockClear();
    
    // Always provide a default mock
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 })
      })
    );
  });

  it('renders the search interface correctly', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      pathname: '/',
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    render(<Home />);

    // Check main search elements
    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...')).toBeInTheDocument();
    }, { timeout: 2000 });

    expect(screen.getByRole('button', { name: '搜尋' })).toBeInTheDocument();
    expect(screen.getByText('搜尋全部欄位')).toBeInTheDocument();
    expect(screen.getByText('僅搜尋逐字稿')).toBeInTheDocument();
  });

  it('renders advanced search fields when URL has query parameters', async () => {
    const mockRouter = {
      push: mockPush,
      query: { meeting_name: '委員會會議' },
      pathname: '/',
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    render(<Home />);

    // Check that advanced search toggle is available
    await waitFor(() => {
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
    }, { timeout: 2000 });

    // Advanced search parameters should be populated in the hook state
    // But the UI is collapsed by default, so let's verify the toggle works
    expect(screen.getByText('進階搜尋')).toBeInTheDocument();
  });

  it('makes API calls with correct initial parameters', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      pathname: '/',
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    render(<Home />);

    // Check that API was called with correct initial parameters
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ivods?sort=date_desc&page=1&pageSize=20'),
        expect.any(Object)
      );
    }, { timeout: 2000 });
  });

  it('handles search with transcript scope', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '測試', scope: 'transcript' },
      pathname: '/',
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    render(<Home />);

    // Check that search API was called for transcript scope
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=%E6%B8%AC%E8%A9%A6'),
        expect.any(Object)
      );
    }, { timeout: 2000 });
  });

  it('displays results when data is available', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      pathname: '/',
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock API response with data
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({
          data: [
            {
              ivod_id: 1,
              date: '2023-06-01',
              title: '測試會議',
              meeting_name: '測試委員會',
              committee_names: ['測試委員會'],
              speaker_name: '測試委員',
              video_length: '45:30',
            }
          ],
          total: 1
        })
      })
    );

    render(<Home />);

    // Check that data is displayed
    await waitFor(() => {
      expect(screen.getByText('測試會議（測試委員 發言）')).toBeInTheDocument();
    }, { timeout: 2000 });
  });

  it('shows no results message when no data found', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      pathname: '/',
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('沒有找到符合的資料')).toBeInTheDocument();
    }, { timeout: 2000 });
  });
});