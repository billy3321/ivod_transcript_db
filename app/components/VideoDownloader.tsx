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
  conversionProgress: number;
  isConverting: boolean;
  downloadedSize: number;
  totalSegments: number;
  error: string | null;
}

const VideoDownloader: React.FC<VideoDownloaderProps> = ({ 
  videoUrl, 
  fileName = 'ivod-video.mp4',
  className = '',
  onProgressChange
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [downloadedSize, setDownloadedSize] = useState(0);
  const [totalSegments, setTotalSegments] = useState(0);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [isConverting, setIsConverting] = useState(false);

  // Report progress changes to parent component
  useEffect(() => {
    if (onProgressChange) {
      if (isDownloading || error) {
        onProgressChange({
          isDownloading,
          progress,
          conversionProgress,
          isConverting,
          downloadedSize,
          totalSegments,
          error
        });
      } else {
        onProgressChange(null);
      }
    }
  }, [isDownloading, progress, conversionProgress, isConverting, downloadedSize, totalSegments, error, onProgressChange]);

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

  // 檢查是否為開發環境
  const isLocalhost = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  // 載入 FFmpeg WebAssembly 進行 MP4 轉換
  const loadFFmpeg = async () => {
    if (typeof window === 'undefined') return null;
    
    // 假設1：瀏覽器環境檢測失敗
    console.log('🔍 [FFmpeg診斷] 開始載入診斷...');
    console.log('🔍 [FFmpeg診斷] 瀏覽器環境檢查:', {
      userAgent: navigator.userAgent,
      webAssemblySupported: typeof WebAssembly !== 'undefined',
      sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined',
      crossOriginIsolated: window.crossOriginIsolated,
      isSecureContext: window.isSecureContext,
      location: window.location.href
    });
    
    try {
      // 假設2：動態模組載入問題
      console.log('🔍 [FFmpeg診斷] 嘗試載入 @ffmpeg/ffmpeg 模組...');
      const { FFmpeg } = await import('@ffmpeg/ffmpeg');
      console.log('✅ [FFmpeg診斷] @ffmpeg/ffmpeg 模組載入成功');
      
      console.log('🔍 [FFmpeg診斷] 嘗試載入 @ffmpeg/util 模組...');
      const { toBlobURL } = await import('@ffmpeg/util');
      console.log('✅ [FFmpeg診斷] @ffmpeg/util 模組載入成功');
      
      const ffmpeg = new FFmpeg();
      
      // 設定轉換進度回調
      ffmpeg.on('progress', ({ progress }) => {
        const conversionPercent = Math.round(progress * 100);
        const totalPercent = 75 + Math.round(progress * 25);
        setConversionProgress(conversionPercent);
        setProgress(totalPercent);
      });
      
      // 生產環境優先使用可靠的 CDN 來源
      const cdnUrls = isLocalhost ? [
        // 開發環境：較少嘗試，直接失敗回退到 TS
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      ] : [
        // 生產環境：多個可靠的 CDN 來源確保成功率
        'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm',
        'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'
      ];
      
      let loadSuccess = false;
      let lastError = null;
      
      for (const baseURL of cdnUrls) {
        try {
          console.log(`🔍 [FFmpeg診斷] 嘗試載入 FFmpeg from: ${baseURL}`);
          
          // 假設3：CDN資源載入問題 - 詳細檢測每個檔案
          console.log('🔍 [FFmpeg診斷] 檢查 ffmpeg-core.js 可達性...');
          const coreResponse = await fetch(`${baseURL}/ffmpeg-core.js`);
          console.log('🔍 [FFmpeg診斷] ffmpeg-core.js 響應:', {
            url: `${baseURL}/ffmpeg-core.js`,
            status: coreResponse.status,
            statusText: coreResponse.statusText,
            headers: Object.fromEntries(coreResponse.headers.entries()),
            contentType: coreResponse.headers.get('content-type')
          });
          
          console.log('🔍 [FFmpeg診斷] 檢查 ffmpeg-core.wasm 可達性...');
          const wasmResponse = await fetch(`${baseURL}/ffmpeg-core.wasm`);
          console.log('🔍 [FFmpeg診斷] ffmpeg-core.wasm 響應:', {
            url: `${baseURL}/ffmpeg-core.wasm`,
            status: wasmResponse.status,
            statusText: wasmResponse.statusText,
            headers: Object.fromEntries(wasmResponse.headers.entries()),
            contentType: wasmResponse.headers.get('content-type'),
            contentLength: wasmResponse.headers.get('content-length')
          });
          
          console.log('🔍 [FFmpeg診斷] 嘗試轉換為 Blob URLs...');
          const coreURL = await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript');
          const wasmURL = await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm');
          console.log('✅ [FFmpeg診斷] Blob URLs 創建成功:', { coreURL, wasmURL });
          
          console.log('🔍 [FFmpeg診斷] 開始 FFmpeg 載入...');
          await ffmpeg.load({
            coreURL,
            wasmURL,
          });
          
          loadSuccess = true;
          console.log('✅ [FFmpeg診斷] FFmpeg 載入成功!');
          break;
        } catch (err) {
          console.error(`❌ [FFmpeg診斷] CDN ${baseURL} 載入失敗:`, {
            error: err,
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : 'N/A',
            name: err instanceof Error ? err.name : 'Unknown'
          });
          lastError = err;
          continue;
        }
      }
      
      if (!loadSuccess) {
        console.error('❌ [FFmpeg診斷] 所有 CDN 來源都載入失敗');
        throw lastError || new Error('所有 CDN 來源都無法載入');
      }
      
      return ffmpeg;
    } catch (error) {
      console.error('❌ [FFmpeg診斷] 最終載入失敗:', {
        error: error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : 'N/A',
        name: error instanceof Error ? error.name : 'Unknown'
      });
      
      // 根據錯誤類型提供具體建議
      let errorMessage = '影片轉換功能暫時無法使用。';
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('Failed to fetch') || errorMsg.includes('NetworkError')) {
        errorMessage += '網路連線問題或 CDN 無法訪問，';
        console.error('🔧 [FFmpeg診斷] 建議：檢查網路連線或嘗試VPN');
      } else if (errorMsg.includes('WebAssembly') || errorMsg.includes('wasm')) {
        errorMessage += '瀏覽器 WebAssembly 支援問題，';
        console.error('🔧 [FFmpeg診斷] 建議：更新瀏覽器或啟用 WebAssembly');
      } else if (errorMsg.includes('SharedArrayBuffer') || errorMsg.includes('crossOriginIsolated')) {
        errorMessage += '跨域隔離設定問題，';
        console.error('🔧 [FFmpeg診斷] 建議：檢查 HTTPS 和 Cross-Origin-Isolation headers');
      } else if (errorMsg.includes('import') || errorMsg.includes('module')) {
        errorMessage += 'ES6 模組載入問題，';
        console.error('🔧 [FFmpeg診斷] 建議：檢查瀏覽器模組支援或構建配置');
      } else {
        console.error('🔧 [FFmpeg診斷] 未知錯誤類型，需要進一步調查');
      }
      
      errorMessage += '將改為下載 TS 格式。';
      console.error(errorMessage);
      return null;
    }
  };

  // 轉換 TS 為 MP4
  const convertToMP4 = async (tsData: Uint8Array): Promise<Uint8Array | null> => {
    setIsConverting(true);
    setConversionProgress(0);
    // 設定初始進度為 75%，因為下載階段已完成
    setProgress(75);
    
    try {
      console.log('🔄 [轉換診斷] 開始轉換 MP4...');
      const ffmpeg = await loadFFmpeg();
      if (!ffmpeg) {
        console.error('❌ [轉換診斷] FFmpeg 載入失敗');
        return null;
      }
      
      // 寫入輸入檔案並執行轉換
      await ffmpeg.writeFile('input.ts', tsData);
      await ffmpeg.exec(['-i', 'input.ts', '-c', 'copy', '-movflags', 'frag_keyframe+empty_moov', 'output.mp4']);
      
      // 讀取輸出檔案
      const mp4Data = await ffmpeg.readFile('output.mp4');
      console.log('✅ [轉換診斷] MP4 轉換成功');
      
      // 清理記憶體
      try {
        await ffmpeg.deleteFile('input.ts');
        await ffmpeg.deleteFile('output.mp4');
      } catch (cleanupError) {
        console.warn('清理暫存檔案失敗:', cleanupError);
      }
      
      setIsConverting(false);
      return mp4Data as Uint8Array;
      
    } catch (error) {
      setIsConverting(false);
      setConversionProgress(0);
      console.error('❌ [轉換診斷] MP4 轉換失敗:', error);
      
      // 提供更具體的錯誤訊息
      let errorMessage = '影片轉換失敗。';
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('載入')) {
        errorMessage += '轉換器載入問題，';
      } else if (errorMsg.includes('WebAssembly')) {
        errorMessage += '瀏覽器相容性問題，';
      } else if (errorMsg.includes('exec')) {
        errorMessage += '轉換過程出錯，';
      }
      errorMessage += '將改為下載原始格式。';
      
      throw new Error(errorMessage);
    }
  };

  // 記憶體友善的分批下載和合併
  const downloadVideoStreaming = async () => {
    setIsDownloading(true);
    setProgress(0);
    setError(null);
    setDownloadedSize(0);
    setTotalSegments(0);
    setConversionProgress(0);
    setIsConverting(false);

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
              console.warn(`跳過片段 ${globalIndex + 1}: HTTP ${response.status}`);
              return null;
            }

            // 使用串流讀取響應，避免一次性載入大塊記憶體
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
            console.warn(`跳過損壞的片段 ${globalIndex + 1}:`, err);
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

      // 嘗試轉換為 MP4 格式，失敗時提供 TS 下載
      setProgress(75); // 下載完成，開始轉換
      
      let finalBuffer = mergedBuffer;
      let fileType = 'video/mp4';
      let finalFileName = fileName;
      
      // 準備檔名：移除現有副檔名，準備添加正確的副檔名
      const baseFileName = fileName.replace(/\.(mp4|ts)$/i, '');
      
      const mp4Buffer = await convertToMP4(mergedBuffer);
      if (mp4Buffer) {
        finalBuffer = mp4Buffer;
        fileType = 'video/mp4';
        finalFileName = baseFileName + '.mp4';
        console.log('✅ MP4 轉換成功，檔名:', finalFileName);
      } else {
        console.warn('❌ MP4 轉換失敗，下載 TS 格式');
        // 轉換失敗時，下載原始 TS 格式
        finalBuffer = mergedBuffer;
        fileType = 'video/mp2t';
        finalFileName = baseFileName + '.ts';
        console.log('📁 TS 下載，檔名:', finalFileName);
        
        // 根據不同情況提供適當的錯誤訊息
        if (isLocalhost) {
          setError('📥 開發環境下提供 TS 格式下載（生產環境支援 MP4）。TS 檔案可用 VLC 播放器開啟。');
        } else {
          setError('⚠️ MP4 轉換暫時無法使用，已改為下載 TS 格式。TS 檔案可用 VLC 等播放器開啟。');
        }
        
        // 清除轉換狀態
        setIsConverting(false);
        setConversionProgress(0);
      }

      // 創建 Blob 並觸發下載
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
        setConversionProgress(0);
        // 只有在下載成功時才清除錯誤訊息，讓使用者看到轉換失敗的提示
        if (!error || !error.includes('轉換失敗')) {
          setError(null);
        }
      }, 3000); // 延長顯示時間讓使用者看到結果

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
            {isConverting ? `轉換中... ${Math.round(progress)}% (長影片需較多時間)` : `下載中... ${Math.round(progress)}%`}
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