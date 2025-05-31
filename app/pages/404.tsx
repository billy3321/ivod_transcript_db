import Link from 'next/link';
import Head from 'next/head';

export default function Custom404() {
  return (
    <>
      <Head>
        <title>找不到頁面 - IVOD 逐字稿檢索系統</title>
        <meta name="description" content="抱歉，您訪問的頁面不存在" />
      </Head>
      
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
            {/* 404 圖示 */}
            <div className="mx-auto w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.137 0-4.146-.832-5.657-2.343M6.343 6.343A7.962 7.962 0 0112 4c2.137 0 4.146.832 5.657 2.343M12 21a9 9 0 100-18 9 9 0 000 18z" 
                />
              </svg>
            </div>

            {/* 標題和說明 */}
            <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
            <h2 className="text-2xl font-semibold text-gray-700 mb-4">找不到頁面</h2>
            <p className="text-gray-600 mb-8 leading-relaxed">
              抱歉，您訪問的頁面不存在或已被移動。<br />
              請檢查網址是否正確，或回到首頁重新尋找。
            </p>

            {/* 行動按鈕 */}
            <div className="space-y-4">
              <Link 
                href="/"
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
                </svg>
                回到首頁
              </Link>
              
              <button 
                onClick={() => window.history.back()}
                className="inline-flex items-center justify-center w-full px-6 py-3 bg-gray-100 text-gray-700 font-medium rounded-lg hover:bg-gray-200 transition-colors duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.707 3.293a1 1 0 010 1.414L5.414 7H11a7 7 0 017 7v2a1 1 0 11-2 0v-2a5 5 0 00-5-5H5.414l2.293 2.293a1 1 0 11-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                返回上一頁
              </button>
            </div>

            {/* 額外資訊 */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                如果您認為這是一個錯誤，請聯繫網站管理員
              </p>
            </div>
          </div>

          {/* 額外連結 */}
          <div className="mt-6 text-center">
            <Link 
              href="/about"
              className="text-blue-600 hover:text-blue-800 text-sm underline"
            >
              關於本站
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}