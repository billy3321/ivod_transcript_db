import { IVOD } from '@/types';
import List from './List';
import Icon from './Icon';
import { SearchScope } from './SearchHeader';

interface SearchResultsProps {
  data: { data: IVOD[]; meta: { total: number; page: number; pageSize: number } } | null;
  loading: boolean;
  searchScope: SearchScope;
  searchQuery: string;
  transcriptSearchResults: { id: number; transcript: string }[];
}

export default function SearchResults({
  data,
  loading,
  searchScope,
  searchQuery,
  transcriptSearchResults,
}: SearchResultsProps) {
  // Results Count
  const renderResultsCount = () => {
    if (!data) return null;

    return (
      <div className="mb-6 flex items-center justify-between">
        <p className="text-sm text-gray-700">
          找到 <span className="font-semibold">{data.meta?.total || 0}</span> 筆 IVOD 紀錄
          {searchScope === 'transcript' && transcriptSearchResults.length > 0 && (
            <span className="ml-2 text-blue-600">
              ・{transcriptSearchResults.length} 筆逐字稿符合關鍵字
            </span>
          )}
          {searchScope === 'all' && searchQuery && (
            <span className="ml-2 text-green-600">
              ・搜尋範圍：全部欄位
            </span>
          )}
          {searchScope === 'transcript' && searchQuery && (
            <span className="ml-2 text-orange-600">
              ・搜尋範圍：僅逐字稿
            </span>
          )}
        </p>
        
        {loading && (
          <div className="flex items-center text-sm text-gray-500">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
            搜尋中...
          </div>
        )}
      </div>
    );
  };

  // IVOD List
  const renderList = () => {
    if (loading) {
      return <List items={[]} loading={true} />;
    }

    if (data?.data && data.data.length > 0) {
      return <List items={data.data} />;
    }

    // No results
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center" suppressHydrationWarning>
        <Icon type="search" className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">沒有找到符合的資料</h3>
        <p className="text-gray-500">請嘗試調整搜尋條件或清除篩選</p>
      </div>
    );
  };

  return (
    <>
      {renderResultsCount()}
      <div className="mb-8">
        {renderList()}
      </div>
    </>
  );
}