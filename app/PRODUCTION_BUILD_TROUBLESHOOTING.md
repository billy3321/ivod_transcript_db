# Production Build Troubleshooting Guide

## Issue: `Cannot read properties of null (reading 'hash')`

This error typically occurs during Next.js production builds due to webpack optimization conflicts.

## Solutions (in order of recommendation):

### 1. Use Production-Safe Config
Replace `next.config.js` with `next.config.prod.js`:
```bash
cp next.config.prod.js next.config.js
npm run build
```

### 2. Clear All Caches
```bash
# Clear Next.js cache
rm -rf .next

# Clear npm cache
npm cache clean --force

# Clear node_modules cache
rm -rf node_modules/.cache

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### 3. Node.js Version Issues
The error is common with Node.js v18+ and certain webpack configurations.

**Recommended Node.js versions:**
- Node.js 16.14.0+ (LTS)
- Node.js 18.12.0+ (Current)
- Node.js 20.0.0+ (Latest)

**Check your Node.js version:**
```bash
node --version
npm --version
```

### 4. Memory Issues
If building in a memory-constrained environment:

```bash
# Increase Node.js memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
```

### 5. Environment Variables
Ensure all required environment variables are set:

```bash
# Required for production
DB_BACKEND=sqlite|postgresql|mysql
DATABASE_URL=your_database_url

# Optional but recommended
NODE_ENV=production
```

### 6. Dependency Issues
Check for conflicting dependencies:

```bash
# Check for duplicate dependencies
npm ls

# Update to latest compatible versions
npm update

# Or reinstall from scratch
rm -rf node_modules package-lock.json
npm install
```

### 7. Webpack Bundle Analysis
If the issue persists, analyze the bundle:

```bash
# Install bundle analyzer
npm install --save-dev @next/bundle-analyzer

# Add to package.json scripts:
"analyze": "ANALYZE=true npm run build"

# Run analysis
npm run analyze
```

### 8. Alternative Build Command
Try building with different flags:

```bash
# Build without type checking (faster)
npm run build -- --no-lint

# Build with debug info
DEBUG=* npm run build

# Build with specific optimization
NODE_ENV=production npm run build
```

## Production Deployment Checklist

1. ✅ Use `next.config.prod.js` for production
2. ✅ Clear all caches before building
3. ✅ Verify Node.js version compatibility
4. ✅ Set required environment variables
5. ✅ Check available memory (minimum 2GB recommended)
6. ✅ Ensure database connectivity
7. ✅ Test build locally first

## If All Else Fails

1. **Simplify next.config.js** - Remove all custom webpack configurations
2. **Use standard Next.js build** - Avoid custom optimizations
3. **Build locally and deploy .next folder** - Skip server-side building
4. **Use Docker** - Containerized builds often resolve environment issues

## Docker Build Example

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
CMD ["npm", "start"]
```

## Contact

If the issue persists, provide:
- Node.js version
- npm version
- Operating system
- Full error stack trace
- Environment variables (sanitized)