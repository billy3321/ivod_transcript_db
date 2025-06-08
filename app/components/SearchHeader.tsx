import { useState } from 'react';
import Icon from './Icon';
import ChevronIcon from './ChevronIcon';

export type SearchScope = 'all' | 'transcript';

interface AdvancedSearchInput {
  meeting_name: string;
  speaker: string;
  committee: string;
  date_from: string;
  date_to: string;
}

interface SearchHeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchScope: SearchScope;
  setSearchScope: (scope: SearchScope) => void;
  sortOrder: 'date_desc' | 'date_asc';
  setSortOrder: (order: 'date_desc' | 'date_asc') => void;
  advancedInput: AdvancedSearchInput;
  setAdvancedInput: (input: AdvancedSearchInput) => void;
  showAdvancedSearch: boolean;
  setShowAdvancedSearch: (show: boolean) => void;
  hasActiveFilters: boolean;
  onSearch: () => void;
  onClearFilters: () => void;
  onKeyPress: (e: React.KeyboardEvent) => void;
}

export default function SearchHeader({
  searchQuery,
  setSearchQuery,
  searchScope,
  setSearchScope,
  sortOrder,
  setSortOrder,
  advancedInput,
  setAdvancedInput,
  showAdvancedSearch,
  setShowAdvancedSearch,
  hasActiveFilters,
  onSearch,
  onClearFilters,
  onKeyPress,
}: SearchHeaderProps) {
  const handleAdvancedInputChange = (key: keyof AdvancedSearchInput, value: string) => {
    setAdvancedInput({ ...advancedInput, [key]: value });
  };

  return (
    <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
      {/* Main Search */}
      <div className="space-y-4 mb-4">
        {/* Mobile: Vertical Layout, Desktop: Horizontal Layout */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search Input - Full Width on Mobile, First on Desktop */}
          <div className="relative flex-1 order-1 sm:order-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Icon type="search" className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder={searchScope === 'all' ? "搜尋會議名稱、立委姓名、逐字稿內容..." : "搜尋逐字稿內容..."}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={onKeyPress}
              className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg text-lg placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Mobile: Second Row with Dropdown and Button */}
          <div className="flex gap-3 order-2 sm:order-1 sm:contents">
            {/* Search Scope Dropdown */}
            <select
              value={searchScope}
              onChange={(e) => setSearchScope(e.target.value as SearchScope)}
              className="flex-1 sm:flex-shrink-0 sm:flex-initial border border-gray-300 rounded-lg px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
            >
              <option value="all">搜尋全部欄位</option>
              <option value="transcript">僅搜尋逐字稿</option>
            </select>

            {/* Search Button */}
            <button
              onClick={onSearch}
              className="flex-1 sm:flex-shrink-0 sm:flex-initial bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors order-3"
            >
              搜尋
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Search Syntax Help */}
      <div className="mt-3 text-xs text-gray-600">
        <details className="group">
          <summary className="cursor-pointer text-blue-600 hover:text-blue-800 select-none">
            進階搜尋語法
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded-md text-xs space-y-1">
            <div><strong>引號搜尋：</strong> <code>&quot;完整詞組&quot;</code> - 搜尋完整詞組</div>
            <div><strong>布林運算：</strong> <code>預算 AND 教育</code>, <code>王委員 OR 李委員</code> - AND/OR 邏輯</div>
            <div><strong>群組搜尋：</strong> <code>(預算 OR 教育) AND 委員會</code> - 括弧分組</div>
            <div><strong>欄位搜尋：</strong> <code>title:&quot;會議名稱&quot;</code>, <code>speaker:&quot;立委名稱&quot;</code>, <code>meeting:&quot;會議&quot;</code></div>
            <div><strong>排除搜尋：</strong> <code>-詞彙</code> 或 <code>-&quot;詞組&quot;</code> - 排除特定內容</div>
            <div><strong>複合範例：</strong> <code>(speaker:&quot;王委員&quot; OR speaker:&quot;李委員&quot;) AND &quot;預算&quot; -&quot;國防&quot;</code></div>
          </div>
        </details>
      </div>

      {/* Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <button
          onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          <ChevronIcon isRotated={showAdvancedSearch} className="w-4 h-4 mr-1" />
          進階搜尋
        </button>
        
        <div className="flex items-center space-x-4">
          {hasActiveFilters && (
            <button
              onClick={onClearFilters}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              清除篩選
            </button>
          )}
          
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'date_desc' | 'date_asc')}
            className="text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="date_desc">最新優先</option>
            <option value="date_asc">最舊優先</option>
          </select>
        </div>
      </div>

      {/* Advanced Search Fields */}
      {showAdvancedSearch && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div>
            <label htmlFor="meeting_name" className="block text-sm font-medium text-gray-700 mb-1">
              會議名稱
            </label>
            <input
              id="meeting_name"
              type="text"
              placeholder="例：委員會全體會議"
              value={advancedInput.meeting_name}
              onChange={(e) => handleAdvancedInputChange('meeting_name', e.target.value)}
              onKeyPress={onKeyPress}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="speaker" className="block text-sm font-medium text-gray-700 mb-1">
              立委姓名
            </label>
            <input
              id="speaker"
              type="text"
              placeholder="例：王委員"
              value={advancedInput.speaker}
              onChange={(e) => handleAdvancedInputChange('speaker', e.target.value)}
              onKeyPress={onKeyPress}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="committee" className="block text-sm font-medium text-gray-700 mb-1">
              委員會
            </label>
            <input
              id="committee"
              type="text"
              placeholder="例：教育文化"
              value={advancedInput.committee}
              onChange={(e) => handleAdvancedInputChange('committee', e.target.value)}
              onKeyPress={onKeyPress}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="date_from" className="block text-sm font-medium text-gray-700 mb-1">
              開始日期
            </label>
            <input
              id="date_from"
              type="date"
              value={advancedInput.date_from}
              onChange={(e) => handleAdvancedInputChange('date_from', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div>
            <label htmlFor="date_to" className="block text-sm font-medium text-gray-700 mb-1">
              結束日期
            </label>
            <input
              id="date_to"
              type="date"
              value={advancedInput.date_to}
              onChange={(e) => handleAdvancedInputChange('date_to', e.target.value)}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}