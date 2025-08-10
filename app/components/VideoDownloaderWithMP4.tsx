import React, { useState } from 'react';

interface VideoDownloaderWithMP4Props {
  videoUrl: string;
  fileName?: string;
  className?: string;
}

type OutputFormat = 'ts' | 'mp4';

const VideoDownloaderWithMP4: React.FC<VideoDownloaderWithMP4Props> = ({ 
  videoUrl, 
  fileName = 'ivod-video',
  className = '' 
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadedSize, setDownloadedSize] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('ts');
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);

  const parseM3U8 = async (m3u8Url: string): Promise<string[]> => {
    try {
      const response = await fetch(m3u8Url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      
      const lines = text.split('\n').filter(line => line.trim());
      const m3u8Lines = lines.filter(line => line.includes('.m3u8') && !line.startsWith('#'));
      
      if (m3u8Lines.length > 0) {
        const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
        const subPlaylistUrl = m3u8Lines[0].startsWith('http') ? m3u8Lines[0] : baseUrl + m3u8Lines[0];
        return parseM3U8(subPlaylistUrl);
      }
      
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

  // 載入 FFmpeg WebAssembly
  const loadFFmpeg = async () => {
    if (typeof window === 'undefined') return null;
    
    try {
      // 動態載入 @ffmpeg/ffmpeg
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      const { toBlobURL } = await import('@ffmpeg/util');
      
      const ffmpeg = new FFmpeg();
      
      // 設定進度回調
      ffmpeg.on('progress', ({ progress }) => {
        setConversionProgress(Math.round(progress * 100));
      });
      
      // 載入 FFmpeg WebAssembly 檔案
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
      });
      
      return ffmpeg;
    } catch (error) {
      console.error('FFmpeg 載入失敗:', error);
      throw new Error('無法載入影片轉換器，請確認網路連線正常');
    }
  };

  // 轉換 TS 為 MP4
  const convertToMP4 = async (tsData: Uint8Array): Promise<Uint8Array> => {
    setIsConverting(true);
    setConversionProgress(0);
    
    try {
      const ffmpeg = await loadFFmpeg();
      if (!ffmpeg) throw new Error('FFmpeg 載入失敗');
      
      // 寫入輸入檔案
      await ffmpeg.writeFile('input.ts', tsData);
      
      // 執行轉換 (使用 copy 編解碼器避免重新編碼，速度較快)
      await ffmpeg.exec([
        '-i', 'input.ts',
        '-c', 'copy',
        '-movflags', 'frag_keyframe+empty_moov',
        'output.mp4'
      ]);
      
      // 讀取輸出檔案
      const mp4Data = await ffmpeg.readFile('output.mp4');
      
      // 清理記憶體
      await ffmpeg.deleteFile('input.ts');
      await ffmpeg.deleteFile('output.mp4');
      
      setIsConverting(false);
      return mp4Data as Uint8Array;
      
    } catch (error) {
      setIsConverting(false);
      console.error('MP4 轉換失敗:', error);
      throw new Error('影片轉換失敗，請嘗試下載 TS 格式');
    }
  };

  const downloadVideo = async () => {
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    setDownloadedSize(0);
    setTotalSegments(0);
    setConversionProgress(0);

    try {
      // 解析M3U8播放列表
      const segmentUrls = await parseM3U8(videoUrl);
      
      if (segmentUrls.length === 0) {
        throw new Error('播放列表中沒有找到影片片段');
      }

      setTotalSegments(segmentUrls.length);

      // 分批下載
      const BATCH_SIZE = 5;
      const batches: string[][] = [];
      
      for (let i = 0; i < segmentUrls.length; i += BATCH_SIZE) {
        batches.push(segmentUrls.slice(i, i + BATCH_SIZE));
      }

      const allChunks: Uint8Array[] = [];
      let successCount = 0;
      let totalBytes = 0;

      // 分批下載片段
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        
        const batchPromises = batch.map(async (url, index) => {
          const globalIndex = batchIndex * BATCH_SIZE + index;
          try {
            const response = await fetch(url);
            
            if (!response.ok) {
              console.warn(`跳過片段 ${globalIndex + 1}: HTTP ${response.status}`);
              return null;
            }

            const reader = response.body?.getReader();
            if (!reader) {
              console.warn(`跳過片段 ${globalIndex + 1}: 無法讀取響應體`);
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

            const segmentBuffer = new Uint8Array(segmentSize);
            let offset = 0;
            for (const chunk of chunks) {
              segmentBuffer.set(chunk, offset);
              offset += chunk.length;
            }

            return { index: globalIndex, data: segmentBuffer };
            
          } catch (err) {
            console.warn(`跳過損壞的片段 ${globalIndex + 1}:`, err);
            return null;
          }
        });

        const batchResults = await Promise.all(batchPromises);
        
        for (const result of batchResults) {
          if (result) {
            allChunks[result.index] = result.data;
            successCount++;
            totalBytes += result.data.length;
            setDownloadedSize(totalBytes);
            setProgress((successCount / segmentUrls.length) * 50); // 下載佔 50%
          }
        }
        
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      if (successCount === 0) {
        throw new Error('沒有成功下載任何影片片段');
      }

      // 合併片段
      const validChunks = allChunks.filter(chunk => chunk);
      const totalLength = validChunks.reduce((sum, chunk) => sum + chunk.length, 0);
      
      const mergedBuffer = new Uint8Array(totalLength);
      let offset = 0;
      
      for (const chunk of validChunks) {
        mergedBuffer.set(chunk, offset);
        offset += chunk.length;
      }

      let finalBuffer = mergedBuffer;
      let finalFileName = `${fileName}.ts`;
      
      // 如果選擇 MP4 格式，進行轉換
      if (outputFormat === 'mp4') {
        setProgress(50); // 下載完成，開始轉換
        finalBuffer = await convertToMP4(mergedBuffer);
        finalFileName = `${fileName}.mp4`;
      }

      // 建立並下載檔案
      const mimeType = outputFormat === 'mp4' ? 'video/mp4' : 'video/mp2t';
      const blob = new Blob([finalBuffer], { type: mimeType });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      
      setProgress(100);
      setTimeout(() => {
        setIsDownloading(false);
        setProgress(0);
        setDownloadedSize(0);
        setTotalSegments(0);
        setConversionProgress(0);
      }, 2000);

    } catch (err) {
      setError(err instanceof Error ? err.message : '下載失敗');
      setIsDownloading(false);
      setProgress(0);
      setDownloadedSize(0);
      setTotalSegments(0);
      setConversionProgress(0);
      setIsConverting(false);
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

    downloadVideo();
  };

  return (
    <div className={className}>
      {/* 格式選擇 */}
      <div className="mb-3">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          選擇下載格式：
        </label>
        <div className="flex space-x-4">
          <label className="flex items-center">
            <input
              type="radio"
              value="ts"
              checked={outputFormat === 'ts'}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              className="mr-2"
              disabled={isDownloading}
            />
            <span className="text-sm">TS 格式（推薦，快速下載）</span>
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              value="mp4"
              checked={outputFormat === 'mp4'}
              onChange={(e) => setOutputFormat(e.target.value as OutputFormat)}
              className="mr-2"
              disabled={isDownloading}
            />
            <span className="text-sm">MP4 格式（需要轉換時間）</span>
          </label>
        </div>
      </div>

      {/* 格式說明 */}
      {outputFormat === 'mp4' && (
        <div className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm">
          <div className="flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 text-yellow-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-yellow-800">MP4 轉換注意事項</div>
              <div className="text-yellow-700 mt-1">
                • 需要額外下載約 25MB 的轉換器檔案<br/>
                • 轉換過程會消耗較多 CPU 和記憶體<br/>
                • 大檔案轉換可能需要較長時間<br/>
                • 建議在桌面瀏覽器上使用
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 下載按鈕 */}
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
            {isConverting ? `轉換中... ${conversionProgress}%` : `下載中... ${Math.round(progress)}%`}
            {totalSegments > 0 && !isConverting && (
              <span className="text-xs ml-1">({Math.round(progress * totalSegments / 100)}/{totalSegments})</span>
            )}
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            下載IVOD影片 ({outputFormat.toUpperCase()})
          </>
        )}
      </button>
      
      {/* 進度顯示 */}
      {isDownloading && progress > 0 && (
        <div className="mt-2">
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>
              {isConverting ? '正在轉換為 MP4...' : '正在下載影片片段...'} {Math.round(progress)}%
              {totalSegments > 0 && !isConverting && ` (${Math.round(progress * totalSegments / 100)}/${totalSegments})`}
            </span>
            {downloadedSize > 0 && (
              <span>
                {(downloadedSize / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
          </div>
        </div>
      )}
      
      {/* 錯誤顯示 */}
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

export default VideoDownloaderWithMP4;