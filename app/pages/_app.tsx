import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'
import GoogleAnalytics from '@/components/GoogleAnalytics'

export default function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable automatic retries to see errors immediately
        refetchOnWindowFocus: false, // Prevent automatic refetch on focus
      },
    },
  }))

  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        {gaId && <GoogleAnalytics measurementId={gaId} />}
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}