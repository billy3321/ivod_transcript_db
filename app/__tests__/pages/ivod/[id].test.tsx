import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { useRouter } from 'next/router';
import IvodDetail from '@/pages/ivod/[id]';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock Next.js Link
jest.mock('next/link', () => {
  return function MockLink({ children, href }: { children: React.ReactNode; href: string }) {
    return <a href={href}>{children}</a>;
  };
});

// Mock TranscriptViewer component
jest.mock('@/components/TranscriptViewer', () => {
  return function MockTranscriptViewer({ transcript }: { transcript: string }) {
    return <div data-testid="transcript-viewer">{transcript}</div>;
  };
});

// Mock fetch
global.fetch = jest.fn();

const mockPush = jest.fn();
const mockRouter = {
  push: mockPush,
  query: { id: '123' },
  isReady: true,
};

describe('IVOD Detail Page', () => {
  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    (fetch as jest.Mock).mockClear();
    mockPush.mockClear();
  });

  it('shows loading state initially', () => {
    (fetch as jest.Mock).mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<IvodDetail />);

    expect(screen.getByText('載入中...')).toBeInTheDocument();
  });

  it('renders IVOD details after loading', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A', '委員會B'],
        video_length: '10:00',
        video_url: 'https://example.com/video.mp4',
        ivod_url: 'https://example.com/ivod',
        ai_transcript: 'AI generated transcript content',
        ly_transcript: 'Legislative Yuan transcript content',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('Test Meeting')).toBeInTheDocument();
      expect(screen.getByText('2022-01-01')).toBeInTheDocument();
      expect(screen.getByText('Test Speaker')).toBeInTheDocument();
      expect(screen.getByText('委員會A, 委員會B')).toBeInTheDocument();
      expect(screen.getByText('10:00')).toBeInTheDocument();
    });
  });

  it('switches between AI and LY transcripts', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A'],
        video_length: '10:00',
        ai_transcript: 'AI transcript content',
        ly_transcript: 'LY transcript content',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('AI transcript content')).toBeInTheDocument();
    });

    // Switch to LY transcript
    const lyTab = screen.getByText('立院逐字稿');
    fireEvent.click(lyTab);

    await waitFor(() => {
      expect(screen.getByText('LY transcript content')).toBeInTheDocument();
    });
  });

  it('shows placeholder when transcripts are not available', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A'],
        video_length: '10:00',
        ai_transcript: null,
        ly_transcript: null,
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('AI 逐字稿尚未提供')).toBeInTheDocument();
    });

    // Switch to LY transcript
    const lyTab = screen.getByText('立院逐字稿');
    fireEvent.click(lyTab);

    await waitFor(() => {
      expect(screen.getByText('立院逐字稿尚未提供')).toBeInTheDocument();
    });
  });

  it('shows video placeholder when video URL is not available', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A'],
        video_length: '10:00',
        video_url: null,
        ai_transcript: 'Test transcript',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('影片尚未提供')).toBeInTheDocument();
    });
  });

  it('renders external links correctly', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A'],
        video_length: '10:00',
        ivod_url: 'https://example.com/ivod/123',
        ai_transcript: 'Test transcript',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      const ivodLink = screen.getByText('查看原始IVOD').closest('a');
      const datalyLink = screen.getByText('在 Dataly 查看').closest('a');

      expect(ivodLink).toHaveAttribute('href', 'https://example.com/ivod/123');
      expect(ivodLink).toHaveAttribute('target', '_blank');
      
      expect(datalyLink).toHaveAttribute('href', 'https://dataly.openfun.app/collection/item/ivod/123');
      expect(datalyLink).toHaveAttribute('target', '_blank');
    });
  });

  it('makes API call with correct IVOD ID', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        ai_transcript: 'Test transcript',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('/api/ivods/123');
    });
  });

  it('handles back navigation link', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        ai_transcript: 'Test transcript',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      const backLink = screen.getByText('返回列表').closest('a');
      expect(backLink).toHaveAttribute('href', '/');
    });
  });
});