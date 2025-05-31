import { useState } from 'react';

interface PaginationProps {
  currentPage: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, total, pageSize, onPageChange }: PaginationProps) {
  const [jumpToPage, setJumpToPage] = useState<string>('');
  const totalPages = Math.ceil(total / pageSize);
  
  if (totalPages <= 1) return null;

  // 計算要顯示的頁碼範圍
  const getVisiblePages = () => {
    const delta = 2; // 當前頁面前後顯示的頁數
    const range = [];
    const rangeWithDots = [];

    // 總是顯示第一頁
    range.push(1);

    // 計算當前頁面周圍的頁碼
    for (let i = Math.max(2, currentPage - delta); i <= Math.min(totalPages - 1, currentPage + delta); i++) {
      range.push(i);
    }

    // 總是顯示最後一頁
    if (totalPages > 1) {
      range.push(totalPages);
    }

    // 去重複並排序
    const uniqueRange = [...new Set(range)].sort((a, b) => a - b);

    // 在需要的地方加入省略號
    let prev = 0;
    for (const page of uniqueRange) {
      if (page - prev > 1) {
        rangeWithDots.push('...');
      }
      rangeWithDots.push(page);
      prev = page;
    }

    return rangeWithDots;
  };

  const handleJumpToPage = () => {
    const page = parseInt(jumpToPage, 10);
    if (page >= 1 && page <= totalPages) {
      onPageChange(page);
      setJumpToPage('');
    }
  };

  const handleJumpKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleJumpToPage();
    }
  };

  const visiblePages = getVisiblePages();

  return (
    <div className="flex flex-col sm:flex-row items-center gap-4 mt-6">
      {/* 分頁按鈕區域 */}
      <div className="flex items-center space-x-1">
        {/* 上一頁按鈕 */}
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
            currentPage <= 1
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
          }`}
          aria-label="上一頁"
        >
          ‹
        </button>

        {/* 頁碼按鈕 */}
        {visiblePages.map((page, index) => {
          if (page === '...') {
            return (
              <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500">
                ...
              </span>
            );
          }

          const pageNum = page as number;
          const isCurrentPage = pageNum === currentPage;

          return (
            <button
              key={pageNum}
              onClick={() => onPageChange(pageNum)}
              className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
                isCurrentPage
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
              }`}
              aria-label={`第 ${pageNum} 頁`}
              aria-current={isCurrentPage ? 'page' : undefined}
            >
              {pageNum}
            </button>
          );
        })}

        {/* 下一頁按鈕 */}
        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className={`px-3 py-2 text-sm font-medium border rounded-md transition-colors ${
            currentPage >= totalPages
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50 hover:border-gray-400'
          }`}
          aria-label="下一頁"
        >
          ›
        </button>
      </div>

      {/* 頁面跳轉區域 */}
      <div className="flex items-center space-x-2 text-sm">
        <span className="text-gray-600">跳至</span>
        <input
          type="number"
          min="1"
          max={totalPages}
          value={jumpToPage}
          onChange={(e) => setJumpToPage(e.target.value)}
          onKeyPress={handleJumpKeyPress}
          placeholder="頁數"
          className="w-16 px-2 py-1 text-center border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          aria-label="跳轉到指定頁面"
        />
        <button
          onClick={handleJumpToPage}
          disabled={!jumpToPage || parseInt(jumpToPage, 10) < 1 || parseInt(jumpToPage, 10) > totalPages}
          className={`px-3 py-1 text-sm font-medium border rounded transition-colors ${
            !jumpToPage || parseInt(jumpToPage, 10) < 1 || parseInt(jumpToPage, 10) > totalPages
              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
              : 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700'
          }`}
        >
          跳轉
        </button>
        <span className="text-gray-500">/ {totalPages}</span>
      </div>

      {/* 分頁資訊 */}
      <div className="text-sm text-gray-600">
        共 {total.toLocaleString()} 筆，第 {currentPage} / {totalPages} 頁
      </div>
    </div>
  );
}