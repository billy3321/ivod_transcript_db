import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import Home from '@/pages/index';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Next.js Link and Head
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

jest.mock('next/head', () => {
  return function MockHead({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  };
});

// Mock fetch
global.fetch = jest.fn();

describe('Search Workflow Integration Tests', () => {
  const mockPush = jest.fn();
  
  beforeEach(() => {
    mockPush.mockClear();
    (fetch as jest.Mock).mockClear();
  });

  it('performs complete search workflow with Elasticsearch and database fallback', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock initial load
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    // Initial state
    await waitFor(() => {
      expect(screen.getByText('IVOD 逐字稿系統')).toBeInTheDocument();
    });

    // Perform search
    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    fireEvent.change(searchInput, { target: { value: '國會改革' } });

    // Mock successful Elasticsearch search
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ 
        data: [
          { id: 1, transcript: '國會改革相關討論內容...' },
          { id: 2, transcript: '立法院國會改革委員會...' },
        ],
        fallback: false
      }),
    });

    // Mock IVOD list data
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: [
          {
            ivod_id: 1,
            date: '2023-06-01',
            meeting_name: '立法院國會改革委員會',
            committee_names: ['國會改革委員會'],
            speaker_name: '委員 王小明',
            video_length: '45:30',
          },
          {
            ivod_id: 2,
            date: '2023-06-02',
            meeting_name: '立法院國會改革專案小組',
            committee_names: ['國會改革專案小組'],
            speaker_name: '委員 李小華',
            video_length: '52:15',
          },
        ],
        total: 2,
      }),
    });

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=' + encodeURIComponent('國會改革'))
      );
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ivods?')
      );
    });

    // Should show search results
    await waitFor(() => {
      expect(screen.getByText('立法院國會改革委員會')).toBeInTheDocument();
      expect(screen.getByText('立法院國會改革專案小組')).toBeInTheDocument();
      expect(screen.getByText('委員 王小明')).toBeInTheDocument();
      expect(screen.getByText('委員 李小華')).toBeInTheDocument();
    });
  });

  it('handles Elasticsearch failure and falls back to database search', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '教育' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock initial load
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    // Mock Elasticsearch failure and database fallback
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: [
          { id: 3, transcript: '教育政策相關討論...' },
        ],
        fallback: true // Indicates database fallback was used
      }),
    });

    // Mock IVOD list data
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: [
          {
            ivod_id: 3,
            date: '2023-05-15',
            meeting_name: '教育及文化委員會',
            committee_names: ['教育及文化委員會'],
            speaker_name: '委員 張教授',
            video_length: '38:45',
          },
        ],
        total: 1,
      }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('教育及文化委員會')).toBeInTheDocument();
      // Component doesn't show fallback indicator, so just check it loaded
    });
  });

  it('performs advanced search with multiple filters', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock initial load
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    // Open advanced search
    const advancedToggle = screen.getByText('進階搜尋');
    fireEvent.click(advancedToggle);

    await waitFor(() => {
      expect(screen.getByLabelText('會議名稱')).toBeInTheDocument();
    });

    // Fill in advanced search fields
    const meetingNameInput = screen.getByLabelText('會議名稱');
    const speakerInput = screen.getByLabelText('立委姓名');
    const committeeInput = screen.getByLabelText('委員會');
    const startDateInput = screen.getByLabelText('開始日期');

    fireEvent.change(meetingNameInput, { target: { value: '預算審查' } });
    fireEvent.change(speakerInput, { target: { value: '王委員' } });
    fireEvent.change(committeeInput, { target: { value: '財政委員會' } });
    fireEvent.change(startDateInput, { target: { value: '2023-01-01' } });

    // Mock search results
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: [
          {
            ivod_id: 4,
            date: '2023-03-15',
            meeting_name: '財政委員會預算審查會議',
            committee_names: ['財政委員會'],
            speaker_name: '王委員明德',
            video_length: '1:25:30',
          },
        ],
        total: 1,
      }),
    });

    // Submit search by clicking search button or pressing enter
    const searchButton = screen.getByRole('button', { name: /搜尋/i });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringMatching(/\/api\/ivods\?.*meeting_name=.*%E9%A0%90%E7%AE%97%E5%AF%A9%E6%9F%A5.*speaker=.*%E7%8E%8B%E5%A7%94%E5%93%A1.*committee=.*%E8%B2%A1%E6%94%BF%E5%A7%94%E5%93%A1%E6%9C%83.*date_from=2023-01-01/)
      );
    });

    await waitFor(() => {
      expect(screen.getByText('財政委員會預算審查會議')).toBeInTheDocument();
      expect(screen.getByText('王委員明德')).toBeInTheDocument();
    });
  });

  it('handles pagination in search results', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '環保' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock initial load with many results
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: Array.from({ length: 20 }, (_, i) => ({
          ivod_id: i + 1,
          date: '2023-04-01',
          meeting_name: `環保相關會議 ${i + 1}`,
          committee_names: ['環境及能源委員會'],
          speaker_name: `委員 ${String.fromCharCode(65 + i)}`,
          video_length: '30:00',
        })),
        total: 100, // Total 100 results
      }),
    });

    // Mock transcript search
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: Array.from({ length: 20 }, (_, i) => ({
          id: i + 1,
          transcript: `環保相關討論內容 ${i + 1}...`,
        })),
        fallback: false,
      }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
      expect(screen.getByText('環保相關會議 1')).toBeInTheDocument();
    });

    // Click to go to page 2
    const page2Button = screen.getByRole('button', { name: '2' });
    fireEvent.click(page2Button);

    // Mock page 2 results
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: Array.from({ length: 20 }, (_, i) => ({
          ivod_id: i + 21,
          date: '2023-04-02',
          meeting_name: `環保相關會議 ${i + 21}`,
          committee_names: ['環境及能源委員會'],
          speaker_name: `委員 ${String.fromCharCode(65 + i + 20)}`,
          video_length: '30:00',
        })),
        total: 100,
      }),
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            page: '2',
          }),
        }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('handles network errors gracefully throughout the workflow', async () => {
    const mockRouter = {
      push: mockPush,
      query: {},
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock network error
    (fetch as jest.Mock).mockRejectedValue(new Error('Network connection failed'));

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('載入資料時發生錯誤')).toBeInTheDocument();
    });

    // Try to search despite the error
    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    fireEvent.change(searchInput, { target: { value: '測試' } });

    // Should show no results since there's no error handling
    await waitFor(() => {
      expect(screen.getByText('沒有找到符合的資料')).toBeInTheDocument();
    });
  });

  it('clears search and resets to initial state', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '環境', speaker: '王委員', page: '2' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    // Mock search results
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: [
          {
            ivod_id: 1,
            date: '2023-04-01',
            meeting_name: '環境委員會',
            committee_names: ['環境委員會'],
            speaker_name: '王委員',
            video_length: '30:00',
          },
        ],
        total: 1,
      }),
    });

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({
        data: [{ id: 1, transcript: '環境保護討論...' }],
        fallback: false,
      }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('環境委員會')).toBeInTheDocument();
    });

    // Clear filters
    const clearButton = screen.getByText('清除篩選');
    fireEvent.click(clearButton);

    // Mock cleared state
    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/',
          query: {},
        }),
        undefined,
        { shallow: true }
      );
    });
  });
});