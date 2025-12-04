import Head from 'next/head'
import { useRouter } from 'next/router'

export default function Privacy() {
  const router = useRouter()

  return (
    <>
      <Head>
        <title>隱私政策 - 立法院 IVOD 逐字稿檢索系統</title>
        <meta name="description" content="立法院 IVOD 逐字稿檢索系統的隱私政策與資料使用說明" />
      </Head>

      <div className="max-w-4xl mx-auto px-4 py-8">
        <button
          onClick={() => router.back()}
          className="mb-6 text-orange-600 hover:text-orange-700 flex items-center gap-2"
        >
          ← 返回
        </button>

        <h1 className="text-3xl font-bold mb-8">隱私政策</h1>

        <div className="prose prose-lg max-w-none space-y-6">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. 關於本隱私政策</h2>
            <p className="text-gray-700 leading-relaxed">
              本隱私政策說明立法院 IVOD 逐字稿檢索系統（以下簡稱「本網站」）如何收集、使用和保護您的個人資料。
              我們重視您的隱私權，並致力於保護您的個人資料。
            </p>
            <p className="text-gray-700 leading-relaxed mt-2">
              最後更新日期：{new Date().toLocaleDateString('zh-TW')}
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. 我們收集哪些資料</h2>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.1 自動收集的資料</h3>
            <p className="text-gray-700 leading-relaxed">
              當您使用本網站時，我們會透過 Google Analytics 自動收集以下資訊：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>瀏覽器類型和版本</li>
              <li>作業系統</li>
              <li>您訪問的頁面及使用時間</li>
              <li>IP 位址（經過匿名化處理）</li>
              <li>點擊行為和互動方式</li>
            </ul>

            <h3 className="text-xl font-semibold mb-3 mt-4">2.2 我們不收集的資料</h3>
            <p className="text-gray-700 leading-relaxed">
              本網站不要求使用者註冊或登入，因此我們不會收集：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>姓名、電子郵件或電話號碼</li>
              <li>帳號密碼</li>
              <li>信用卡或付款資訊</li>
              <li>任何可直接識別個人身份的資訊</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. 如何使用這些資料</h2>
            <p className="text-gray-700 leading-relaxed">
              我們收集的資料僅用於以下目的：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>分析網站流量和使用模式</li>
              <li>改善網站功能和使用者體驗</li>
              <li>了解哪些內容最受使用者歡迎</li>
              <li>診斷和修復技術問題</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Cookies 的使用</h2>

            <h3 className="text-xl font-semibold mb-3 mt-4">4.1 什麼是 Cookies</h3>
            <p className="text-gray-700 leading-relaxed">
              Cookies 是儲存在您瀏覽器中的小型文字檔案，用於記錄您的偏好設定和使用行為。
            </p>

            <h3 className="text-xl font-semibold mb-3 mt-4">4.2 我們使用的 Cookies</h3>
            <div className="overflow-x-auto mt-3">
              <table className="min-w-full border border-gray-300">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="border border-gray-300 px-4 py-2 text-left">Cookie 名稱</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">用途</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">有效期限</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">CookieConsent</td>
                    <td className="border border-gray-300 px-4 py-2">記錄您的 Cookie 同意選擇</td>
                    <td className="border border-gray-300 px-4 py-2">365 天</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">_ga, _ga_*</td>
                    <td className="border border-gray-300 px-4 py-2">Google Analytics 分析用途</td>
                    <td className="border border-gray-300 px-4 py-2">2 年</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 className="text-xl font-semibold mb-3 mt-4">4.3 如何管理 Cookies</h3>
            <p className="text-gray-700 leading-relaxed">
              您可以透過以下方式管理 Cookies：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>在首次訪問時選擇「拒絕」Cookie 橫幅</li>
              <li>清除瀏覽器中的 Cookies（這將移除您的偏好設定）</li>
              <li>設定瀏覽器阻擋所有 Cookies（可能影響網站功能）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. 第三方服務</h2>

            <h3 className="text-xl font-semibold mb-3 mt-4">5.1 Google Analytics</h3>
            <p className="text-gray-700 leading-relaxed">
              本網站使用 Google Analytics 進行流量分析。Google Analytics 會收集匿名化的使用資料，
              並受 Google 隱私政策約束。您可以：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>
                閱讀{' '}
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 underline"
                >
                  Google 隱私政策
                </a>
              </li>
              <li>
                安裝{' '}
                <a
                  href="https://tools.google.com/dlpage/gaoptout"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 underline"
                >
                  Google Analytics 退出擴充功能
                </a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. 資料安全</h2>
            <p className="text-gray-700 leading-relaxed">
              我們採取適當的技術和組織措施來保護您的資料：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>使用 HTTPS 加密傳輸</li>
              <li>IP 位址匿名化處理</li>
              <li>不儲存個人識別資訊</li>
              <li>定期更新安全措施</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. 您的權利</h2>
            <p className="text-gray-700 leading-relaxed">
              根據個人資料保護法和 GDPR，您擁有以下權利：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li><strong>拒絕權：</strong>您可以選擇不接受 Cookies</li>
              <li><strong>刪除權：</strong>您可以清除瀏覽器中的 Cookies</li>
              <li><strong>知情權：</strong>本隱私政策說明我們如何使用資料</li>
              <li><strong>反對權：</strong>您可以停止使用本網站以避免資料收集</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. 兒童隱私</h2>
            <p className="text-gray-700 leading-relaxed">
              本網站不針對 13 歲以下兒童，我們不會故意收集兒童的個人資料。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. 隱私政策變更</h2>
            <p className="text-gray-700 leading-relaxed">
              我們可能會不時更新本隱私政策。重大變更時，我們會在網站上公告。
              建議您定期檢視本頁面以了解最新資訊。
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. 聯絡我們</h2>
            <p className="text-gray-700 leading-relaxed">
              如果您對本隱私政策有任何疑問或建議，歡迎透過以下方式聯絡我們：
            </p>
            <ul className="list-disc pl-6 text-gray-700 space-y-2 mt-2">
              <li>
                GitHub Issues:{' '}
                <a
                  href="https://github.com/your-repo/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-orange-600 hover:text-orange-700 underline"
                >
                  提交問題
                </a>
              </li>
            </ul>
          </section>

          <section className="bg-gray-50 p-6 rounded-lg mt-8">
            <h2 className="text-xl font-semibold mb-3">簡而言之</h2>
            <p className="text-gray-700 leading-relaxed">
              ✓ 我們只使用 Google Analytics 進行匿名流量分析<br />
              ✓ 不收集任何個人識別資訊<br />
              ✓ 您可以隨時拒絕 Cookies<br />
              ✓ 您的隱私受到充分保護
            </p>
          </section>
        </div>
      </div>
    </>
  )
}
