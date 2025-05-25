import Layout from '../components/Layout';

export default function About() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow-sm p-8">
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
      </div>
    </Layout>
  );
}