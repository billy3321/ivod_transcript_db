import Link from 'next/link';
import { IVOD } from '@/types';
import { formatCommitteeNames } from '@/lib/utils';

interface ListProps {
  items: IVOD[];
}

export default function List({ items }: ListProps) {
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
                {item.meeting_name}
              </h2>
              
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center">
                  <svg className="w-4 h-4 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                  </svg>
                  <span>{item.date}</span>
                </div>
                
                {item.speaker_name && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{item.speaker_name}</span>
                  </div>
                )}
                
                {item.committee_names && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                    </svg>
                    <span className="truncate">{formatCommitteeNames(item.committee_names)}</span>
                  </div>
                )}
                
                {item.video_length && (
                  <div className="flex items-center">
                    <svg className="w-4 h-4 mr-1 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    <span>{item.video_length}</span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex items-center text-sm text-blue-600 hover:text-blue-700 flex-shrink-0">
              <span>查看詳細</span>
              <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}