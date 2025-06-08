# CLAUDE.md - IVOD Transcript Web Application

This file provides specific guidance for Claude Code when working with the Next.js web application component.

## Application Overview

This is a Next.js TypeScript application that provides a web interface for searching and viewing Taiwan Legislative Yuan IVOD transcripts. The app connects to the same database used by the crawler and offers both basic and advanced search capabilities.

## Architecture & Key Files

### Core Application Structure

#### **🏗️ Refactored Architecture (2024-12)**

**Major Component Restructuring**:
- **Main Search Page**: `pages/index.tsx` - Reduced from 580 to 110 lines using modular components
- **Component Separation**: 
  - `components/SearchHeader.tsx` - Search interface and advanced search form (140 lines)
  - `components/SearchResults.tsx` - Results display and pagination logic (80 lines)  
  - `components/List.tsx` - IVOD list with XSS protection using DOMPurify
- **Custom Hook Architecture**: 
  - `hooks/useSearch.ts` - Three specialized hooks for search management:
    - `useSearchFilters`: URL parameter synchronization and filter state
    - `useSearchResults`: API calls with AbortController for cleanup
    - `useUrlSync`: Debounced URL updates to prevent excessive navigation

**API Middleware System**:
- **Unified Error Handling**: `lib/api-middleware.ts` - Standardized API responses
- **Type Safety**: Comprehensive TypeScript interfaces for all API endpoints
- **Request Validation**: Helper functions for parameter parsing and validation
- **Error Classification**: Proper HTTP status codes and error categorization

**Security Enhancements**:
- **XSS Protection**: DOMPurify integration with server-side fallback for HTML sanitization
- **Request Cancellation**: AbortController implementation to prevent memory leaks
- **Input Validation**: Server-side parameter validation with type checking

**Performance Optimizations**:
- **Component Separation**: Reduced re-render scope through focused component responsibilities
- **Hook Specialization**: Isolated state management prevents unnecessary effects
- **Request Cleanup**: Automatic cancellation of pending requests during navigation

**Database & Search**:
- **Multi-Backend Support**: `lib/prisma.ts` with `lib/database-env.ts` configuration
- **Search Integration**: `lib/elastic.ts` with database fallback
- **Advanced Parsing**: `lib/searchParser.ts` for complex query syntax
- **Search Highlighting**: `lib/searchHighlight.ts` for excerpt generation
- **Logging System**: `lib/logger.ts` with structured error tracking

#### **Key Refactoring Benefits**

**Code Quality Improvements**:
- **Reduced Complexity**: Main search page reduced from 580 to 110 lines
- **Single Responsibility**: Each component has focused, well-defined purpose
- **Type Safety**: Comprehensive TypeScript interfaces throughout API layer
- **Error Handling**: Unified error management with proper HTTP status codes

**Security Fixes**:
- **XSS Prevention**: Fixed dangerouslySetInnerHTML vulnerability with DOMPurify
- **SSL Configuration**: Fixed crawler SSL verification being globally disabled
- **Input Validation**: Server-side parameter validation with type checking

**Performance Enhancements**:
- **Memory Leak Prevention**: AbortController for request cancellation
- **Reduced Re-renders**: Component separation minimizes unnecessary updates
- **Debounced URL Updates**: Prevents excessive navigation events

**Maintainability**:
- **Modular Architecture**: Clear separation between UI, state, and API logic
- **Reusable Hooks**: Shared state management logic across components
- **Standardized APIs**: Consistent request/response patterns

### Key Features
1. **Advanced Search Capabilities**: 
   - Quoted phrase search ("exact phrase")
   - Boolean operators (AND/OR)
   - Parentheses grouping for complex queries
   - Field-specific searches (title:, speaker:, meeting:, committee:)
   - Exclusion syntax (-term, -"phrase")
   - Dual search modes: "All fields" and "Transcript only"
2. **Search Excerpts**: Context snippets with highlighted keywords in search results
3. **Advanced Filtering**: By meeting name, speaker, committee, date range
4. **Multi-Database Support**: SQLite/PostgreSQL/MySQL via dynamic Prisma schema
5. **Environment Separation**: Separate databases for development, production, and testing
6. **Responsive Design**: Mobile-first with Tailwind CSS
7. **SEO Optimization**: Meta tags, structured data, sitemap generation
8. **Comprehensive Logging**: Structured error logging with admin interface
9. **Error Boundary**: React error boundaries with automatic error reporting

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

The application supports three separate database environments to prevent data interference:

### Environment Detection
- **Testing**: `NODE_ENV=test` or `JEST_WORKER_ID` present → Uses test databases
- **Production**: `NODE_ENV=production` → Uses production databases
- **Development**: Default environment, or use `DB_ENV=production` to access production data in dev

### Required `.env` variables:
```bash
# Database Environment Control
# DB_ENV=production  # Set to use production database in development

# Database backend selection
DB_BACKEND=sqlite|postgresql|mysql

# === SQLite Settings (only if DB_BACKEND=sqlite) ===
# Production database (existing configuration, names unchanged)
SQLITE_PATH=../db/ivod_local.db

# Development database (for npm run dev)
DEV_SQLITE_PATH=../db/ivod_dev.db

# Testing database (for test execution)
TEST_SQLITE_PATH=../db/ivod_test.db

# === PostgreSQL Settings (only if DB_BACKEND=postgresql) ===
PG_HOST=localhost
PG_PORT=5432
PG_USER=ivod_user
PG_PASS=ivod_password

# Production database (existing configuration, names unchanged)
PG_DB=ivod_db

# Development database (for npm run dev)
PG_DEV_DB=ivod_dev_db

# Testing database (for test execution)
PG_TEST_DB=ivod_test_db

# === MySQL Settings (only if DB_BACKEND=mysql) ===
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=ivod_user
MYSQL_PASS=ivod_password

# Production database (existing configuration, names unchanged)
MYSQL_DB=ivod_db

# Development database (for npm run dev)
MYSQL_DEV_DB=ivod_dev_db

# Testing database (for test execution)
MYSQL_TEST_DB=ivod_test_db

# === Elasticsearch Settings ===
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http

# Production index (existing configuration, names unchanged)
ES_INDEX=ivod_transcripts

# Development index (for npm run dev)
ES_DEV_INDEX=ivod_dev_transcripts

# Testing index (for test execution)
ES_TEST_INDEX=ivod_test_transcripts

NEXT_PUBLIC_ES_INDEX=ivod_transcripts

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
All API routes use the unified middleware system (`lib/api-middleware.ts`):

**Standardized Response Format**:
```typescript
interface APIResponse<T> {
  data?: T;
  meta?: { total?: number; page?: number; pageSize?: number; };
  success: boolean;
  error?: string;
  fallback?: boolean;
}
```

**Error Handling**:
- Proper HTTP status codes (200, 400, 404, 500)
- Consistent error response format
- Structured error logging with request context
- Development vs production error message filtering

**Parameter Validation**:
- Type-safe parameter parsing (`parseStringParam`, `parseIntParam`)
- Required field validation
- HTTP method validation
- Input sanitization and validation

## Component Architecture

### **Refactored Component Structure (2024-12)**

#### **Search Page Components**
- **`components/SearchHeader.tsx`** - Search interface component (140 lines)
  - Main search input with placeholder management
  - Advanced search toggle and form fields
  - Search scope selector (all fields vs transcript only)
  - Clear filters functionality
- **`components/SearchResults.tsx`** - Results display component (80 lines)
  - Loading state management
  - Results count and pagination info
  - No results messaging
  - Error state handling

#### **Custom Hooks (`hooks/useSearch.ts`)**
- **`useSearchFilters`** - URL parameter synchronization
  - Manages search filters state from URL query parameters
  - Handles default values and parameter parsing
  - Synchronizes advanced search form inputs
- **`useSearchResults`** - API call management
  - Handles search API calls with AbortController
  - Manages loading states and error handling
  - Implements request cancellation on component unmount
- **`useUrlSync`** - URL state management
  - Debounced URL updates to prevent excessive navigation
  - Maintains browser history integrity
  - Handles query parameter serialization

#### **Layout Components**
- `Layout.tsx` - Main page wrapper with header/footer
- `Header.tsx` - Navigation header with mobile menu
- `Footer.tsx` - Site footer with links
- `Sidebar.tsx` - Mobile navigation drawer

#### **Core Feature Components**
- **`List.tsx`** - IVOD results display with XSS protection
  - DOMPurify integration for safe HTML rendering
  - Server-side HTML stripping fallback
  - Responsive card layout
- `SearchForm.tsx` - Legacy search form (being phased out)
- `Pagination.tsx` - Page navigation with proper accessibility
- `TranscriptViewer.tsx` - Expandable transcript display

#### **Utility Components**
- `Icon.tsx` - SVG icon system
- `ClientOnly.tsx` - Client-side rendering wrapper
- `StructuredData.tsx` - SEO structured data injection
- `ErrorBoundary.tsx` - React error boundary with automatic error reporting

## Search System Architecture

### CRITICAL: Complete Search Logic Documentation

The IVOD search system implements a sophisticated dual-layer search architecture that must adhere to specific behavioral requirements:

#### 1. **Non-Instant Search Behavior** 
**REQUIREMENT**: Search is NEVER triggered automatically. Only manual button press initiates search.

**Implementation**:
- Search input field updates `searchQuery` state only (no immediate search)
- Advanced form field changes update `advancedInput` state only (no immediate search)  
- Search is triggered ONLY by:
  - Clicking "搜尋" button → calls `handleSearch()`
  - Pressing Enter key → calls `handleSearch()`
- `handleSearch()` updates `filters` state → triggers `useEffect` → performs actual search

**Code Location**: `pages/index.tsx` lines 217-228, 230-234

#### 2. **Upper Search: Advanced Syntax Support**
**REQUIREMENT**: Main search bar supports complex query syntax for flexible searching.

**Supported Syntax**:
- **Quoted Phrases**: `"完整會議"` - exact phrase matching
- **Boolean Operators**: `預算 AND 教育`, `王委員 OR 李委員` - logical combinations
- **Grouping**: `(預算 OR 教育) AND 委員會` - parentheses for precedence
- **Field-Specific**: `title:"會議名稱"`, `speaker:"立委姓名"`, `meeting:"會議"`, `committee:"委員會"`
- **Exclusions**: `-詞彙`, `-"詞組"` - exclude specific content
- **Complex Mixed**: `(speaker:"王委員" OR speaker:"李委員") AND "預算" -"國防"`

**Search Modes**:
- **"搜尋全部欄位"**: Searches across title, meeting_name, speaker_name, committee_names, transcripts
- **"僅搜尋逐字稿"**: Searches only in ai_transcript and ly_transcript fields

**Search Excerpts**: 
- **Context Snippets**: Display ~50 characters before/after keyword matches with surrounding context
- **Keyword Highlighting**: Search terms highlighted in red using HTML `<mark>` tags
- **Transcript Priority**: Prioritizes `ly_transcript` over `ai_transcript` when both exist
- **Selective Display**: Only shows excerpts for transcript-based searches (when main search box has content)
- **XSS Protection**: Proper HTML escaping while preserving highlight markup

**Code Location**: `lib/searchParser.ts` (full advanced parsing), `lib/searchHighlight.ts` (excerpt extraction), `pages/api/search.ts` (implementation)

#### 3. **Lower Search: LIKE Fuzzy Matching**
**REQUIREMENT**: Advanced form fields use LIKE queries for partial matching across all database backends.

**Implementation Details**:
- **會議名稱**, **立委姓名**, **委員會** fields use LIKE `%pattern%` queries
- Automatically triggers Universal Search when any string field filter is present
- Works across SQLite, PostgreSQL, MySQL with database-specific optimizations
- Example: "社會福利" matches "社會福利及衛生環境委員會"

**Trigger Condition**:
```typescript
function shouldUseUniversalSearch(params) {
  const { meeting_name, speaker, committee } = params;
  return !!(meeting_name || speaker || committee);
}
```

**Code Location**: `lib/universal-search.ts`, `pages/api/ivods.ts` lines 45-53

#### 4. **Combined Operation**
**REQUIREMENT**: Upper and lower searches can work together or independently.

**Combined Logic**:
- **Together**: Upper search (q param) + Lower filters (speaker/committee/meeting_name) → Combined WHERE conditions
- **Upper Only**: Only q parameter → Standard field search or transcript-only search  
- **Lower Only**: Only advanced filters → LIKE fuzzy matching
- **Date Ranges**: Compatible with both upper and lower searches

**Search Flow**:
1. Check if transcript-only mode → Use `/api/search` then `/api/ivods` with IDs
2. Check if universal search needed → Use LIKE queries with partial matching
3. Otherwise → Use standard Prisma queries

**Code Location**: `pages/index.tsx` lines 154-211 (search flow), `pages/api/ivods.ts` (API logic)

#### 5. **Elasticsearch Priority with DB Fallback**
**REQUIREMENT**: Transcript searches prioritize Elasticsearch when available, fallback to database when not.

**ES Integration**:
- **Enabled Check**: `ENABLE_ELASTICSEARCH !== 'false'`
- **Primary**: Uses Elasticsearch with advanced query building for transcript searches
- **Fallback**: Automatically falls back to database with equivalent WHERE conditions
- **Graceful Degradation**: Logs failures and continues with database search
- **Advanced Syntax**: Full support for boolean logic, field searches, exclusions in both ES and DB

**Fallback Indicators**:
- `/api/search` returns `{ fallback: true }` when using database
- Logs ES failures for monitoring
- Maintains identical search behavior regardless of backend

**Code Location**: `pages/api/search.ts` lines 38-85 (ES logic), `lib/searchParser.ts` (query building)

#### 6. **Database Backend Compatibility**
**REQUIREMENT**: All search functions work correctly across SQLite, PostgreSQL, MySQL with backend-specific optimizations.

**Database-Specific Handling**:

**MySQL**:
- No `mode: 'insensitive'` support → Use base `contains`
- JSON fields use `string_contains` → Limited partial matching → Use Universal Search
- Committee fields → LIKE queries for proper partial matching

**PostgreSQL**:
- Array fields use `has` operator for committee_names
- Full case-insensitive support with `mode: 'insensitive'`
- JSON operations supported

**SQLite**:
- Basic `contains` queries only
- No case-insensitive mode
- String-based committee_names field

**Universal Search Benefits**:
- Provides consistent LIKE-based partial matching across all backends
- Bypasses MySQL JSON field limitations
- Maintains identical behavior regardless of database choice

**Code Location**: `lib/utils.ts` (createContainsCondition), `lib/universal-search.ts` (LIKE implementation)

### Search Implementation Components

#### Advanced Search Parser (`lib/searchParser.ts`)
Sophisticated parser supporting:
- Boolean logic with proper precedence
- Quoted phrase preservation
- Field-specific searches with syntax validation
- Exclusion syntax parsing
- Parentheses grouping support
- AST generation for complex queries

#### Elasticsearch Integration (`pages/api/search.ts`, `lib/elastic.ts`)
Dual search strategy:
- Primary: ES full-text search with advanced query building
- Fallback: Database search with equivalent conditions
- Connection failure handling and monitoring
- Result format consistency

#### Universal Search System (`lib/universal-search.ts`)  
LIKE-based search for partial matching:
- Raw SQL queries for maximum compatibility
- Parameter injection safety  
- Database-agnostic implementation
- Automatic triggering based on filter presence

#### URL State Management (`pages/index.tsx`)
Search state synchronized with URL:
- `q` - Main search query
- `scope` - Search mode (all/transcript)  
- `meeting_name`, `speaker`, `committee` - Advanced filters
- `date_from`, `date_to` - Date range filters
- `page`, `sort` - Pagination and sorting
- Debounced URL updates to prevent excessive navigation

### Testing and Validation

**Comprehensive Test Script**: `scripts/test-complete-search-logic.js`
- Validates non-instant search behavior
- Tests all advanced syntax patterns
- Verifies LIKE fuzzy matching
- Confirms combined search operations  
- Checks ES/DB fallback behavior
- Validates cross-database compatibility

**Search Behavior Verification**:
- Manual trigger requirement
- Syntax parsing accuracy
- Partial matching effectiveness
- Combined operation logic
- Fallback mechanism reliability
- Database-specific optimizations

## Testing Strategy

### **Post-Refactoring Testing Status (2024-12)**

#### **Test Updates Required**
The refactoring introduced component structure changes that require test updates:

**Component Test Updates Needed**:
- Main search page tests need updating for new component structure
- Tests currently fail due to title being moved to Head component
- Interface element testing now more appropriate than text content testing

**API Test Updates**:
- API tests need updating to match new middleware response format
- Error handling tests should validate new standardized error responses
- Parameter validation tests should use new helper functions

#### **Unit Tests (Jest + React Testing Library)**
- **Component Testing**: Focus on interface elements rather than internal DOM structure
- **API Route Testing**: Tests use new middleware with standardized responses
- **Hook Testing**: New custom hooks need comprehensive test coverage
- **Utility Function Testing**: XSS protection and security features testing

#### **Current Test Status**:
```bash
# Some tests currently failing due to refactoring
npm run test:ci  # Needs attention for component structure changes

# E2E tests likely still passing as they test user behavior
npm run cypress:run  # Should continue working
```

#### **Integration Tests**
- Search workflow testing (needs update for new component structure)
- Database switching scenarios
- Error handling validation with new middleware

#### **E2E Tests (Cypress)**
- Complete user journeys (should continue working)
- Cross-browser compatibility
- Mobile responsive behavior
- Search functionality validation

#### **Test Organization**
```
__tests__/
├── components/          # Component tests (needs updates)
├── pages/              # Page component tests (needs updates)
├── integration/        # Integration test suites
├── lib/               # Utility function tests + new hooks
├── *-api.test.ts      # API route tests (needs middleware updates)
└── hooks/              # New custom hooks testing
```

#### **Testing Priorities**
1. **High Priority**: Fix failing component tests due to structure changes
2. **Medium Priority**: Update API tests for new middleware format
3. **Low Priority**: Add comprehensive hook testing coverage

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