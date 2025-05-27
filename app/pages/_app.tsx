import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Layout from '@/components/Layout'
import ErrorBoundary from '@/components/ErrorBoundary'

export default function MyApp({ Component, pageProps }: AppProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: false, // Disable automatic retries to see errors immediately
        refetchOnWindowFocus: false, // Prevent automatic refetch on focus
      },
    },
  }))
  
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <Layout>
          <Component {...pageProps} />
        </Layout>
      </QueryClientProvider>
    </ErrorBoundary>
  )
}