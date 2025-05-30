# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a dual-component system for scraping and serving Taiwan Legislative Yuan IVOD (Internet Video on Demand) transcripts:

1. **Crawler Component** (`crawler/`): Python-based scraper that extracts transcripts from IVOD service and stores them in relational databases (SQLite/PostgreSQL/MySQL) and Elasticsearch
2. **Web Application** (`app/`): Next.js React application providing search and browsing interface for transcripts

## Architecture

### Crawler Architecture (`crawler/`)
- **Core Module**: `ivod/core.py` - Database setup, ORM models, HTTP/scraping utilities
- **Task Workflows**: `ivod/tasks.py` - Main execution workflows (full/incremental/retry)
- **Entry Points**: `ivod_full.py`, `ivod_incremental.py`, `ivod_retry.py` - CLI wrappers
- **Database Models**: Single `IVODTranscript` model with status tracking for processing states
- **Multi-backend Support**: SQLite, PostgreSQL, MySQL via SQLAlchemy
- **Elasticsearch Integration**: Full-text search indexing with Chinese analysis support

### Web Application Architecture (`app/`)
- **Framework**: Next.js with TypeScript, API routes for backend logic
- **Database**: Prisma ORM with multi-backend support (SQLite/PostgreSQL/MySQL)
- **Search**: Elasticsearch integration with fallback to database search
- **UI Components**: Modular React components for list, search, pagination, transcript viewing
- **Styling**: Tailwind CSS v4 with responsive design and Chinese font support
- **Testing**: Jest + React Testing Library + Cypress E2E

## Development Commands

### Crawler Commands (`crawler/`)
```bash
# Setup environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install -r requirements-dev.txt  # For testing
cp .env.example .env                  # Configure DB_BACKEND and connection parameters
mkdir -p ../db                        # For shared SQLite database

# Data collection workflows
./ivod_full.py          # Full data capture (first run or reset)
./ivod_incremental.py   # Incremental update (daily)
./ivod_retry.py         # Retry failed records

# Elasticsearch indexing
./ivod_es.py            # Update search index

# Testing
pytest --cov=ivod --cov-report=term-missing
pytest -m integration  # Run integration tests only
TEST_SQLITE_PATH=../db/ivod_test.db python integration_test.py
```

### Web Application Commands (`app/`)
```bash
# Setup and development
npm install
cp .env.example .env  # Configure database and Elasticsearch
npm run prisma:prepare     # Update schema based on .env DB_BACKEND
npm run prisma:generate     # Generate Prisma client
npm run dev                 # Development server (localhost:3000)

# Production
npm run build              # Build for production
npm start                  # Start production server

# Testing
npm run test              # Jest unit tests (watch mode)
npm run test:ci           # Jest tests (CI mode)
npm run cypress:open      # Cypress E2E tests (interactive)
npm run cypress:run       # Cypress E2E tests (headless)

# Linting
npm run lint              # ESLint checks
```

## Key Implementation Details

### Database Schema
The system uses a single shared database with one main table:
- `IVODTranscript`: Stores transcript metadata, content, and processing status
- Status field tracks: 'success', 'failed', 'pending' for retry logic
- Retry count prevents infinite retry loops (MAX_RETRIES=5)

### Environment Configuration
Both components share similar `.env` configuration:
- `DB_BACKEND`: "sqlite", "postgresql", or "mysql" 
- Database connection parameters specific to chosen backend
- `SKIP_SSL`: Boolean for SSL verification bypass
- Elasticsearch settings (ES_HOST, ES_PORT, ES_INDEX, etc.)

### Data Flow
1. Crawler fetches IVOD data and stores in database with status tracking
2. Failed records can be retried via `ivod_retry.py`
3. Elasticsearch indexing runs separately via `ivod_es.py`
4. Web app reads from same database and searches via Elasticsearch (with DB fallback)

### Error Handling Patterns
- HTTP failures are caught and marked with status="failed"
- Empty/invalid content results in failed status for retry
- SSL issues can be bypassed with `skip_ssl=True`
- Database connection errors use SQLAlchemy's connection pooling

## Testing Strategy

### Crawler Testing
- Unit tests with pytest framework
- Integration tests marked with `@pytest.mark.integration`
- Mock HTTP responses with requests-mock
- In-memory SQLite for database testing
- Coverage reporting included

### Web Application Testing
- Jest + React Testing Library for component tests
- Cypress for E2E testing of user workflows
- API route testing with mocked dependencies
- Tests located in `__tests__/` and `cypress/integration/`

## Production Deployment Notes

### Crawler Production
- Deployed on Ubuntu with dedicated user account
- Cron scheduling: incremental daily at 02:00, retry at 03:00, full monthly
- Logs stored in `logs/` directory
- Python virtual environment isolation

### Web Application Production
- Next.js production build with `npm run build`
- Can be deployed to Vercel, Docker, or Ubuntu+nginx+systemd
- Prisma generates client based on `DB_BACKEND` environment variable
- Static asset optimization included

## Common Development Issues

### Database Backend Switching
- Update `.env` DB_BACKEND setting
- Run `npm run prisma:prepare` to update schema provider
- Regenerate Prisma client with `npm run prisma:generate`

### SSL/HTTPS Issues
- Set `SKIP_SSL=True` in `.env` if encountering certificate problems
- Crawler includes `openssl.cnf` for SSL configuration

### Date Range Configuration
- Full capture start date is configurable in `ivod/tasks.py` `run_full()`
- Incremental updates cover last 2 weeks by default

### Elasticsearch Setup
- Install Chinese analysis plugins: `analysis-ik` or `analysis-smartcn`
- Index configuration handled automatically by `ivod_es.py`
- Web app falls back to database search if Elasticsearch unavailable