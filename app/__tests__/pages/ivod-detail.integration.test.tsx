import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { useRouter } from 'next/router';
import IvodDetail from '@/pages/ivod/[id]';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

// Mock VideoDownloader component to avoid network calls in integration tests
jest.mock('@/components/VideoDownloader', () => {
  return function MockVideoDownloader({ videoUrl, fileName }: { videoUrl: string; fileName?: string }) {
    return (
      <div data-testid="video-downloader">
        <button>下載IVOD影片</button>
        <div data-testid="video-url">{videoUrl}</div>
        <div data-testid="file-name">{fileName}</div>
      </div>
    );
  };
});

// Mock fetch for API calls
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('IVOD Detail Page Integration with VideoDownloader', () => {
  const mockRouter = {
    query: { id: '15001' },
    push: jest.fn(),
    replace: jest.fn(),
    pathname: '/ivod/[id]',
  };

  beforeEach(() => {
    (useRouter as jest.Mock).mockReturnValue(mockRouter);
    jest.clearAllMocks();
  
    jest.clearAllTimers();});

  const mockIVODData = {
    ivod_id: 15001,
    title: '立法院朝野黨團協商',
    meeting_name: '立法院朝野黨團協商（事由：公共電視法部分條文修正草案）',
    speaker_name: '王委員',
    date: '2023-05-08T00:00:00.000Z',
    video_url: 'https://ivod-lyvod.cdn.hinet.net/vod_1/_definst_/mp4:1MClips/23f1796b33c52784c3dfefaa5d0d58acca5ad61c677c192cf0a1ba4207db2e7e69935296c30cbcfd5ea18f28b6918d91.mp4/playlist.m3u8',
    ivod_url: 'https://ivod.ly.gov.tw/Play/Clip/300K/148077',
    ai_transcript: '這是AI轉寫的逐字稿內容...',
    ly_transcript: '這是立法院官方逐字稿內容...',
    ai_status: 'success',
    ly_status: 'success',
    last_updated: '2023-05-08T10:00:00.000Z',
    committee_names: ['教育及文化委員會'],
    video_type: '委員會',
    category: '立法',
    meeting_code: 'LEG001',
    meeting_time: '2023-05-08T09:00:00.000Z',
    video_start: '09:00:00',
    video_end: '10:30:00',
    video_length: '1小時30分'
  };

  it('renders VideoDownloader when video_url is available', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockIVODData })
    });

    render(<IvodDetail />);

    // Wait for VideoDownloader to render
    await waitFor(() => {
      expect(screen.getByTestId('video-downloader')).toBeInTheDocument();
    }, { timeout: 1000 });

    // Check VideoDownloader props
    expect(screen.getByTestId('video-url')).toHaveTextContent(mockIVODData.video_url);
    
    // Check filename format
    const fileNameElement = screen.getByTestId('file-name');
    expect(fileNameElement.textContent).toContain('ivod-15001');
    expect(fileNameElement.textContent).toContain('.ts');
  });

  it('does not render VideoDownloader when video_url is null', async () => {
    const dataWithoutVideo = { ...mockIVODData, video_url: null };
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: dataWithoutVideo })
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getAllByText(/立法院朝野黨團協商/)[0]).toBeInTheDocument();
    }, { timeout: 5000 });

    // VideoDownloader 不應該出現
    expect(screen.queryByTestId('video-downloader')).not.toBeInTheDocument();
  });

  it('renders other action buttons alongside VideoDownloader', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockIVODData })
    });

    render(<IvodDetail />);

    // Check all buttons exist
    await waitFor(() => {
      expect(screen.getByText('查看原始IVOD')).toBeInTheDocument();
    }, { timeout: 2000 });
    
    expect(screen.getByText('在 Dataly 查看')).toBeInTheDocument();
    expect(screen.getByText('下載IVOD影片')).toBeInTheDocument();
  });

  it('generates correct filename for VideoDownloader', async () => {
    const customData = {
      ...mockIVODData,
      title: '立法院會議/特殊字符測試',
      meeting_name: '測試會議<>"',
      speaker_name: '測試委員*|'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: customData })
    });

    render(<IvodDetail />);

    // Wait for filename to be generated and check special character handling
    await waitFor(() => {
      const fileNameElement = screen.getByTestId('file-name');
      expect(fileNameElement).toBeInTheDocument();
    }, { timeout: 2000 });
    
    const fileNameElement = screen.getByTestId('file-name');
    const fileName = fileNameElement.textContent;
    
    // Check special characters are replaced
    expect(fileName).not.toContain('/');
    expect(fileName).not.toContain('<');
    expect(fileName).not.toContain('>');
    expect(fileName).not.toContain('*');
    expect(fileName).not.toContain('|');
    expect(fileName).toContain('ivod-15001');
    expect(fileName).toMatch(/\.ts$/);
  });

  it('handles missing IVOD data gracefully', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: null })
    });

    render(<IvodDetail />);

    // 應該顯示載入中狀態
    expect(screen.getByText('載入中...')).toBeInTheDocument();
  });

  it('handles API error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('API Error'));

    render(<IvodDetail />);

    // 應該顯示載入中狀態（因為組件會繼續等待）
    expect(screen.getByText('載入中...')).toBeInTheDocument();
  });

  it('shows video section with HLS player and download button', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockIVODData })
    });

    render(<IvodDetail />);

    // Check video section and download button
    await waitFor(() => {
      expect(screen.getByText('影片播放')).toBeInTheDocument();
    }, { timeout: 1000 });
    
    expect(screen.getByTestId('video-downloader')).toBeInTheDocument();
  });

  it('displays video information correctly', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: mockIVODData })
    });

    render(<IvodDetail />);

    await waitFor(() => {
      // 檢查會議資訊
      expect(screen.getAllByText(/立法院朝野黨團協商/)[0]).toBeInTheDocument();
      expect(screen.getByText(/公共電視法部分條文修正草案/)).toBeInTheDocument();
      expect(screen.getByText('王委員')).toBeInTheDocument();
      expect(screen.getByText('教育及文化委員會')).toBeInTheDocument();
    }, { timeout: 5000 });
  });

  it('handles video URLs with special characters', async () => {
    const dataWithSpecialUrl = {
      ...mockIVODData,
      video_url: 'https://example.com/video with spaces/playlist.m3u8'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: dataWithSpecialUrl })
    });

    render(<IvodDetail />);

    await waitFor(() => {
      const videoUrlElement = screen.getByTestId('video-url');
      expect(videoUrlElement).toHaveTextContent('https://example.com/video with spaces/playlist.m3u8');
    }, { timeout: 5000 });
  });

  it('shows processing status information', async () => {
    const dataWithProcessingStatus = {
      ...mockIVODData,
      ai_status: 'pending',
      ly_status: 'failed'
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: dataWithProcessingStatus })
    });

    render(<IvodDetail />);

    await waitFor(() => {
      expect(screen.getByText('處理狀態')).toBeInTheDocument();
      expect(screen.getByText('處理中')).toBeInTheDocument(); // AI status
      expect(screen.getByText('失敗')).toBeInTheDocument(); // LY status
    }, { timeout: 5000 });
  });
});