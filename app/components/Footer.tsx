import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { formatTimestamp } from '@/lib/utils';

// 全域快取，避免重複 API 呼叫
// 因為資料庫每天才更新一次，所以只需要在進入網頁時讀取一次即可
let databaseStatusCache: { lastUpdated: string | null; loading: boolean; fetched: boolean } = {
  lastUpdated: null,
  loading: false,
  fetched: false
};

// 重置快取的函數（主要用於測試）
export const resetDatabaseStatusCache = () => {
  databaseStatusCache = {
    lastUpdated: null,
    loading: false,
    fetched: false
  };
};

const Footer: FC = () => {
  const currentYear = new Date().getFullYear();
  const [lastUpdated, setLastUpdated] = useState<string | null>(databaseStatusCache.lastUpdated);
  const [isLoadingStatus, setIsLoadingStatus] = useState(!databaseStatusCache.fetched);

  useEffect(() => {
    // 如果已經獲取過資料，直接使用快取
    // 資料庫每天才更新一次，所以不需要重複獲取
    if (databaseStatusCache.fetched) {
      setLastUpdated(databaseStatusCache.lastUpdated);
      setIsLoadingStatus(false);
      return;
    }

    // 如果正在載入中，不要重複呼叫
    if (databaseStatusCache.loading) {
      return;
    }

    const fetchDatabaseStatus = async () => {
      databaseStatusCache.loading = true;
      
      try {
        const response = await fetch('/api/database-status');
        if (response.ok) {
          const data = await response.json();
          databaseStatusCache.lastUpdated = data.lastUpdated;
          setLastUpdated(data.lastUpdated);
        }
      } catch (error) {
        console.error('Failed to fetch database status:', error);
      } finally {
        databaseStatusCache.loading = false;
        databaseStatusCache.fetched = true;
        setIsLoadingStatus(false);
      }
    };

    // 只在第一次載入時獲取資料庫狀態
    fetchDatabaseStatus();
  }, []);

  return (
    <footer className="bg-gray-800 text-white py-8 mt-auto">
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Site Info */}
          <div>
            <h3 className="text-lg font-semibold mb-4">IVOD 逐字稿檢索系統</h3>
            <p className="text-gray-300 text-sm leading-relaxed">
              提供第11屆立法院會議逐字記錄搜尋服務
            </p>
          </div>

          {/* Navigation Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">導覽</h3>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-gray-300 hover:text-white transition-colors duration-200">
                  首頁
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-gray-300 hover:text-white transition-colors duration-200">
                  關於我們
                </Link>
              </li>
            </ul>
          </div>

          {/* External Links */}
          <div>
            <h3 className="text-lg font-semibold mb-4">相關連結</h3>
            <ul className="space-y-2">
              <li>
                <a 
                  href="https://github.com/billy3321/ivod_transcript_db"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  原始碼
                </a>
              </li>
              <li>
                <a 
                  href="https://g0v.tw"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-300 hover:text-white transition-colors duration-200"
                >
                  g0v 零時政府
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-gray-700 mt-8 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="text-gray-400 text-sm mb-4 md:mb-0">
              © {currentYear} IVOD 逐字稿檢索系統。本網站採用 MIT License 授權。
            </div>
            <div className="text-gray-400 text-sm">
              開發者: billy3321、Yutin
            </div>
          </div>
          
          {/* Database Update Status */}
          {!isLoadingStatus && lastUpdated && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-center text-gray-400 text-sm">
                本資料庫最後更新時間為：{formatTimestamp(lastUpdated)}
              </div>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
};

export default Footer;