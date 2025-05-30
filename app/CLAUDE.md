# CLAUDE.md - IVOD Transcript Web Application

This file provides specific guidance for Claude Code when working with the Next.js web application component.

## Application Overview

This is a Next.js TypeScript application that provides a web interface for searching and viewing Taiwan Legislative Yuan IVOD transcripts. The app connects to the same database used by the crawler and offers both basic and advanced search capabilities.

## Architecture & Key Files

### Core Application Structure
- **Entry Points**: `pages/_app.tsx` (app wrapper), `pages/_document.tsx` (HTML document)
- **Main Pages**: `pages/index.tsx` (search interface), `pages/ivod/[id].tsx` (detail view)
- **API Layer**: `pages/api/` - RESTful endpoints for data access
- **Components**: `components/` - Modular React components with error handling
- **Database**: `lib/prisma.ts` - Database client with multi-backend support
- **Search**: `lib/elastic.ts` - Elasticsearch integration with DB fallback
- **Search Parser**: `lib/searchParser.ts` - Advanced query parsing with boolean logic
- **Logging**: `lib/logger.ts` - Structured logging system with file rotation
- **Error Handling**: `lib/useErrorHandler.ts` - React hook for error management

### Key Features
1. **Advanced Search Capabilities**: 
   - Quoted phrase search ("exact phrase")
   - Boolean operators (AND/OR)
   - Parentheses grouping for complex queries
   - Field-specific searches (title:, speaker:, meeting:, committee:)
   - Exclusion syntax (-term, -"phrase")
   - Dual search modes: "All fields" and "Transcript only"
2. **Advanced Filtering**: By meeting name, speaker, committee, date range
3. **Multi-Database Support**: SQLite/PostgreSQL/MySQL via dynamic Prisma schema
4. **Responsive Design**: Mobile-first with Tailwind CSS
5. **SEO Optimization**: Meta tags, structured data, sitemap generation
6. **Comprehensive Logging**: Structured error logging with admin interface
7. **Error Boundary**: React error boundaries with automatic error reporting

## Development Commands

```bash
# Setup and development
npm install
cp .env.example .env
npm run prisma:prepare     # Update schema for current DB_BACKEND
npm run prisma:generate    # Generate Prisma client
npm run dev               # Development server (localhost:3000)

# Production build
npm run build
npm start

# Testing
npm run test              # Jest unit tests (watch mode)
npm run test:ci           # Jest tests (CI mode)
npm run cypress:open      # Cypress E2E tests (interactive)
npm run cypress:run       # Cypress E2E tests (headless)

# Linting and quality
npm run lint              # ESLint checks
```

## Environment Configuration

Required `.env` variables:
```bash
# Database backend selection
DB_BACKEND=sqlite|postgresql|mysql

# Database connections (choose based on DB_BACKEND)
SQLITE_PATH=../db/ivod_local.db
# PG_HOST=localhost PG_PORT=5432 PG_DB=ivod_db PG_USER=... PG_PASS=...
# MYSQL_HOST=localhost MYSQL_PORT=3306 MYSQL_DB=ivod_db MYSQL_USER=... MYSQL_PASS=...

# Elasticsearch (optional)
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http
ES_INDEX=ivod_transcripts
NEXT_PUBLIC_ES_INDEX=ivod_transcripts

# Testing
TEST_SQLITE_PATH=../db/ivod_test.db

# Logging configuration
LOG_LEVEL=info
LOG_PATH=logs
ADMIN_TOKEN=your_secure_admin_token_here
```

## Database Backend Switching

The app supports dynamic database backend switching:

1. **Update Environment**: Change `DB_BACKEND` in `.env`
2. **Update Schema**: Run `npm run prisma:prepare` to update `prisma/schema.prisma`
3. **Generate Client**: Run `npm run prisma:generate` to regenerate Prisma client
4. **Restart App**: Development server will pick up new configuration

The `scripts/updatePrismaSchema.js` automatically handles provider-specific field types and connection strings.

## API Routes

### Search & Data Access
- `GET /api/search` - Advanced search with quotes, boolean operators, field searches, and exclusions (Elasticsearch/DB fallback)
- `GET /api/ivods` - List/filter IVODs with pagination and sorting
- `GET /api/ivods/[id]` - Get specific IVOD details and transcript
- `GET /api/health` - Application health check
- `GET /api/database-status` - Database connectivity status

### Logging & Administration
- `POST /api/logs` - Client-side error logging endpoint
- `GET /api/admin/logs` - List log files (requires admin token)
- `GET /api/admin/logs?file=filename` - View specific log file content
- `DELETE /api/admin/logs` - Delete log files (requires admin token)

### Request/Response Patterns
All API routes follow consistent patterns:
- Proper HTTP status codes (200, 400, 404, 500)
- JSON response format with error handling
- Query parameter validation
- Pagination support where applicable

## Component Architecture

### Layout Components
- `Layout.tsx` - Main page wrapper with header/footer
- `Header.tsx` - Navigation header with mobile menu
- `Footer.tsx` - Site footer with links
- `Sidebar.tsx` - Mobile navigation drawer

### Feature Components
- `SearchForm.tsx` - Advanced search interface with syntax help and URL state sync
- `List.tsx` - IVOD results display with responsive cards
- `Pagination.tsx` - Page navigation with proper accessibility
- `TranscriptViewer.tsx` - Expandable transcript display

### Utility Components
- `Icon.tsx` - SVG icon system
- `ClientOnly.tsx` - Client-side rendering wrapper
- `StructuredData.tsx` - SEO structured data injection

## Search Implementation

### Advanced Search Parser
The app includes a sophisticated search parser (`lib/searchParser.ts`) that supports:
- **Quoted Phrases**: `"exact phrase"` for precise matching
- **Boolean Logic**: `term1 AND term2`, `term1 OR term2` with proper precedence
- **Grouping**: `(term1 OR term2) AND term3` for complex queries
- **Field Searches**: `title:"meeting name"`, `speaker:"legislator name"`
- **Exclusions**: `-term` or `-"excluded phrase"` to filter out content
- **Mixed Queries**: Complex combinations like `(speaker:"王委員" OR speaker:"李委員") AND "預算" -"國防"`

### Elasticsearch Integration
The app uses a dual search strategy:
1. **Primary**: Elasticsearch full-text search with advanced query building
2. **Fallback**: Database LIKE queries when ES unavailable

Search logic in `lib/searchParser.ts`, `lib/elastic.ts` and `pages/api/search.ts` handles:
- Advanced query parsing and AST generation
- Elasticsearch query building with boolean logic
- Database fallback with equivalent SQL queries
- Connection failure graceful degradation
- Result formatting consistency
- Error logging and monitoring

### URL State Management
Search state is synchronized with URL parameters:
- `q` - Search query
- `mode` - Search mode (all/transcript)
- `meeting` - Meeting name filter
- `speaker` - Speaker filter
- `committee` - Committee filter
- `page` - Current page number
- `sort` - Sort order

## Testing Strategy

### Unit Tests (Jest + React Testing Library)
- Component behavior testing
- API route testing with mocked dependencies
- Utility function testing
- Database fallback logic testing

### Integration Tests
- Search workflow testing
- Database switching scenarios
- Error handling validation

### E2E Tests (Cypress)
- Complete user journeys
- Cross-browser compatibility
- Mobile responsive behavior
- Search functionality validation

### Test Organization
```
__tests__/
├── components/          # Component tests
├── pages/              # Page component tests
├── integration/        # Integration test suites
├── lib/               # Utility function tests
├── *-api.test.ts      # API route tests
```

## Performance Optimization

### Next.js Optimizations
- Automatic code splitting
- Image optimization with next/image
- Static generation where possible
- Bundle analysis with webpack-bundle-analyzer

### Database Performance
- Efficient Prisma queries with proper indexing
- Pagination to limit result sets
- Connection pooling for production
- Query optimization for search operations

### Caching Strategy
- Static asset caching via Next.js
- API response caching headers
- Elasticsearch query caching
- Browser-side state persistence

## Production Deployment

### Build Process
1. Environment variable validation
2. Prisma client generation for target database
3. Next.js production build with optimizations
4. Static asset optimization and compression

### Deployment Options
- **Vercel**: Native Next.js deployment platform
- **Docker**: Containerized deployment with multi-stage builds
- **Ubuntu/PM2**: Traditional server deployment with process management
- **Kubernetes**: Scalable container orchestration

### Monitoring & Health Checks
- `/api/health` endpoint for application status
- Database connectivity monitoring
- Elasticsearch availability checking
- Performance metrics collection

## Common Development Patterns

### Error Handling
```typescript
// API route error handling
try {
  const result = await prisma.ivod.findMany();
  res.status(200).json(result);
} catch (error) {
  console.error('Database error:', error);
  res.status(500).json({ error: 'Internal server error' });
}
```

### Database Query Patterns
```typescript
// Multi-backend compatible queries
const whereClause = DB_BACKEND === 'sqlite' 
  ? { transcript: { contains: query, mode: 'insensitive' } }
  : { transcript: { search: query } };
```

### Component State Management
```typescript
// URL-synchronized search state
const [searchParams, setSearchParams] = useSearchParams();
const query = searchParams.get('q') || '';
```

## Troubleshooting

### Common Issues
1. **Database Connection**: Check `.env` configuration and service status
2. **Prisma Client**: Regenerate after schema changes or backend switches
3. **Elasticsearch**: App will fallback to database search if ES unavailable
4. **Build Errors**: Ensure all dependencies installed and TypeScript types correct

### Debug Commands
```bash
# Check database connectivity
npm run prisma:studio

# Validate environment configuration
node -e "console.log(process.env.DB_BACKEND)"

# Test API endpoints
curl http://localhost:3000/api/health

# Analyze bundle size
npm run analyze
```

### Log Analysis
- Development: Console logs and Next.js dev server output
- Production: PM2 logs, systemd journald, or container logs
- Error tracking: Integrate with services like Sentry for production

## Security Considerations

### Input Validation
- All user inputs sanitized and validated
- SQL injection prevention via Prisma ORM
- XSS protection through React's built-in escaping
- CSRF protection via SameSite cookies

### Environment Security
- Sensitive config in `.env` (not committed)
- Production secrets via secure environment injection
- Database credentials properly isolated
- HTTPS enforcement in production
- Admin token protection for log management interface

## Logging System

### Overview
The application includes a comprehensive logging system for error tracking, debugging, and monitoring:

### Key Components
- **Logger Class** (`lib/logger.ts`): Structured logging with file rotation
- **Error Handler Hook** (`lib/useErrorHandler.ts`): React hook for error management
- **Error Boundary** (`components/ErrorBoundary.tsx`): Catches unhandled React errors
- **Admin Interface** (`pages/admin/logs.tsx`): Web-based log management

### Usage Patterns

#### Server-side Logging
```typescript
import { logger } from '@/lib/logger';

// API route logging
logger.logApiRequest(req, { searchQuery: query });
logger.logApiError(error, req, { endpoint: 'search' });
logger.logDatabaseError(error, 'findMany', { table: 'ivods' });
```

#### Client-side Error Handling
```typescript
import { useErrorHandler } from '@/lib/useErrorHandler';

function MyComponent() {
  const { handleError, handleAsyncError, wrapEventHandler } = useErrorHandler({
    component: 'MyComponent'
  });

  const handleClick = wrapEventHandler(() => {
    // Automatically logs errors
    performAction();
  });

  const fetchData = async () => {
    const result = await handleAsyncError(async () => {
      return fetch('/api/data');
    });
  };
}
```

### Log Management
- **Development**: Logs to console and file
- **Production**: File-based logging with rotation
- **Admin Access**: `/admin/logs` with token authentication
- **File Rotation**: Automatic rotation when files exceed 10MB
- **Cleanup**: Keeps only 5 most recent log files

### Log Levels
- `error`: Critical errors requiring attention
- `warn`: Warning conditions
- `info`: General information messages
- `debug`: Detailed debugging information

This guidance should help Claude Code efficiently navigate and modify the web application component while maintaining code quality and following established patterns.