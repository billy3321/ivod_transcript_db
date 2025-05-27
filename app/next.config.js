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
  
  // Development-specific settings to help with debugging
  experimental: {
    optimizeCss: false,
  },
  
  // Development configuration
  ...(process.env.NODE_ENV === 'development' && {
    // Enable strict mode but disable Fast Refresh auto-reload
    reactStrictMode: true,
    
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
  
  // Webpack optimization and development debugging
  webpack: (config, { dev, isServer }) => {
    // Development: Conditionally disable Fast Refresh to prevent auto-reload on errors
    if (dev && !isServer && process.env.DISABLE_ALL_HMR === 'true') {
      console.log('🚫 ALL HMR and Fast Refresh completely disabled - no auto-reload')
      
      // Completely remove all HMR and Fast Refresh plugins
      config.plugins = config.plugins.filter((plugin) => {
        const name = plugin.constructor.name
        return !name.includes('HotModuleReplacement') &&
               !name.includes('ReactRefresh') &&
               !name.includes('NextJsRequireCacheHotReloader') &&
               !name.includes('HotModuleReplacementPlugin') &&
               !name.includes('ReactRefreshPlugin')
      })
      
      // Disable webpack-dev-server hot reloading completely
      if (config.devServer) {
        config.devServer.hot = false
        config.devServer.liveReload = false
        config.devServer.client = {
          overlay: false,
          reconnect: false,
        }
      }
      
      // Disable caching and optimization for debugging
      config.mode = 'development'
      config.cache = false
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      }
      
      // Remove any HMR related entries from webpack entry points
      if (config.entry && typeof config.entry === 'object') {
        Object.keys(config.entry).forEach(key => {
          if (Array.isArray(config.entry[key])) {
            config.entry[key] = config.entry[key].filter(entry => 
              typeof entry !== 'string' || (
                !entry.includes('webpack-hot-middleware') &&
                !entry.includes('react-refresh') &&
                !entry.includes('next/dist/client/dev/hot-dev-client') &&
                !entry.includes('next/dist/client/dev/amp-dev')
              )
            )
          }
        })
      }
      
    } else if (dev && !isServer && process.env.DISABLE_FAST_REFRESH === 'true') {
      console.log('🚫 Fast Refresh disabled - errors will not trigger auto-reload')
      
      // Partially disable Fast Refresh but keep some HMR for CSS
      config.plugins = config.plugins.filter((plugin) => {
        const name = plugin.constructor.name
        return !name.includes('ReactRefresh')
      })
      
    } else if (dev && !isServer) {
      console.log('⚡ Fast Refresh enabled - normal auto-reload behavior')
    }
    
    // Production: Optimize bundle size
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