// Production-safe Next.js configuration
// Use this file for production deployment to avoid webpack hash errors

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Basic configuration only
  compress: true,
  generateEtags: true,
  
  // Disable experimental features that might cause issues
  experimental: {},
  
  // Essential image optimization
  images: {
    formats: ['image/webp'],
    domains: ['ivod.ly.gov.tw', 'lyvod.ly.gov.tw'],
  },
  
  // Minimal headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
        ],
      },
    ];
  },
  
  // Essential rewrites
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
  
  // Minimal webpack configuration to avoid hash errors
  webpack: (config, { dev }) => {
    // Only apply development configurations
    if (dev) {
      // Development-only webpack modifications
      return config;
    }
    
    // For production, use default Next.js webpack configuration
    return config;
  },
  
  // Environment variables
  env: {
    SITE_NAME: 'IVOD 逐字稿檢索系統',
    SITE_DESCRIPTION: '台灣立法院 IVOD 逐字稿檢索與瀏覽系統',
  }
};

module.exports = nextConfig;