import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface HLSPlayerProps {
  src: string;
  className?: string;
}

const HLSPlayer: React.FC<HLSPlayerProps> = ({ src, className = '' }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (Hls.isSupported()) {
      // HLS.js is supported
      const hls = new Hls({
        enableWorker: false, // Disable web workers for better compatibility
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
      
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('HLS manifest parsed, ready to play');
        setLoading(false);
        setError(null);
      });
      
      hls.on(Hls.Events.ERROR, (event, data) => {
        console.warn('HLS error:', data);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.log('Network error, trying to recover...');
              setError('網路連線錯誤，正在重試...');
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.log('Media error, trying to recover...');
              setError('媒體錯誤，正在重試...');
              hls.recoverMediaError();
              break;
            default:
              console.log('Fatal error, cannot recover');
              setError('影片載入失敗，無法播放此影片');
              setLoading(false);
              hls.destroy();
              break;
          }
        }
      });
      
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (Safari)
      video.src = src;
      setLoading(false);
    } else {
      console.warn('HLS is not supported in this browser');
      setError('您的瀏覽器不支援HLS影片格式');
      setLoading(false);
      // Fallback: still try to load the URL directly
      video.src = src;
    }

    // Video event listeners
    const handleLoadStart = () => setLoading(true);
    const handleCanPlay = () => setLoading(false);
    const handleError = () => {
      setError('影片載入錯誤');
      setLoading(false);
    };

    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // Clean up event listeners
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [src]);

  return (
    <div className={`relative ${className}`}>
      {loading && (
        <div className="absolute inset-0 bg-gray-100 rounded-lg flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-600">載入影片中...</p>
          </div>
        </div>
      )}
      
      {error && (
        <div className="absolute inset-0 bg-red-50 rounded-lg flex items-center justify-center z-10">
          <div className="text-center p-4">
            <svg className="w-12 h-12 mx-auto mb-2 text-red-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="text-sm text-red-600">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-3 py-1 bg-red-100 text-red-700 rounded text-xs hover:bg-red-200"
            >
              重新載入
            </button>
          </div>
        </div>
      )}
      
      <video
        ref={videoRef}
        controls
        preload="metadata"
        className="w-full rounded-lg bg-gray-100"
        style={{ maxHeight: '400px' }}
      >
        您的瀏覽器不支援影片播放。
      </video>
    </div>
  );
};

export default HLSPlayer;