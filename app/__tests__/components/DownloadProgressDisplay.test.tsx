/**
 * DownloadProgressDisplay 測試
 * 測試進度顯示組件和錯誤訊息不破版
 */
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import DownloadProgressDisplay from '@/components/DownloadProgressDisplay';

interface DownloadProgress {
  isDownloading: boolean;
  progress: number;
  conversionProgress: number;
  isConverting: boolean;
  downloadedSize: number;
  totalSegments: number;
  error: string | null;
}

describe('DownloadProgressDisplay', () => {
  const mockProgress: DownloadProgress = {
    isDownloading: true,
    progress: 50,
    conversionProgress: 25,
    isConverting: false,
    downloadedSize: 1024 * 1024 * 5, // 5MB
    totalSegments: 10,
    error: null,
  };

  it('renders nothing when progress is null', () => {
    const { container } = render(<DownloadProgressDisplay progress={null} />);
    expect(container.firstChild).toBeNull();
  });

  describe('Progress Display', () => {
    it('shows download progress correctly', () => {
      render(<DownloadProgressDisplay progress={mockProgress} />);
      
      expect(screen.getByText(/正在下載影片片段... 50%/)).toBeInTheDocument();
      expect(screen.getByText(/5.0 MB/)).toBeInTheDocument();
    });

    it('shows conversion progress when converting', () => {
      const convertingProgress = {
        ...mockProgress,
        isConverting: true,
        conversionProgress: 75,
      };
      
      render(<DownloadProgressDisplay progress={convertingProgress} />);
      
      expect(screen.getByText(/正在轉換為 MP4... 75%/)).toBeInTheDocument();
    });

    it('displays segment count during download', () => {
      render(<DownloadProgressDisplay progress={mockProgress} />);
      
      // Should show segment progress: (50% * 10 segments / 50) = 10 segments, so 10/10
      expect(screen.getByText(/\(10\/10\)/)).toBeInTheDocument();
    });

    it('hides segment count during conversion', () => {
      const convertingProgress = {
        ...mockProgress,
        isConverting: true,
      };
      
      render(<DownloadProgressDisplay progress={convertingProgress} />);
      
      expect(screen.queryByText(/\(\d+\/\d+\)/)).not.toBeInTheDocument();
    });
  });

  describe('Error Message Display', () => {
    it('shows error message when present', () => {
      const errorProgress = {
        ...mockProgress,
        error: 'Test error message',
      };
      
      render(<DownloadProgressDisplay progress={errorProgress} />);
      
      expect(screen.getByText('Test error message')).toBeInTheDocument();
    });

    it('handles very long error messages without breaking layout', () => {
      const longErrorMessage = 'This is a very long error message that could potentially break the layout if not handled properly. It contains multiple sentences and should wrap correctly without causing horizontal overflow or breaking the page layout. The error handling should be robust enough to handle edge cases like this.';
      
      const errorProgress = {
        ...mockProgress,
        error: longErrorMessage,
      };
      
      const { container } = render(<DownloadProgressDisplay progress={errorProgress} />);
      
      expect(screen.getByText(longErrorMessage)).toBeInTheDocument();
      
      // Check that the error container has proper styling classes
      const errorContainer = container.querySelector('.bg-red-50');
      expect(errorContainer).toHaveClass('max-w-full');
      
      // Check that the text div has break-words class
      const textDiv = container.querySelector('.break-words');
      expect(textDiv).toBeInTheDocument();
    });

    it('handles error messages with special characters', () => {
      const specialCharError = '錯誤訊息包含特殊字符：<script>alert("test")</script> & 其他符號 "quotes" \'apostrophes\' 100% 完成 #hashtag @mention';
      
      const errorProgress = {
        ...mockProgress,
        error: specialCharError,
      };
      
      render(<DownloadProgressDisplay progress={errorProgress} />);
      
      expect(screen.getByText(specialCharError)).toBeInTheDocument();
    });

    it('shows both progress and error simultaneously', () => {
      const progressWithError = {
        ...mockProgress,
        error: 'Download error occurred',
      };
      
      render(<DownloadProgressDisplay progress={progressWithError} />);
      
      expect(screen.getByText(/正在下載影片片段.../)).toBeInTheDocument();
      expect(screen.getByText('Download error occurred')).toBeInTheDocument();
    });
  });

  describe('Layout Stability', () => {
    it('maintains consistent container structure', () => {
      const { container, rerender } = render(
        <DownloadProgressDisplay progress={mockProgress} />
      );
      
      const initialStructure = container.innerHTML;
      
      // Update with different progress
      const updatedProgress = { ...mockProgress, progress: 75 };
      rerender(<DownloadProgressDisplay progress={updatedProgress} />);
      
      // Container structure should remain similar
      expect(container.querySelector('.w-full')).toBeInTheDocument();
      expect(container.querySelector('.bg-orange-600')).toBeInTheDocument();
    });

    it('prevents horizontal overflow with long content', () => {
      const longFileName = 'very-long-filename-that-could-cause-overflow-issues-in-the-download-progress-display-component.mp4';
      const progressWithLongContent = {
        ...mockProgress,
        error: `下載失敗：檔案 ${longFileName} 無法處理，請檢查檔案路徑和權限設定`,
      };
      
      const { container } = render(
        <DownloadProgressDisplay progress={progressWithLongContent} />
      );
      
      // Error container should have max-width and break-words
      const errorDiv = container.querySelector('.break-words');
      expect(errorDiv).toBeInTheDocument();
      
      const errorContainer = container.querySelector('.max-w-full');
      expect(errorContainer).toBeInTheDocument();
    });

    it('handles rapid progress updates without layout shift', () => {
      const { rerender } = render(
        <DownloadProgressDisplay progress={mockProgress} />
      );
      
      // Simulate rapid progress updates
      for (let i = 0; i <= 100; i += 10) {
        const updatedProgress = { ...mockProgress, progress: i };
        rerender(<DownloadProgressDisplay progress={updatedProgress} />);
      }
      
      // Final state should still be properly rendered
      expect(screen.getByText(/正在下載影片片段... 100%/)).toBeInTheDocument();
    });
  });

  describe('Responsive Design', () => {
    it('applies responsive text sizing classes', () => {
      const { container } = render(<DownloadProgressDisplay progress={mockProgress} />);
      
      expect(container.querySelector('.text-xs')).toBeInTheDocument();
    });

    it('uses flexbox for proper alignment', () => {
      const errorProgress = {
        ...mockProgress,
        error: 'Test error',
      };
      
      const { container } = render(<DownloadProgressDisplay progress={errorProgress} />);
      
      // Check for flex container with items-start (should be in error message area)
      const flexContainer = container.querySelector('.flex.items-start');
      expect(flexContainer).toBeInTheDocument();
    });

    it('ensures icon stays aligned with text', () => {
      const errorProgress = {
        ...mockProgress,
        error: 'Multi-line error message that should wrap properly and keep the icon aligned at the top of the first line',
      };
      
      const { container } = render(<DownloadProgressDisplay progress={errorProgress} />);
      
      const icon = container.querySelector('svg');
      expect(icon).toHaveClass('flex-shrink-0'); // Icon shouldn't shrink
      expect(icon).toHaveClass('mt-0.5'); // Slight top margin for alignment
    });
  });

  describe('Accessibility', () => {
    it('provides proper semantic structure for error messages', () => {
      const errorProgress = {
        ...mockProgress,
        error: 'Accessibility test error',
      };
      
      render(<DownloadProgressDisplay progress={errorProgress} />);
      
      const errorMessage = screen.getByText('Accessibility test error');
      expect(errorMessage.closest('.bg-red-50')).toBeInTheDocument();
    });

    it('maintains proper color contrast for error messages', () => {
      const errorProgress = {
        ...mockProgress,
        error: 'Error message',
      };
      
      const { container } = render(<DownloadProgressDisplay progress={errorProgress} />);
      
      const errorContainer = container.querySelector('.text-red-600');
      expect(errorContainer).toBeInTheDocument();
    });
  });
});