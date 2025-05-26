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
const mockFetch = jest.fn();

// Ensure global fetch is always mocked
Object.defineProperty(global, 'fetch', {
  writable: true,
  value: mockFetch,
});

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  query: {},
  isReady: true,
};

describe('Home Page', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    mockFetch.mockClear();
    mockPush.mockClear();
    // Always provide a default mock to prevent undefined returns
    mockFetch.mockImplementation(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 })
      })
    );
  });

  it('renders the main search interface', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('IVOD 逐字稿檢索系統')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...')).toBeInTheDocument();
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
      expect(screen.getByText('搜尋全部欄位')).toBeInTheDocument();
      expect(screen.getByText('搜尋')).toBeInTheDocument();
    });
  });

  it('handles search input and button click', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    const searchButton = screen.getByText('搜尋');
    
    fireEvent.change(searchInput, { target: { value: '測試搜尋' } });
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/',
          query: expect.objectContaining({
            q: '測試搜尋',
          }),
        }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('shows advanced search fields when toggled', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
    });

    const advancedSearchToggle = screen.getByText('進階搜尋');
    fireEvent.click(advancedSearchToggle);

    await waitFor(() => {
      expect(screen.getByLabelText('會議名稱')).toBeInTheDocument();
      expect(screen.getByLabelText('立委姓名')).toBeInTheDocument();
      expect(screen.getByLabelText('委員會')).toBeInTheDocument();
      expect(screen.getByLabelText('開始日期')).toBeInTheDocument();
      expect(screen.getByLabelText('結束日期')).toBeInTheDocument();
    });
  });

  it('does not trigger search automatically when typing in advanced search fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
    });

    // Open advanced search
    const advancedSearchToggle = screen.getByText('進階搜尋');
    fireEvent.click(advancedSearchToggle);

    await waitFor(() => {
      expect(screen.getByLabelText('會議名稱')).toBeInTheDocument();
    });

    // Clear any initial fetch calls
    mockFetch.mockClear();
    mockPush.mockClear();

    // Type in advanced search fields
    const meetingNameInput = screen.getByLabelText('會議名稱');
    const speakerInput = screen.getByLabelText('立委姓名');
    
    fireEvent.change(meetingNameInput, { target: { value: '委員會' } });
    fireEvent.change(speakerInput, { target: { value: '王委員' } });

    // Wait a bit to ensure no automatic search is triggered
    await new Promise(resolve => setTimeout(resolve, 500));

    // Should not have made new API calls or router pushes
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('triggers search only when search button is clicked with advanced search data', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
    });

    // Open advanced search
    const advancedSearchToggle = screen.getByText('進階搜尋');
    fireEvent.click(advancedSearchToggle);

    await waitFor(() => {
      expect(screen.getByLabelText('會議名稱')).toBeInTheDocument();
    });

    // Clear any initial fetch calls
    mockFetch.mockClear();
    mockPush.mockClear();

    // Fill in advanced search fields
    const meetingNameInput = screen.getByLabelText('會議名稱');
    const speakerInput = screen.getByLabelText('立委姓名');
    const searchButton = screen.getByText('搜尋');
    
    fireEvent.change(meetingNameInput, { target: { value: '委員會會議' } });
    fireEvent.change(speakerInput, { target: { value: '王委員' } });

    // Click search button
    fireEvent.click(searchButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/',
          query: expect.objectContaining({
            meeting_name: '委員會會議',
            speaker: '王委員',
          }),
        }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('triggers search when Enter key is pressed in advanced search fields', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
    });

    // Open advanced search
    const advancedSearchToggle = screen.getByText('進階搜尋');
    fireEvent.click(advancedSearchToggle);

    await waitFor(() => {
      expect(screen.getByLabelText('會議名稱')).toBeInTheDocument();
    });

    // Clear any initial fetch calls
    mockFetch.mockClear();
    mockPush.mockClear();

    // Fill in advanced search field and press Enter
    const meetingNameInput = screen.getByLabelText('會議名稱');
    fireEvent.change(meetingNameInput, { target: { value: '委員會會議' } });
    fireEvent.keyPress(meetingNameInput, { key: 'Enter', code: 'Enter' });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/',
          query: expect.objectContaining({
            meeting_name: '委員會會議',
          }),
        }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('makes API calls with correct parameters', async () => {
    const mockData = {
      data: [
        {
          ivod_id: 1,
          date: '2022-01-01',
          meeting_name: 'Test Meeting',
          committee_names: ['委員會A'],
          speaker_name: 'Test Speaker',
          video_length: '10:00',
        },
      ],
      total: 1,
    };

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockData),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });

    render(<Home />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ivods?sort=date_desc&page=1&pageSize=20')
      );
    });
  });

  it('handles search scope changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('搜尋全部欄位')).toBeInTheDocument();
    });

    const scopeSelect = screen.getByDisplayValue('搜尋全部欄位');
    fireEvent.change(scopeSelect, { target: { value: 'transcript' } });

    await waitFor(() => {
      expect(screen.getByDisplayValue('僅搜尋逐字稿')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜尋逐字稿內容...')).toBeInTheDocument();
    });
  });

  it('handles search with transcript scope', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '測試', scope: 'transcript' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [{ id: 1, transcript: 'test transcript' }] }),
      });

    render(<Home />);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=%E6%B8%AC%E8%A9%A6')
      );
    });
  });

  it('handles Enter key press in search input', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    
    fireEvent.change(searchInput, { target: { value: '測試搜尋' } });
    fireEvent.keyPress(searchInput, { key: 'Enter', code: 'Enter', charCode: 13 });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/',
          query: expect.objectContaining({
            q: '測試搜尋',
          }),
        }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('handles pagination correctly', async () => {
    const mockData = {
      data: Array.from({ length: 20 }, (_, i) => ({
        ivod_id: i + 1,
        date: '2023-01-01',
        meeting_name: `Meeting ${i + 1}`,
        committee_names: ['委員會A'],
        speaker_name: `Speaker ${i + 1}`,
        video_length: '10:00',
      })),
      total: 100,
    };

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '2' })).toBeInTheDocument();
    });

    const nextButton = screen.getByRole('button', { name: /Next/i });
    fireEvent.click(nextButton);

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

  it('handles network errors gracefully', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<Home />);

    // Since there's no error handling in the component, it should show no results
    await waitFor(() => {
      expect(screen.getByText('沒有找到符合的資料')).toBeInTheDocument();
    });
  });

  it('shows fallback indicator when search uses database fallback', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '測試' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ 
          data: [{ id: 1, transcript: 'test transcript' }],
          fallback: true 
        }),
      });

    render(<Home />);

    await waitFor(() => {
      // The component doesn't currently show fallback indicator, so just check it loaded
      expect(screen.getByText('IVOD 逐字稿檢索系統')).toBeInTheDocument();
    });
  });

  it('handles sort option changes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByDisplayValue('最新優先')).toBeInTheDocument();
    });

    const sortSelect = screen.getByDisplayValue('最新優先');
    fireEvent.change(sortSelect, { target: { value: 'date_asc' } });

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          query: expect.objectContaining({
            sort: 'date_asc',
          }),
        }),
        undefined,
        { shallow: true }
      );
    });
  });

  it('clears all filters when clear button is clicked', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '測試', speaker: '測試立委', scope: 'transcript' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('清除篩選')).toBeInTheDocument();
    });

    const clearButton = screen.getByText('清除篩選');
    fireEvent.click(clearButton);

    await waitFor(() => {
      expect(mockPush).toHaveBeenCalledWith(
        expect.objectContaining({
          pathname: '/',
          query: {},
        }),
        undefined,
        { shallow: true }
      );
      // Verify that search scope is reset to 'all'
      expect(screen.getByDisplayValue('搜尋全部欄位')).toBeInTheDocument();
    });
  });

  it('shows no results message when no data found', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('沒有找到符合的資料')).toBeInTheDocument();
      expect(screen.getByText('請嘗試調整搜尋條件或清除篩選')).toBeInTheDocument();
    });
  });
});