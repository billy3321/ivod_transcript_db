import React, { useState, useEffect } from 'react';

interface VideoDownloaderProps {
  videoUrl: string;
  fileName?: string;
  className?: string;
  onProgressChange?: (progress: DownloadProgress | null) => void;
}

interface DownloadProgress {
  isDownloading: boolean;
  progress: number;
  downloadedSize: number;
  totalSegments: number;
  error: string | null;
}

const VideoDownloader: React.FC<VideoDownloaderProps> = ({ 
  videoUrl, 
  fileName = 'ivod-video.ts',
  className = '',
  onProgressChange
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadedSize, setDownloadedSize] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);

  // Report progress changes to parent component
  useEffect(() => {
    if (onProgressChange) {
      if (isDownloading || error) {
        onProgressChange({
          isDownloading,
          progress,
          downloadedSize,
          totalSegments,
          error
        });
      } else {
        onProgressChange(null);
      }
    }
  }, [isDownloading, progress, downloadedSize, totalSegments, error, onProgressChange]);

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
      throw new Error('無法解析 M3U8 播放列表');
    }
  };


  // 記憶體友善的分批下載和合併
  const downloadVideoStreaming = async () => {
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    setDownloadedSize(0);
    setTotalSegments(0);

    try {
      // 解析M3U8播放列表
      const segmentUrls = await parseM3U8(videoUrl);
      
      if (segmentUrls.length === 0) {
        throw new Error('播放列表中沒有找到影片片段');
      }

      setTotalSegments(segmentUrls.length);

      // 分批處理參數
      const BATCH_SIZE = 5; // 每批處理5個片段，減少記憶體壓力
      const batches: string[][] = [];
      
      // 將片段分組
      for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
        batches.push(segmentUrls.slice(i, i + BATCH_SIZE));
      }

      const allChunks: Uint8Array[] = [];
      let successCount = 0;
      let totalBytes = 0;

      // 分批下載
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        // 並行下載當前批次的片段
        const batchPromises = batch.map(async (url, index) => {
          const globalIndex = batchIndex * BATCH_SIZE + index;
          try {
            const response = await fetch(url);
            
            if (!response.ok) {
              return null;
            }

            // 使用串流讀取響應，避免一次性載入大塊記憶體
            const reader = response.body?.getReader();
            if (!reader) {
              return null;
            }

            const chunks: Uint8Array[] = [];
            let segmentSize = 0;
            
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                chunks.push(value);
                segmentSize += value.length;
              }
            } finally {
              reader.releaseLock();
            }

            // 合併當前片段的所有chunks
            const segmentBuffer = new Uint8Array(segmentSize);
            let offset = 0;
            for (const chunk of chunks) {
              segmentBuffer.set(chunk, offset);
              offset += chunk.length;
            }

            // 每個片段下載完成立即更新進度
            successCount++;
            totalBytes += segmentBuffer.length;
            setDownloadedSize(totalBytes);
            setProgress((successCount / segmentUrls.length) * 75);

            return { index: globalIndex, data: segmentBuffer };
            
          } catch (err) {
            return null;
          }
        });

        // 等待當前批次完成
        const batchResults = await Promise.all(batchPromises);
        
        // 儲存批次結果到正確位置
        for (const result of batchResults) {
          if (result) {
            allChunks[result.index] = result.data;
          }
        }
        
        // 在批次之間暫停，讓瀏覽器有時間進行垃圾回收
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (successCount === 0) {
        throw new Error('沒有成功下載任何影片片段');
      }

      // 過濾掉空的片段並計算最終大小
      const validChunks = allChunks.filter(chunk => chunk);
      const totalLength = validChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      
      // 使用更記憶體友善的方式合併
      const mergedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of validChunks) {
        mergedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      // 直接提供 TS 格式下載，避免 FFmpeg 載入問題
      setProgress(100); // 下載完成
      
      // 準備檔名：移除現有副檔名，添加 .ts 副檔名
      const baseFileName = fileName.replace(/\.(mp4|ts)$/i, '');
      const finalFileName = baseFileName + '.ts';
      const finalBuffer = mergedBuffer;
      const fileType = 'video/mp2t';
      

      // 建立 Blob 並觸發下載
      const blob = new Blob([finalBuffer], { type: fileType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFileName;
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
        setError(null);
      }, 3000);

    } catch (err) {
      setError(err instanceof Error ? err.message : '下載失敗');
      setIsDownloading(false);
      setProgress(0);
      setDownloadedSize(0);
      setTotalSegments(0);
    }
  };

  const handleDownloadClick = () => {
    if (!videoUrl) {
      setError('影片網址無效');
      return;
    }
    
    if (!videoUrl.includes('.m3u8')) {
      setError('僅支援 M3U8 格式的影片下載');
      return;
    }

    downloadVideoStreaming();
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
            下載中……
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            下載 IVOD 影片
          </>
        )}
      </button>
      
      {error && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-600">
          <div className="flex items-center">
            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
          <button 
            onClick={() => setError(null)}
            className="mt-1 text-xs underline hover:no-underline"
          >
            關閉
          </button>
        </div>
      )}
      
    </div>
  );
};

export default VideoDownloader;