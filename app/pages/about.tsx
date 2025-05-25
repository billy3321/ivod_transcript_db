import Link from 'next/link';
import Head from 'next/head';

export default function About() {
  return (
    <>
      <Head>
        <title>關於本站 - IVOD 逐字稿檢索系統</title>
        <meta name="description" content="IVOD 逐字稿檢索系統的開發資訊與授權條款" />
      </Head>
      
      <div className="min-h-screen bg-gray-50">
        {/* Simple Header */}
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <Link href="/" className="inline-flex items-center text-blue-600 hover:text-blue-800">
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              返回首頁
            </Link>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="bg-white rounded-lg shadow-sm p-8 border border-gray-200">
            <h1 className="text-3xl font-bold text-gray-900 mb-8">關於本站</h1>
            
            <div className="prose prose-lg max-w-none mb-12">
              <p className="text-lg text-gray-700 leading-relaxed">
                本站為IVOD搜尋網站，會定期更新第11屆立法院之會議逐字記錄，並提供搜尋介面以供尋找特定IVOD影片。
              </p>
            </div>

            <div className="border-t border-gray-200 pt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">關於我們</h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">開發者</h3>
                  <p className="text-gray-700">billy3321、Yutin</p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">授權條款</h3>
                  <p className="text-gray-700 mb-2">
                    本網站為g0v專案，以MIT License釋出。
                  </p>
                  <div className="bg-gray-50 p-4 rounded-md">
                    <p className="text-sm text-gray-600 mb-2">本站原始碼：</p>
                    <a 
                      href="https://github.com/billy3321/ivod_transcript_db"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline font-mono text-sm break-all"
                    >
                      https://github.com/billy3321/ivod_transcript_db
                    </a>
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-3">特別感謝</h3>
                  <p className="text-gray-700">ronny wang</p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}