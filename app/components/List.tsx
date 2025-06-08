import Link from 'next/link';
import DOMPurify from 'dompurify';
import { IVOD } from '@/types';
import { formatCommitteeNames, formatIVODTitle, formatVideoTime, formatVideoType, formatTimestamp } from '@/lib/utils';
import Icon from './Icon';

interface ListProps {
  items: IVOD[];
  loading?: boolean;
}

export default function List({ items, loading = false }: ListProps) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-700">載入中...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.map(item => (
        <Link
          key={item.ivod_id}
          href={`/ivod/${item.ivod_id}`}
          className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200 p-6 border border-gray-200"
        >
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors mb-2">
                {formatIVODTitle(item.title, item.meeting_name, item.speaker_name)}
              </h2>
              {item.meeting_name && (
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {item.meeting_name}
                </p>
              )}
              
              {/* 搜尋摘要 */}
              {item.excerpt && item.excerpt.hasMatch && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center mb-2">
                    <Icon type="search" className="w-4 h-4 mr-1 text-yellow-600" />
                    <span className="text-sm font-medium text-yellow-800">搜尋結果摘要</span>
                  </div>
                  <div 
                    className="text-sm text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ 
                      __html: typeof window !== 'undefined' 
                        ? DOMPurify.sanitize(item.excerpt.text)
                        : item.excerpt.text.replace(/<[^>]*>/g, '') // Server-side fallback
                    }}
                  />
                </div>
              )}
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm text-gray-600">
                <div className="flex items-center">
                  <Icon type="calendar" className="w-4 h-4 mr-1 text-gray-400" />
                  <span>{formatTimestamp(item.date)}</span>
                </div>
                
                {item.video_type && (
                  <div className="flex items-center">
                    <Icon type="video" className="w-4 h-4 mr-1 text-gray-400" />
                    <span>{formatVideoType(item.video_type)}</span>
                  </div>
                )}
                
                {item.committee_names && (
                  <div className="flex items-center">
                    <Icon type="building" className="w-4 h-4 mr-1 text-gray-400" />
                    <span className="truncate">{formatCommitteeNames(item.committee_names)}</span>
                  </div>
                )}
                
                {(item.video_start || item.video_end) && (
                  <div className="flex items-center">
                    <Icon type="clock" className="w-4 h-4 mr-1 text-gray-400" />
                    <span>
                      {item.video_start && formatVideoTime(item.video_start)}
                      {item.video_start && item.video_end && ' - '}
                      {item.video_end && formatVideoTime(item.video_end)}
                    </span>
                  </div>
                )}
                
                {item.video_length && (
                  <div className="flex items-center">
                    <Icon type="photo" className="w-4 h-4 mr-1 text-gray-400" />
                    <span>時長: {item.video_length}</span>
                  </div>
                )}
                
                {item.category && (
                  <div className="flex items-center">
                    <Icon type="tag" className="w-4 h-4 mr-1 text-gray-400" />
                    <span className="truncate">{item.category}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center text-sm text-blue-600 hover:text-blue-700 flex-shrink-0">
              <span>查看詳細</span>
              <Icon type="arrow-right" className="w-4 h-4 ml-1" />
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}