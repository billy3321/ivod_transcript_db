import { useEffect, useState } from 'react';

interface CrossOriginIsolationCheckerProps {
  onIsolationStatusChange?: (isIsolated: boolean) => void;
}

/**
 * 檢查 Cross-Origin-Isolation 狀態的組件
 * 用於診斷 FFmpeg WebAssembly 支援問題
 */
export default function CrossOriginIsolationChecker({ 
  onIsolationStatusChange 
}: CrossOriginIsolationCheckerProps) {
  const [isolationStatus, setIsolationStatus] = useState<{
    crossOriginIsolated: boolean;
    sharedArrayBufferSupported: boolean;
    webAssemblySupported: boolean;
    isSecureContext: boolean;
  } | null>(null);

  useEffect(() => {
    // 只在客戶端執行檢查
    if (typeof window === 'undefined') return;

    const status = {
      crossOriginIsolated: window.crossOriginIsolated || false,
      sharedArrayBufferSupported: typeof SharedArrayBuffer !== 'undefined',
      webAssemblySupported: typeof WebAssembly !== 'undefined',
      isSecureContext: window.isSecureContext || false,
    };

    setIsolationStatus(status);
    
    // 通知父組件 isolation 狀態
    if (onIsolationStatusChange) {
      onIsolationStatusChange(status.crossOriginIsolated);
    }

    // 輸出詳細診斷信息
    console.log('🔍 [Cross-Origin-Isolation] 環境檢查:', {
      ...status,
      userAgent: navigator.userAgent,
      location: window.location.href,
      headers: {
        coep: document.querySelector('meta[http-equiv="Cross-Origin-Embedder-Policy"]')?.getAttribute('content') || '未設定',
        coop: document.querySelector('meta[http-equiv="Cross-Origin-Opener-Policy"]')?.getAttribute('content') || '未設定'
      }
    });

  }, [onIsolationStatusChange]);

  // 不渲染任何 UI，純粹的狀態檢查組件
  return null;
}

/**
 * Hook 版本：用於在組件中檢查 Cross-Origin-Isolation 狀態
 */
export function useCrossOriginIsolation() {
  const [isIsolated, setIsIsolated] = useState<boolean | null>(null);
  const [isSupported, setIsSupported] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const crossOriginIsolated = window.crossOriginIsolated || false;
    const sharedArrayBufferSupported = typeof SharedArrayBuffer !== 'undefined';
    const webAssemblySupported = typeof WebAssembly !== 'undefined';

    setIsIsolated(crossOriginIsolated);
    setIsSupported(crossOriginIsolated && sharedArrayBufferSupported && webAssemblySupported);

    console.log('🔍 [Hook] Cross-Origin-Isolation 狀態:', {
      crossOriginIsolated,
      sharedArrayBufferSupported,
      webAssemblySupported,
      ffmpegSupported: crossOriginIsolated && sharedArrayBufferSupported && webAssemblySupported
    });
  }, []);

  return { isIsolated, isSupported };
}