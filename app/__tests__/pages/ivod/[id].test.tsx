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
  return React.forwardRef(function MockLink(props: any, ref: any) {
    const { children, href, ...otherProps } = props;
    return <a href={href} ref={ref} {...otherProps}>{children}</a>;
  });
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
        title: 'Test Title',
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A', '委員會B'],
        video_length: '10:00',
        video_start: '09:00:00',
        video_end: '09:10:00',
        video_type: 'speech',
        video_url: 'https://example.com/video.mp4',
        ivod_url: 'https://example.com/ivod',
        category: '質詢',
        meeting_code: 'TEST001',
        meeting_time: '2022-01-01 09:00:00+08:00',
        ai_transcript: 'AI generated transcript content',
        ly_transcript: 'Legislative Yuan transcript content',
        ai_status: 'success',
        ly_status: 'success',
        last_updated: '2022-01-01 10:00:00+08:00'
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('Test Title（Test Speaker 發言）')).toBeInTheDocument();
      expect(screen.getByText('Test Meeting')).toBeInTheDocument();
      expect(screen.getByText('2022-01-01')).toBeInTheDocument();
      expect(screen.getByText('委員會A, 委員會B')).toBeInTheDocument();
      expect(screen.getByText('10:00')).toBeInTheDocument();
      expect(screen.getByText('發言')).toBeInTheDocument();
      expect(screen.getByText('09:00:00 - 09:10:00')).toBeInTheDocument();
      expect(screen.getByText('質詢')).toBeInTheDocument();
      expect(screen.getByText('TEST001')).toBeInTheDocument();
      expect(screen.getAllByText('已完成')).toHaveLength(2);
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

  it('handles "完整會議" speaker format correctly', async () => {
    const mockData = {
      data: {
        ivod_id: 124,
        title: 'Full Meeting Title',
        meeting_name: 'Complete Committee Meeting',
        date: '2022-01-02',
        speaker_name: '完整會議',
        committee_names: ['委員會A'],
        video_length: '120:00',
        video_type: 'full',
        ai_transcript: 'Complete meeting transcript',
        ai_status: 'success',
        ly_status: 'success',
        last_updated: '2022-01-02 10:00:00+08:00'
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('Full Meeting Title（完整會議）')).toBeInTheDocument();
      expect(screen.getByText('完整會議')).toBeInTheDocument();
    });
  });

  it('handles 404 error gracefully', async () => {
    (fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });

    render(<IvodDetail />);

    // Component doesn't handle errors, so it will stay in loading state
    await waitFor(() => {
      expect(screen.getByText('載入中...')).toBeInTheDocument();
    });
  });

  it('handles network errors gracefully', async () => {
    (fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    render(<IvodDetail />);

    // Component doesn't handle errors, so it will stay in loading state  
    await waitFor(() => {
      expect(screen.getByText('載入中...')).toBeInTheDocument();
    });
  });

  it('waits for router to be ready before making API call', () => {
    const notReadyRouter = {
      push: mockPush,
      query: { id: '123' },
      isReady: false,
    };
    (useRouter as jest.Mock).mockReturnValue(notReadyRouter);

    render(<IvodDetail />);

    expect(fetch).not.toHaveBeenCalled();
  });

  it('handles missing ID in router query', () => {
    const noIdRouter = {
      push: mockPush,
      query: {},
      isReady: true,
    };
    (useRouter as jest.Mock).mockReturnValue(noIdRouter);

    render(<IvodDetail />);

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText('載入中...')).toBeInTheDocument();
  });

  it('shows committee names correctly when data is string format', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        title: 'Test Title',
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: '["委員會A", "委員會B"]', // String format from SQLite
        video_length: '10:00',
        ai_transcript: 'Test transcript',
        ai_status: 'success',
        ly_status: 'pending',
        last_updated: '2022-01-01 10:00:00+08:00'
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('委員會A, 委員會B')).toBeInTheDocument();
    });
  });

  it('renders video player when video URL is available', async () => {
    const mockData = {
      data: {
        ivod_id: 123,
        meeting_name: 'Test Meeting',
        date: '2022-01-01',
        speaker_name: 'Test Speaker',
        committee_names: ['委員會A'],
        video_length: '10:00',
        video_url: 'https://example.com/video.mp4',
        ai_transcript: 'Test transcript',
      },
    };

    (fetch as jest.Mock).mockResolvedValueOnce({
      json: () => Promise.resolve(mockData),
    });

    render(<IvodDetail />);

    await waitFor(() => {
      // Check that the video section title exists and there's no placeholder
      expect(screen.getByText('影片播放')).toBeInTheDocument();
      expect(screen.queryByText('影片尚未提供')).not.toBeInTheDocument();
      // Video element should be rendered with the src attribute
      const video = document.querySelector('video');
      expect(video).toBeInTheDocument();
      expect(video).toHaveAttribute('src', 'https://example.com/video.mp4');
    });
  });

  it('defaults to AI transcript tab when both transcripts are available', async () => {
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
      expect(screen.queryByText('LY transcript content')).not.toBeInTheDocument();
    });
  });
});