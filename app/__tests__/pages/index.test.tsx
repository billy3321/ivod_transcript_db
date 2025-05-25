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

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  query: {},
  isReady: true,
};

describe('Home Page', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (fetch as jest.Mock).mockClear();
    mockPush.mockClear();
  });

  it('renders the main search interface', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('IVOD 逐字稿系統')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...')).toBeInTheDocument();
      expect(screen.getByText('進階搜尋')).toBeInTheDocument();
    });
  });

  it('handles search input and updates URL', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText('搜尋會議名稱、立委姓名、逐字稿內容...');
    fireEvent.change(searchInput, { target: { value: '測試搜尋' } });

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
    (fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

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

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve(mockData),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [] }),
      });

    render(<Home />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/ivods?sort=date_desc&page=1&pageSize=20')
      );
    });
  });

  it('handles search with transcript search', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '測試' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    (fetch as jest.Mock)
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [], total: 0 }),
      })
      .mockResolvedValueOnce({
        json: () => Promise.resolve({ data: [{ id: 1, transcript: 'test transcript' }] }),
      });

    render(<Home />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search?q=%E6%B8%AC%E8%A9%A6')
      );
    });
  });

  it('clears all filters when clear button is clicked', async () => {
    const mockRouter = {
      push: mockPush,
      query: { q: '測試', speaker: '測試立委' },
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(mockRouter);

    (fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

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
    });
  });

  it('shows no results message when no data found', async () => {
    (fetch as jest.Mock).mockResolvedValue({
      json: () => Promise.resolve({ data: [], total: 0 }),
    });

    render(<Home />);

    await waitFor(() => {
      expect(screen.getByText('沒有找到符合的資料')).toBeInTheDocument();
      expect(screen.getByText('請嘗試調整搜尋條件或清除篩選')).toBeInTheDocument();
    });
  });
});