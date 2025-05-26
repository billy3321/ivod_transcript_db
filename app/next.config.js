if (process.env.NODE_ENV === 'development') {
  const backend = process.env.DB_BACKEND;
  if (backend === 'sqlite') {
    console.log(
      `使用資料庫: SQLite，檔案路徑: ${process.env.SQLITE_PATH || process.env.DATABASE_URL}`
    );
  } else if (backend) {
    console.log(
      `使用資料庫: ${backend}，連線 URL: ${process.env.DATABASE_URL}`
    );
  } else if (process.env.DATABASE_URL) {
    console.log(
      `使用資料庫連線字串: ${process.env.DATABASE_URL}`
    );
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression for better performance
  compress: true,
  
  // Generate ETags for better caching
  generateEtags: true,
  
  // Reduce Fast Refresh frequency to prevent constant reloading
  experimental: {
    optimizeCss: false,
  },
  
  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    onDemandEntries: {
      // Period (in ms) where the server will keep pages in the buffer
      maxInactiveAge: 25 * 1000,
      // Number of pages that should be kept simultaneously without being disposed
      pagesBufferLength: 2,
    }
  }),
  
  // Optimize images
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['ivod.ly.gov.tw', 'lyvod.ly.gov.tw'], // IVOD image domains
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Security headers for better SEO and security
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'origin-when-cross-origin'
          },
        ],
      },
      {
        // Cache static assets for better performance
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=86400'
          }
        ]
      },
      {
        source: '/(.*\\.(?:js|css)$)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000'
          }
        ]
      }
    ];
  },
  
  // Rewrites for SEO-friendly URLs
  async rewrites() {
    return [
      {
        source: '/立委/:speaker',
        destination: '/?speaker=:speaker',
      },
      {
        source: '/委員會/:committee',
        destination: '/?committee=:committee',
      },
      {
        source: '/會議/:meeting',
        destination: '/?meeting_name=:meeting',
      },
    ];
  },
  
  // PWA support (optional future enhancement)
  // experimental: {
  //   // Add experimental features here as needed
  // },
  
  // Webpack optimization for smaller bundles
  webpack: (config, { dev, isServer }) => {
    // Optimize bundle size in production
    if (!dev && !isServer) {
      config.optimization.splitChunks.cacheGroups = {
        ...config.optimization.splitChunks.cacheGroups,
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          chunks: 'all',
          name: 'vendor',
          priority: 20,
          enforce: true,
        },
      };
    }
    
    return config;
  },
  
  // Environment variables for SEO
  env: {
    SITE_NAME: 'IVOD 逐字稿檢索系統',
    SITE_DESCRIPTION: '台灣立法院 IVOD 逐字稿檢索與瀏覽系統',
  }
};

module.exports = nextConfig;