// 統一 Next.js 設定。
// 注意：security headers（X-Frame-Options 等）由 nginx 統一處理，
// 不在這裡設定，避免與 reverse proxy 雙重 header 衝突。
// 參考 /etc/nginx/sites-enabled/ivod-app
if (process.env.NODE_ENV === 'development') {
  require('dotenv').config();
  const { resolve } = require('path');

  const backend = process.env.DB_BACKEND;
  let databaseUrl = process.env.DATABASE_URL;

  if (backend && !databaseUrl) {
    if (backend === 'sqlite') {
      const sqlitePath = process.env.SQLITE_PATH || '../db/ivod_test.db';
      databaseUrl = `file://${resolve(sqlitePath)}`;
    } else if (backend === 'postgresql') {
      const { PG_USER, PG_PASS, PG_HOST, PG_PORT, PG_DB } = process.env;
      databaseUrl = `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
    } else if (backend === 'mysql') {
      const { MYSQL_USER, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT, MYSQL_DB } = process.env;
      databaseUrl = `mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`;
    }
  }

  if (backend === 'sqlite') {
    console.log(
      `使用資料庫: SQLite，檔案路徑: ${process.env.SQLITE_PATH || '../db/ivod_test.db'}`
    );
  } else if (backend) {
    console.log(`使用資料庫: ${backend}`);
  }
}

const isDev = process.env.NODE_ENV === 'development';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable compression
  compress: true,

  // Generate ETags
  generateEtags: true,

  experimental: {
    optimizeCss: false,
  },

  // Dev-only settings
  ...(isDev && {
    reactStrictMode: true,
    onDemandEntries: {
      maxInactiveAge: 25 * 1000,
      pagesBufferLength: 2,
    },
  }),

  // 圖片優化
  images: {
    formats: ['image/webp', 'image/avif'],
    domains: ['ivod.ly.gov.tw', 'lyvod.ly.gov.tw'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },

  // Cache headers only — security headers handled by nginx
  async headers() {
    return [
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=86400',
          },
        ],
      },
      {
        source: '/(.*\\.(?:js|css)$)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, immutable, max-age=31536000',
          },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: '/mcp',
        destination: '/api/mcp',
      },
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

  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer && process.env.DISABLE_ALL_HMR === 'true') {
      console.log('🚫 ALL HMR and Fast Refresh completely disabled - no auto-reload');

      config.plugins = config.plugins.filter(plugin => {
        const name = plugin.constructor.name;
        return (
          !name.includes('HotModuleReplacement') &&
          !name.includes('ReactRefresh') &&
          !name.includes('NextJsRequireCacheHotReloader') &&
          !name.includes('HotModuleReplacementPlugin') &&
          !name.includes('ReactRefreshPlugin')
        );
      });

      if (config.devServer) {
        config.devServer.hot = false;
        config.devServer.liveReload = false;
        config.devServer.client = {
          overlay: false,
          reconnect: false,
        };
      }

      config.mode = 'development';
      config.cache = false;
      config.optimization = {
        ...config.optimization,
        removeAvailableModules: false,
        removeEmptyChunks: false,
        splitChunks: false,
      };

      if (config.entry && typeof config.entry === 'object') {
        Object.keys(config.entry).forEach(key => {
          if (Array.isArray(config.entry[key])) {
            config.entry[key] = config.entry[key].filter(
              entry =>
                typeof entry !== 'string' ||
                (!entry.includes('webpack-hot-middleware') &&
                  !entry.includes('react-refresh') &&
                  !entry.includes('next/dist/client/dev/hot-dev-client') &&
                  !entry.includes('next/dist/client/dev/amp-dev'))
            );
          }
        });
      }
    } else if (dev && !isServer && process.env.DISABLE_FAST_REFRESH === 'true') {
      console.log('🚫 Fast Refresh disabled - errors will not trigger auto-reload');
      config.plugins = config.plugins.filter(plugin => {
        const name = plugin.constructor.name;
        return !name.includes('ReactRefresh');
      });
    } else if (dev && !isServer) {
      console.log('⚡ Fast Refresh enabled - normal auto-reload behavior');
    }

    return config;
  },

  env: {
    SITE_NAME: 'IVOD 逐字稿檢索系統',
    SITE_DESCRIPTION: '台灣立法院 IVOD 逐字稿檢索與瀏覽系統',
  },
};

module.exports = nextConfig;
