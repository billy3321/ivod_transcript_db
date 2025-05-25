import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="zh-TW">
      <Head>
        <meta charSet="utf-8" />
        
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/site.webmanifest" />
        
        {/* Chinese content declarations */}
        <meta httpEquiv="Content-Language" content="zh-TW" />
        <meta name="language" content="Chinese Traditional" />
        
        {/* Theme color */}
        <meta name="theme-color" content="#4F46E5" />
        
        {/* Preconnect to external domains for performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        
        {/* SEO meta tags */}
        <meta name="author" content="billy3321、Yutin" />
        <meta name="publisher" content="g0v 零時政府" />
        <meta name="robots" content="index, follow" />
        <meta name="googlebot" content="index, follow" />
        
        {/* Open Graph defaults */}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="IVOD 逐字稿檢索系統" />
        <meta property="og:locale" content="zh_TW" />
        
        {/* Twitter Card defaults */}
        <meta name="twitter:card" content="summary_large_image" />
        
        {/* Dublin Core metadata for government content */}
        <meta name="DC.coverage" content="Taiwan" />
        <meta name="DC.creator" content="立法院" />
        <meta name="DC.publisher" content="g0v 零時政府" />
        <meta name="DC.type" content="InteractiveResource" />
        <meta name="DC.format" content="text/html" />
        <meta name="DC.language" content="zh-TW" />
        <meta name="DC.rights" content="MIT License" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}