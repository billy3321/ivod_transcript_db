import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import HLSPlayer from '@/components/HLSPlayer';

// Mock HLS.js
const mockHls = {
  isSupported: jest.fn(),
  Events: {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError'
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError'
  },
  loadSource: jest.fn(),
  attachMedia: jest.fn(),
  on: jest.fn(),
  startLoad: jest.fn(),
  recoverMediaError: jest.fn(),
  destroy: jest.fn()
};

const MockHlsConstructor = jest.fn(() => mockHls);
MockHlsConstructor.isSupported = mockHls.isSupported;
MockHlsConstructor.Events = mockHls.Events;
MockHlsConstructor.ErrorTypes = mockHls.ErrorTypes;

jest.mock('hls.js', () => ({
  __esModule: true,
  default: MockHlsConstructor
}));

// Mock location.reload
Object.defineProperty(window, 'location', {
  value: {
    reload: jest.fn()
  },
  writable: true
});

describe('HLSPlayer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset HLS support to true by default
    mockHls.isSupported.mockReturnValue(true);
  });

  it('renders video element with controls', () => {
    render(<HLSPlayer src="test.m3u8" />);
    
    const video = screen.getByRole('application');
    expect(video).toHaveAttribute('controls');
    expect(video).toHaveAttribute('preload', 'metadata');
  });

  it('shows loading state initially', () => {
    render(<HLSPlayer src="test.m3u8" />);
    
    expect(screen.getByText('載入影片中...')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<HLSPlayer src="test.m3u8" className="custom-class" />);
    
    const container = screen.getByText('載入影片中...').closest('div')?.parentElement;
    expect(container).toHaveClass('custom-class');
  });

  describe('HLS.js is supported', () => {
    it('initializes HLS player when supported', () => {
      mockHls.isSupported.mockReturnValue(true);
      
      render(<HLSPlayer src="test.m3u8" />);
      
      expect(MockHlsConstructor).toHaveBeenCalledWith({
        enableWorker: false,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      expect(mockHls.loadSource).toHaveBeenCalledWith('test.m3u8');
      expect(mockHls.attachMedia).toHaveBeenCalled();
    });

    it('sets up event listeners for HLS events', () => {
      render(<HLSPlayer src="test.m3u8" />);
      
      expect(mockHls.on).toHaveBeenCalledWith('hlsManifestParsed', expect.any(Function));
      expect(mockHls.on).toHaveBeenCalledWith('hlsError', expect.any(Function));
    });

    it('handles successful manifest parsing', async () => {
      let manifestParsedCallback: () => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsManifestParsed') {
          manifestParsedCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger manifest parsed event
      manifestParsedCallback!();
      
      await waitFor(() => {
        expect(screen.queryByText('載入影片中...')).not.toBeInTheDocument();
      });
    });

    it('handles network error and retries', async () => {
      let errorCallback: (event: any, data: any) => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsError') {
          errorCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger network error
      errorCallback!('error', {
        fatal: true,
        type: 'networkError'
      });
      
      await waitFor(() => {
        expect(screen.getByText('網路連線錯誤，正在重試...')).toBeInTheDocument();
      });
      expect(mockHls.startLoad).toHaveBeenCalled();
    });

    it('handles media error and recovers', async () => {
      let errorCallback: (event: any, data: any) => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsError') {
          errorCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger media error
      errorCallback!('error', {
        fatal: true,
        type: 'mediaError'
      });
      
      await waitFor(() => {
        expect(screen.getByText('媒體錯誤，正在重試...')).toBeInTheDocument();
      });
      expect(mockHls.recoverMediaError).toHaveBeenCalled();
    });

    it('handles fatal error and destroys player', async () => {
      let errorCallback: (event: any, data: any) => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsError') {
          errorCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger fatal error
      errorCallback!('error', {
        fatal: true,
        type: 'otherError'
      });
      
      await waitFor(() => {
        expect(screen.getByText('影片載入失敗，無法播放此影片')).toBeInTheDocument();
      });
      expect(mockHls.destroy).toHaveBeenCalled();
    });

    it('handles non-fatal errors without changing state', async () => {
      let errorCallback: (event: any, data: any) => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsError') {
          errorCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger non-fatal error
      errorCallback!('error', {
        fatal: false,
        type: 'networkError'
      });
      
      // Should still show loading state
      expect(screen.getByText('載入影片中...')).toBeInTheDocument();
      expect(mockHls.startLoad).not.toHaveBeenCalled();
    });
  });

  describe('Native HLS support (Safari)', () => {
    it('uses native HLS when HLS.js not supported but native support available', () => {
      mockHls.isSupported.mockReturnValue(false);
      
      // Mock video element with native HLS support
      const mockVideo = {
        canPlayType: jest.fn().mockReturnValue('probably'),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        src: ''
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'video') {
          return mockVideo as any;
        }
        return originalCreateElement.call(document, tagName);
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      expect(mockVideo.canPlayType).toHaveBeenCalledWith('application/vnd.apple.mpegurl');
      expect(mockVideo.src).toBe('test.m3u8');
      
      document.createElement = originalCreateElement;
    });
  });

  describe('No HLS support', () => {
    it('shows error message when no HLS support available', async () => {
      mockHls.isSupported.mockReturnValue(false);
      
      // Mock video element without native HLS support
      const mockVideo = {
        canPlayType: jest.fn().mockReturnValue(''),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        src: ''
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'video') {
          return mockVideo as any;
        }
        return originalCreateElement.call(document, tagName);
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      await waitFor(() => {
        expect(screen.getByText('您的瀏覽器不支援HLS影片格式')).toBeInTheDocument();
      });
      
      // Should still try to load URL as fallback
      expect(mockVideo.src).toBe('test.m3u8');
      
      document.createElement = originalCreateElement;
    });
  });

  describe('Video event handling', () => {
    it('handles video loadstart event', () => {
      const mockVideo = {
        addEventListener: jest.fn(),
        removeEventListener: jest.fn()
      };
      
      const originalCreateElement = document.createElement;
      document.createElement = jest.fn((tagName) => {
        if (tagName === 'video') {
          return mockVideo as any;
        }
        return originalCreateElement.call(document, tagName);
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      expect(mockVideo.addEventListener).toHaveBeenCalledWith('loadstart', expect.any(Function));
      expect(mockVideo.addEventListener).toHaveBeenCalledWith('canplay', expect.any(Function));
      expect(mockVideo.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
      
      document.createElement = originalCreateElement;
    });
  });

  describe('Error UI', () => {
    it('shows reload button when error occurs', async () => {
      let errorCallback: (event: any, data: any) => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsError') {
          errorCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger fatal error
      errorCallback!('error', {
        fatal: true,
        type: 'otherError'
      });
      
      await waitFor(() => {
        expect(screen.getByText('重新載入')).toBeInTheDocument();
      });
    });

    it('reloads page when reload button clicked', async () => {
      let errorCallback: (event: any, data: any) => void;
      mockHls.on.mockImplementation((event, callback) => {
        if (event === 'hlsError') {
          errorCallback = callback;
        }
      });
      
      render(<HLSPlayer src="test.m3u8" />);
      
      // Trigger fatal error
      errorCallback!('error', {
        fatal: true,
        type: 'otherError'
      });
      
      await waitFor(() => {
        expect(screen.getByText('重新載入')).toBeInTheDocument();
      });
      
      fireEvent.click(screen.getByText('重新載入'));
      expect(window.location.reload).toHaveBeenCalled();
    });
  });

  describe('Cleanup', () => {
    it('destroys HLS instance on unmount', () => {
      const { unmount } = render(<HLSPlayer src="test.m3u8" />);
      
      unmount();
      
      expect(mockHls.destroy).toHaveBeenCalled();
    });
  });
});