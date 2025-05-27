#!/usr/bin/env node

// Custom Next.js dev server without HMR
const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = process.env.HOST || 'localhost'
const port = parseInt(process.env.PORT, 10) || 3000

console.log('🚫 Starting Next.js dev server WITHOUT Hot Module Replacement')
console.log('📍 Errors will NOT trigger automatic reload')
console.log('🔧 Perfect for debugging - errors will stay visible')

const app = next({ 
  dev,
  // Disable all HMR and Fast Refresh
  conf: {
    webpack: (config, { dev, isServer }) => {
      if (dev && !isServer) {
        // Remove all HMR related plugins
        config.plugins = config.plugins.filter((plugin) => {
          const name = plugin.constructor.name
          return !name.includes('HotModuleReplacement') &&
                 !name.includes('ReactRefresh') &&
                 !name.includes('NextJsRequireCacheHotReloader')
        })
        
        // Disable webpack dev server features
        if (config.devServer) {
          config.devServer.hot = false
          config.devServer.liveReload = false
        }
        
        // Remove HMR entries
        if (config.entry && typeof config.entry === 'object') {
          Object.keys(config.entry).forEach(key => {
            if (Array.isArray(config.entry[key])) {
              config.entry[key] = config.entry[key].filter(entry => 
                typeof entry !== 'string' || (
                  !entry.includes('webpack-hot-middleware') &&
                  !entry.includes('react-refresh') &&
                  !entry.includes('next/dist/client/dev')
                )
              )
            }
          })
        }
      }
      
      return config
    },
    
    // Disable experimental features that might cause reloads
    experimental: {
      optimizeCss: false,
    },
    
    // Disable compression and ETags for debugging
    compress: false,
    generateEtags: false,
    
    // Development configuration
    reactStrictMode: false,
  }
})

const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })
  .once('error', (err) => {
    console.error(err)
    process.exit(1)
  })
  .listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`)
    console.log('')
    console.log('🎯 No HMR mode active:')
    console.log('  • Errors will NOT auto-reload the page')
    console.log('  • Perfect for debugging problems')
    console.log('  • Manually refresh after fixing issues')
    console.log('')
  })
})