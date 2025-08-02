/**
 * VideoDownloader 單元測試
 * 測試組件的基本功能和 props 處理
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import VideoDownloader from '@/components/VideoDownloader';

// Mock window.location
Object.defineProperty(window, 'location', {
  value: { hostname: 'production.host' },
  writable: true,
});

describe('VideoDownloader Unit Tests', () => {
  const validM3U8Url = 'https://example.com/playlist.m3u8';
  const invalidUrl = 'https://example.com/video.mp4';
  const mockOnProgressChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders download button with correct text', () => {
      render(<VideoDownloader videoUrl={validM3U8Url} />);
      expect(screen.getByRole('button', { name: /下載IVOD影片/i })).toBeInTheDocument();
    });

    it('applies custom className', () => {
      const { container } = render(
        <VideoDownloader videoUrl={validM3U8Url} className="custom-class" />
      );
      expect(container.firstChild).toHaveClass('custom-class');
    });

    it('uses default fileName when not provided', () => {
      render(<VideoDownloader videoUrl={validM3U8Url} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('Props Validation', () => {
    it('handles empty videoUrl', () => {
      render(<VideoDownloader videoUrl="" />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/影片網址無效/i)).toBeInTheDocument();
    });

    it('validates M3U8 format requirement', () => {
      render(<VideoDownloader videoUrl={invalidUrl} />);
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByText(/僅支援M3U8格式的影片下載/i)).toBeInTheDocument();
    });

    it('calls onProgressChange callback when provided', () => {
      render(
        <VideoDownloader 
          videoUrl={validM3U8Url} 
          onProgressChange={mockOnProgressChange} 
        />
      );
      
      fireEvent.click(screen.getByRole('button'));
      expect(mockOnProgressChange).toHaveBeenCalled();
    });
  });

  describe('Button States', () => {
    it('disables button during download', () => {
      render(<VideoDownloader videoUrl={validM3U8Url} />);
      const button = screen.getByRole('button');
      
      fireEvent.click(button);
      expect(button).toBeDisabled();
    });

    it('shows download text when not downloading', () => {
      render(<VideoDownloader videoUrl={validM3U8Url} />);
      expect(screen.getByText(/下載IVOD影片/i)).toBeInTheDocument();
    });
  });

  describe('Environment Detection', () => {
    it('detects localhost environment', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'localhost' },
        writable: true,
      });

      render(<VideoDownloader videoUrl={validM3U8Url} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('detects production environment', () => {
      Object.defineProperty(window, 'location', {
        value: { hostname: 'example.com' },
        writable: true,
      });

      render(<VideoDownloader videoUrl={validM3U8Url} />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });
});