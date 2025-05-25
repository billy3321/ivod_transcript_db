import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import Head from 'next/head';
import { IVODDetail } from '@/types';
import TranscriptViewer from '@/components/TranscriptViewer';
import StructuredData from '@/components/StructuredData';
import { formatCommitteeNames, formatIVODTitle, formatVideoTime, formatVideoType, formatTimestamp } from '@/lib/utils';
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

  const generateMetaTags = () => {
    if (!data) return null;
    
    const formattedTitle = formatIVODTitle(data.title, data.meeting_name, data.speaker_name);
    const title = `${formattedTitle} - ${formatTimestamp(data.date)} - IVOD 逐字稿檢索系統`;
    const description = `${formattedTitle}，${formatTimestamp(data.date)}${data.video_type ? `，${formatVideoType(data.video_type)}` : ''}。台灣立法院IVOD影片與逐字稿檢索，提供完整會議記錄。${data.meeting_name ? ` 會議：${data.meeting_name}` : ''}${data.committee_names ? `，委員會：${formatCommitteeNames(data.committee_names)}` : ''}`;
    const keywords = `立法院,IVOD,逐字稿,${data.title || ''},${data.meeting_name || ''},${data.speaker_name || ''},台灣政治,會議紀錄,${data.committee_names ? formatCommitteeNames(data.committee_names) : ''},${data.video_type || ''}`;
    const canonicalUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://ivod-search.g0v.tw'}/ivod/${data.ivod_id}`;
    
    return (
      <Head>
        <title>{title}</title>
        <meta name="description" content={description} />
        <meta name="keywords" content={keywords} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        
        {/* Open Graph */}
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:article:published_time" content={formatTimestamp(data.date)} />
        <meta property="og:article:author" content={data.speaker_name || '立法院'} />
        <meta property="og:article:section" content="政治" />
        <meta property="og:article:tag" content="立法院" />
        
        {/* Twitter Card */}
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        
        {/* Legislative specific metadata */}
        <meta name="DC.date" content={formatTimestamp(data.date)} />
        <meta name="DC.subject" content={formattedTitle} />
        <meta name="DC.description" content={data.meeting_name || ''} />
        <meta name="DC.contributor" content={data.speaker_name || ''} />
        <meta name="DC.identifier" content={data.ivod_id.toString()} />
        <meta name="DC.type" content={data.video_type || 'Video'} />
        <meta name="DC.coverage" content={data.committee_names ? formatCommitteeNames(data.committee_names) : ''} />
        
        {/* Canonical URL */}
        <link rel="canonical" href={canonicalUrl} />
      </Head>
    );
  };

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
    <>
      {data && generateMetaTags()}
      {data && <StructuredData data={data} />}
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
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {formatIVODTitle(data.title, data.meeting_name, data.speaker_name)}
          </h1>
          {data.meeting_name && (
            <p className="text-lg text-gray-700 mb-6">{data.meeting_name}</p>
          )}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-sm">
            <div className="flex items-start text-gray-600">
              <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
              </svg>
              <div>
                <span className="font-medium">日期：</span>
                <span className="ml-1">{formatTimestamp(data.date)}</span>
              </div>
            </div>
            
            {data.video_type && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zm12.553 1.106A1 1 0 0014 8v4a1 1 0 001.553.894l2-1.333a1 1 0 000-1.788l-2-1.333z" />
                </svg>
                <div>
                  <span className="font-medium">類型：</span>
                  <span className="ml-1">{formatVideoType(data.video_type)}</span>
                </div>
              </div>
            )}
            
            {data.committee_names && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-medium">委員會：</span>
                  <span className="ml-1">{formatCommitteeNames(data.committee_names)}</span>
                </div>
              </div>
            )}
            
            {(data.video_start || data.video_end) && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-medium">時間：</span>
                  <span className="ml-1">
                    {data.video_start && formatVideoTime(data.video_start)}
                    {data.video_start && data.video_end && ' - '}
                    {data.video_end && formatVideoTime(data.video_end)}
                  </span>
                </div>
              </div>
            )}
            
            {data.video_length && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" />
                </svg>
                <div>
                  <span className="font-medium">時長：</span>
                  <span className="ml-1">{data.video_length}</span>
                </div>
              </div>
            )}
            
            {data.category && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M17.707 9.293a1 1 0 010 1.414l-7 7a1 1 0 01-1.414 0l-7-7A.997.997 0 012 10V5a3 3 0 013-3h5c.256 0 .512.098.707.293l7 7zM5 6a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-medium">分類：</span>
                  <span className="ml-1">{data.category}</span>
                </div>
              </div>
            )}
            
            {(data.meeting_code || data.meeting_code_str) && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-medium">會議代碼：</span>
                  <span className="ml-1">{data.meeting_code || data.meeting_code_str}</span>
                </div>
              </div>
            )}
            
            {data.meeting_time && (
              <div className="flex items-start text-gray-600">
                <svg className="w-4 h-4 mr-2 mt-0.5 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                </svg>
                <div>
                  <span className="font-medium">會議時間：</span>
                  <span className="ml-1">{formatTimestamp(data.meeting_time)}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Status Information */}
          <div className="mt-6 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-900 mb-3">處理狀態</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center">
                <span className="font-medium text-gray-600">AI 逐字稿：</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  data.ai_status === 'success' ? 'bg-green-100 text-green-800' :
                  data.ai_status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {data.ai_status === 'success' ? '已完成' :
                   data.ai_status === 'failed' ? '失敗' : '處理中'}
                </span>
              </div>
              <div className="flex items-center">
                <span className="font-medium text-gray-600">立院逐字稿：</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs ${
                  data.ly_status === 'success' ? 'bg-green-100 text-green-800' :
                  data.ly_status === 'failed' ? 'bg-red-100 text-red-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {data.ly_status === 'success' ? '已完成' :
                   data.ly_status === 'failed' ? '失敗' : '處理中'}
                </span>
              </div>
            </div>
            <div className="mt-2 text-xs text-gray-500">
              最後更新：{formatTimestamp(data.last_updated)}
            </div>
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
    </>
  );
}