import React, { useState } from 'react';

interface VideoDownloaderStreamProps {
  videoUrl: string;
  fileName?: string;
  className?: string;
}

const VideoDownloaderStream: React.FC<VideoDownloaderStreamProps> = ({ 
  videoUrl, 
  fileName = 'ivod-video.mp4',
  className = '' 
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadedSize, setDownloadedSize] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);
  const [currentSegment, setCurrentSegment] = useState(0);

  const parseM3U8 = async (m3u8Url: string): Promise<string[]> => {
    try {
      const response = await fetch(m3u8Url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      
      // 檢查是否是主播放列表（包含其他.m3u8檔案）
      const lines = text.split('\n').filter(line => line.trim());
      const m3u8Lines = lines.filter(line => line.includes('.m3u8') && !line.startsWith('#'));
      
      if (m3u8Lines.length > 0) {
        // 這是主播放列表，需要獲取子播放列表
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        const subPlaylistUrl = m3u8Lines[0].startsWith('http') ? m3u8Lines[0] : baseUrl + m3u8Lines[0];
        return parseM3U8(subPlaylistUrl); // 遞迴解析子播放列表
      }
      
      // 這是包含.ts片段的播放列表
      const segmentLines = lines.filter(line => line.trim() && !line.startsWith('#'));
      const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
      
      return segmentLines.map(line => {
        if (line.startsWith('http')) {
          return line.trim();
        } else {
          return baseUrl + line.trim();
        }
      });
    } catch (err) {
      throw new Error('無法解析M3U8播放列表');
    }
  };

  // 真正的串流式下載 - 使用 streamSaver.js 類似的方法
  const downloadVideoWithTrueStreaming = async () => {
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    setDownloadedSize(0);
    setTotalSegments(0);
    setCurrentSegment(0);

    try {
      // 解析M3U8播放列表
      const segmentUrls = await parseM3U8(videoUrl);
      
      if (segmentUrls.length === 0) {
        throw new Error('播放列表中沒有找到影片片段');
      }

      setTotalSegments(segmentUrls.length);

      // 建立一個 TransformStream 來處理數據流
      const { readable, writable } = new TransformStream();
      
      // 立即開始寫入流程
      const writer = writable.getWriter();
      
      // 建立下載流程
      const downloadPromise = (async () => {
        let totalBytes = 0;
        let successCount = 0;

        try {
          for (let i = 0; i < segmentUrls.length; i++) {
            setCurrentSegment(i + 1);
            
            try {
              const response = await fetch(segmentUrls[i]);
              
              if (!response.ok) {
                console.warn(`跳過片段 ${i + 1}: HTTP ${response.status}`);
                continue;
              }

              // 使用 ReadableStream 讀取響應
              const reader = response.body?.getReader();
              if (!reader) {
                console.warn(`跳過片段 ${i + 1}: 無法讀取響應體`);
                continue;
              }

              // 串流讀取並寫入
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                await writer.write(value);
                totalBytes += value.length;
                setDownloadedSize(totalBytes);
              }

              reader.releaseLock();
              successCount++;
              setProgress((successCount / segmentUrls.length) * 100);
              
            } catch (err) {
              console.warn(`跳過損壞的片段 ${i + 1}:`, err);
            }
          }

          if (successCount === 0) {
            throw new Error('沒有成功下載任何影片片段');
          }
        } finally {
          await writer.close();
        }
      })();

      // 同時處理讀取流程
      const reader = readable.getReader();
      const chunks: Uint8Array[] = [];
      
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }

      // 等待下載完成
      await downloadPromise;

      // 合併所有chunks
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const mergedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of chunks) {
        mergedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // 建立Blob並觸發下載
      const blob = new Blob([mergedBuffer], { type: 'video/mp2t' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName.replace('.mp4', '.ts');
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // 清理URL
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      setProgress(100);
      setTimeout(() => {
        setIsDownloading(false);
        setProgress(0);
        setDownloadedSize(0);
        setTotalSegments(0);
        setCurrentSegment(0);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : '下載失敗');
      setIsDownloading(false);
      setProgress(0);
      setDownloadedSize(0);
      setTotalSegments(0);
      setCurrentSegment(0);
    }
  };

  const handleDownloadClick = () => {
    if (!videoUrl) {
      setError('影片網址無效');
      return;
    }
    
    if (!videoUrl.includes('.m3u8')) {
      setError('僅支援M3U8格式的影片下載');
      return;
    }

    downloadVideoWithTrueStreaming();
  };

  const formatSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className={className}>
      <button
        onClick={handleDownloadClick}
        disabled={isDownloading}
        className={`inline-flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${
          isDownloading 
            ? 'bg-gray-400 text-white cursor-not-allowed' 
            : 'bg-orange-600 text-white hover:bg-orange-700'
        }`}
      >
        {isDownloading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            <span>下載中... {Math.round(progress)}%</span>
            {totalSegments > 0 && currentSegment > 0 && (
              <span className="text-xs ml-1">({currentSegment}/{totalSegments})</span>
            )}
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            下載IVOD影片
          </>
        )}
      </button>
      
      {isDownloading && progress > 0 && (
        <div className="mt-3">
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
              className="bg-gradient-to-r from-orange-500 to-orange-600 h-2.5 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between items-center text-xs text-gray-600 mt-2">
            <div className="flex flex-col">
              <span className="font-medium">
                進度: {Math.round(progress)}%
                {totalSegments > 0 && currentSegment > 0 && (
                  ` (片段 ${currentSegment}/${totalSegments})`
                )}
              </span>
              <span className="text-gray-500 mt-0.5">
                正在串流下載影片片段...
              </span>
            </div>
            {downloadedSize > 0 && (
              <div className="text-right">
                <div className="font-medium text-orange-600">
                  {formatSize(downloadedSize)}
                </div>
                <div className="text-gray-500 text-xs">
                  已下載
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1">
              {error}
            </div>
          </div>
          <button 
            onClick={() => setError(null)}
            className="mt-2 text-xs underline hover:no-underline text-red-700"
          >
            關閉錯誤訊息
          </button>
        </div>
      )}
      
    </div>
  );
};

export default VideoDownloaderStream;