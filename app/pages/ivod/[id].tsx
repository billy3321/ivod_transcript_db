import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { IVODDetail } from '@/types';
import TranscriptViewer from '@/components/TranscriptViewer';
import { formatCommitteeNames } from '@/lib/utils';
import Link from 'next/link';

export default function IvodDetail() {
  const router = useRouter();
  const { id } = router.query;
  const [data, setData] = useState<IVODDetail | null>(null);
  const [activeTab, setActiveTab] = useState<'ai' | 'ly'>('ai');

  useEffect(() => {
    if (!id) return;
    fetch(`/api/ivods/${id}`)
      .then(res => res.json())
      .then(json => setData(json.data));
  }, [id]);

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-700">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Simple Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800">
            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
            返回列表
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Meeting Info */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8 border border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">{data.meeting_name}</h1>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div className="flex items-center text-gray-600">
              <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <span className="font-medium">日期：</span>
              <span className="ml-1">{data.date}</span>
            </div>
            
            {data.speaker_name && (
              <div className="flex items-center text-gray-600">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">立委：</span>
                <span className="ml-1">{data.speaker_name}</span>
              </div>
            )}
            
            {data.committee_names && (
              <div className="flex items-center text-gray-600">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">委員會：</span>
                <span className="ml-1">{formatCommitteeNames(data.committee_names)}</span>
              </div>
            )}
            
            {data.video_length && (
              <div className="flex items-center text-gray-600">
                <svg className="w-4 h-4 mr-2 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">時長：</span>
                <span className="ml-1">{data.video_length}</span>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Video Section */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">影片播放</h2>
            
            {data.video_url ? (
              <video 
                controls 
                src={data.video_url} 
                className="w-full rounded-lg mb-4 bg-gray-100"
              />
            ) : (
              <div className="w-full h-48 bg-gray-100 rounded-lg flex items-center justify-center mb-4">
                <div className="text-center text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm3 2h6v4H7V5zm8 8v2h1v-2h-1zm-2-2H7v4h6v-4z" clipRule="evenodd" />
                  </svg>
                  <p>影片尚未提供</p>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-3">
              <a
                href={data.ivod_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                查看原始IVOD
              </a>
              <a
                href={`https://dataly.openfun.app/collection/item/ivod/${data.ivod_id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-md hover:bg-green-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M11 3a1 1 0 100 2h2.586l-6.293 6.293a1 1 0 101.414 1.414L15 6.414V9a1 1 0 102 0V4a1 1 0 00-1-1h-5z" />
                  <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
                </svg>
                在 Dataly 查看
              </a>
            </div>
          </div>

          {/* Transcript Section */}
          <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">逐字稿</h2>
              <div className="flex bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('ai')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'ai'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  AI 逐字稿
                </button>
                <button
                  onClick={() => setActiveTab('ly')}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                    activeTab === 'ly'
                      ? 'bg-white text-blue-700 shadow-sm'
                      : 'text-gray-600 hover:text-gray-800'
                  }`}
                >
                  立院逐字稿
                </button>
              </div>
            </div>
            
            <div className="min-h-[400px] max-h-[600px] overflow-y-auto">
              {activeTab === 'ai' ? (
                data.ai_transcript ? (
                  <TranscriptViewer transcript={data.ai_transcript} />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p>AI 逐字稿尚未提供</p>
                    </div>
                  </div>
                )
              ) : (
                data.ly_transcript ? (
                  <TranscriptViewer transcript={data.ly_transcript} />
                ) : (
                  <div className="flex items-center justify-center h-64 text-gray-500">
                    <div className="text-center">
                      <svg className="w-12 h-12 mx-auto mb-2" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <p>立院逐字稿尚未提供</p>
                    </div>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}