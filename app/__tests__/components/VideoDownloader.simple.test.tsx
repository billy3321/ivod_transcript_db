/**
 * VideoDownloader 簡化測試
 * 測試核心功能而不觸發複雜的下載邏輯
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoDownloader from '@/components/VideoDownloader';

describe('VideoDownloader Simple Tests', () => {
  const validUrl = 'https://example.com/video.m3u8';
  const invalidUrl = 'https://example.com/video.mp4';

  beforeEach(() => {
    // Set production environment
    Object.defineProperty(window, 'location', {
      value: { hostname: 'production.host' },
      writable: true,
    });
  });

  it('renders correctly', () => {
    render(<VideoDownloader videoUrl={validUrl} />);
    expect(screen.getByText('下載 IVOD 影片')).toBeInTheDocument();
  });

  it('validates URL format', () => {
    render(<VideoDownloader videoUrl={invalidUrl} />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('僅支援 M3U8 格式的影片下載')).toBeInTheDocument();
  });

  it('handles empty URL', () => {
    render(<VideoDownloader videoUrl="" />);
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText(/影片網址無效/)).toBeInTheDocument();
  });

  it('calls progress callback', () => {
    const mockCallback = jest.fn();
    render(<VideoDownloader videoUrl={validUrl} onProgressChange={mockCallback} />);
    
    fireEvent.click(screen.getByRole('button'));
    expect(mockCallback).toHaveBeenCalled();
  });

  it('handles localhost environment', () => {
    Object.defineProperty(window, 'location', {
      value: { hostname: 'localhost' },
      writable: true,
    });

    render(<VideoDownloader videoUrl={validUrl} />);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('applies custom className and fileName', () => {
    const { container } = render(
      <VideoDownloader
        videoUrl={validUrl}
        className="custom-class"
        fileName="custom-file.mp4"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  describe('origin allowlist enforcement', () => {
    let originalFetch: any;

    beforeEach(() => {
      originalFetch = global.fetch;
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('rejects m3u8 URL from non-allowed origin (won\'t even fetch)', async () => {
      const fetchSpy = jest.fn();
      global.fetch = fetchSpy as any;

      const evilUrl = 'https://evil.example.com/video.m3u8';
      render(<VideoDownloader videoUrl={evilUrl} />);
      fireEvent.click(screen.getByRole('button'));

      // 等微任務排空
      await new Promise(r => setTimeout(r, 50));

      // 不該對 evil origin 發 fetch
      expect(fetchSpy).not.toHaveBeenCalled();
      // 應顯示錯誤
      expect(screen.getByText(/網域不允許|下載失敗|無法解析/)).toBeInTheDocument();
    });

    it('accepts m3u8 URL from ivod.ly.gov.tw', async () => {
      // 不真的下載 — mock fetch return 失敗讓流程中斷
      const fetchSpy = jest.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'mock',
      });
      global.fetch = fetchSpy as any;

      const lyUrl = 'https://ivod.ly.gov.tw/path/to/video.m3u8';
      render(<VideoDownloader videoUrl={lyUrl} />);
      fireEvent.click(screen.getByRole('button'));
      await new Promise(r => setTimeout(r, 50));

      // 至少有對 allowed origin 發出一次 fetch
      expect(fetchSpy).toHaveBeenCalledWith(lyUrl);
    });
  });
});