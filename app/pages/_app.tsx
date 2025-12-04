import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Link from 'next/link'
import Layout from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'
import GoogleAnalytics from '@/components/GoogleAnalytics'
import CookieConsent from 'react-cookie-consent'

interface CustomAppProps extends AppProps {
  pageProps: AppProps['pageProps'] & {
    gaId?: string
  }
}

export default function MyApp({ Component, pageProps }: CustomAppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable automatic retries to see errors immediately
        refetchOnWindowFocus: false, // Prevent automatic refetch on focus
      },
    },
  }))

  const [cookiesAccepted, setCookiesAccepted] = useState(false)

  useEffect(() => {
    // 檢查使用者是否已同意 cookies
    const consent = localStorage.getItem('CookieConsent')
    setCookiesAccepted(consent === 'true')
  }, [])

  const gaId = pageProps.gaId || process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {/* 只在使用者同意後才載入 Google Analytics */}
        {cookiesAccepted && gaId && <GoogleAnalytics measurementId={gaId} />}
        <Layout>
          <Component {...pageProps} />
        </Layout>

        {/* Cookie 同意橫幅 - 只在有設定 GA 時才顯示 */}
        {gaId && <CookieConsent
          location="bottom"
          buttonText="接受"
          declineButtonText="拒絕"
          enableDeclineButton
          onAccept={() => {
            setCookiesAccepted(true)
            if (typeof window !== 'undefined') {
              window.location.reload()
            }
          }}
          onDecline={() => {
            setCookiesAccepted(false)
          }}
          cookieName="CookieConsent"
          style={{
            background: '#2B373B',
            padding: '16px 24px',
            alignItems: 'center'
          }}
          buttonStyle={{
            background: '#f97316',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '6px',
            padding: '10px 24px',
            fontWeight: '500',
            border: 'none',
            cursor: 'pointer'
          }}
          declineButtonStyle={{
            background: 'transparent',
            color: '#fff',
            fontSize: '14px',
            borderRadius: '6px',
            padding: '10px 24px',
            fontWeight: '500',
            border: '1px solid #fff',
            cursor: 'pointer',
            marginRight: '12px'
          }}
          expires={365}
        >
          <span style={{ fontSize: '14px' }}>
            本網站使用 cookies 來改善使用體驗和分析網站流量。
            繼續使用本網站即表示您同意我們使用 cookies。
            <Link
              href="/privacy"
              style={{
                color: '#f97316',
                marginLeft: '8px',
                textDecoration: 'underline'
              }}
            >
              隱私政策
            </Link>
          </span>
        </CookieConsent>}
      </QueryClientProvider>
    </ErrorBoundary>
  )
}