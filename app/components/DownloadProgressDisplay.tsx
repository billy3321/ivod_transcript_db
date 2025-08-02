import React from 'react';

interface DownloadProgress {
  isDownloading: boolean;
  progress: number;
  conversionProgress: number;
  isConverting: boolean;
  downloadedSize: number;
  totalSegments: number;
  error: string | null;
}

interface DownloadProgressDisplayProps {
  progress: DownloadProgress | null;
  onDismissError?: () => void;
}

const DownloadProgressDisplay: React.FC<DownloadProgressDisplayProps> = ({ progress, onDismissError }) => {
  if (!progress) return null;

  const { isDownloading, progress: downloadProgress, conversionProgress, isConverting, downloadedSize, totalSegments, error } = progress;

  return (
    <div className="mt-2">
      {isDownloading && downloadProgress > 0 && (
        <div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-orange-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>
              {isConverting ? `正在轉換為 MP4... ${conversionProgress}%` : `正在下載影片片段... ${Math.round(downloadProgress)}%`}
              {totalSegments > 0 && !isConverting && ` (${Math.round(downloadProgress * totalSegments / 50)}/${totalSegments})`}
            </span>
            {downloadedSize > 0 && (
              <span>
                {(downloadedSize / (1024 * 1024)).toFixed(1)} MB
              </span>
            )}
          </div>
        </div>
      )}
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 max-w-full">
          <div className="flex items-start">
            <svg className="w-4 h-4 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div className="flex-1 break-words">
              {error}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadProgressDisplay;