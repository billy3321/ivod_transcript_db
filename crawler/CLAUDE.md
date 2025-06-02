# CLAUDE.md - IVOD Transcript Crawler

This file provides specific guidance for Claude Code when working with the Python crawler component.

## Project Overview

This is a Python-based web scraper that extracts transcripts from Taiwan's Legislative Yuan IVOD service and stores them in relational databases. The system provides three main workflows: full data capture, incremental updates, and retry mechanisms for failed records, plus Elasticsearch indexing for full-text search.

## Architecture & Key Files

### Modular Python Package (`ivod/`)
- **`core.py`** - Central processing module for assembling IVOD records from scraped data
- **`crawler.py`** - HTTP scraping utilities with mechanize browser, SSL handling, and data fetching
- **`db.py`** - Database abstraction supporting SQLite/PostgreSQL/MySQL with SQLAlchemy ORM
- **`database_env.py`** - Environment-specific database configuration (development/production/testing)
- **`tasks.py`** - Main workflow orchestration (full/incremental/retry/elasticsearch indexing)

### Main Execution Scripts
- **`ivod_full.py`** - Full data capture from 2024-02-01 to present
- **`ivod_incremental.py`** - Incremental updates for past 2 weeks
- **`ivod_retry.py`** - Retry failed AI/LY transcript extractions (max 5 retries)
- **`ivod_fix.py`** - Fix script for error recovery with batch and single-ID modes
- **`ivod_es.py`** - Elasticsearch indexing with Chinese analysis support

### Testing Infrastructure
- **`integration_test.py`** - Real API integration testing with database reset
- **`tests/`** - Comprehensive test suite with unit and integration tests
- **`test.py`** - SSL connection testing utility

## Development Environment Setup

```bash
# Setup virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Install development dependencies for testing
pip install -r requirements-dev.txt

# Configure environment
cp .env.example .env
mkdir -p ../db  # For shared SQLite database
# Edit .env: set DB_BACKEND and connection parameters
```

## Common Development Commands

### Data Collection Workflows
```bash
# Full data capture (first run or reset)
./ivod_full.py

# Incremental update (daily execution)
./ivod_incremental.py

# Retry failed records (daily/hourly execution)
./ivod_retry.py

# Fix errors from error log file (batch mode)
./ivod_fix.py

# Fix specific IVOD_ID (single mode)
./ivod_fix.py --ivod-id 123456

# Update Elasticsearch index
./ivod_es.py
```

### Testing Commands
```bash
# Run unit tests with coverage
pytest --cov=ivod --cov-report=term-missing

# Run integration tests (marked with @pytest.mark.integration)
pytest -m integration

# Run integration test script
TEST_SQLITE_PATH=../db/ivod_test.db python integration_test.py

# Test specific modules
pytest tests/core/test_core.py
pytest tests/crawler/test_crawler.py
```

## Environment Configuration

The crawler supports three separate database environments to prevent data interference:

### Environment Detection
- **Testing**: `TESTING=true`, `PYTEST_RUNNING=true`, or `integration_test.py` execution → Uses test databases
- **Production**: `DB_ENV=production` → Uses production databases
- **Development**: Default environment for normal crawler operations

### Required `.env` variables:
```bash
# Database Environment Control
# DB_ENV=production  # Set to use production database in development

# Database backend selection
DB_BACKEND=sqlite|postgresql|mysql

# === SQLite Settings (only if DB_BACKEND=sqlite) ===
# Production database (existing configuration, names unchanged) - normal crawler operations
SQLITE_PATH=../db/ivod_local.db

# Development database (for development testing)
DEV_SQLITE_PATH=../db/ivod_dev.db

# Testing database (for integration_test.py)
TEST_SQLITE_PATH=../db/ivod_test.db

# === PostgreSQL Settings (only if DB_BACKEND=postgresql) ===
PG_HOST=localhost
PG_PORT=5432
PG_USER=ivod_user
PG_PASS=ivod_password

# Production database (existing configuration, names unchanged) - normal crawler operations
PG_DB=ivod_db

# Development database (for development testing)
PG_DEV_DB=ivod_dev_db

# Testing database (for integration_test.py)
PG_TEST_DB=ivod_test_db

# === MySQL Settings (only if DB_BACKEND=mysql) ===
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=ivod_user
MYSQL_PASS=ivod_password

# Production database (existing configuration, names unchanged) - normal crawler operations
MYSQL_DB=ivod_db

# Development database (for development testing)
MYSQL_DEV_DB=ivod_dev_db

# Testing database (for integration_test.py)
MYSQL_TEST_DB=ivod_test_db

# SSL configuration
SKIP_SSL=False

# === Elasticsearch Settings ===
ES_HOST=localhost
ES_PORT=9200
ES_SCHEME=http

# Production index (existing configuration, names unchanged) - normal crawler operations
ES_INDEX=ivod_transcripts

# Development index (for development testing)
ES_DEV_INDEX=ivod_dev_transcripts

# Testing index (for integration_test.py)
ES_TEST_INDEX=ivod_test_transcripts

# ES_USER=username ES_PASS=password

# Error logging
ERROR_LOG_PATH=logs/failed_ivods.txt
LOG_PATH=logs/
```

## Key Implementation Details

### Database Architecture
- **Single Table Design**: `IVODTranscript` model stores all data with status tracking
- **Multi-Backend Support**: SQLAlchemy adapts to different database capabilities
- **Field Adaptation**: ARRAY for PostgreSQL, JSON for MySQL, Text for SQLite
- **Status Tracking**: 'pending'/'success'/'failed' for retry logic

### Workflow Logic
1. **Full Capture** (`run_full()`): 
   - Fetches from 2024-02-01 to present
   - Comprehensive data capture for initial setup or reset
2. **Incremental Updates** (`run_incremental()`):
   - Processes last 2 weeks to catch late-arriving transcripts
   - Efficient daily updates without full re-processing
3. **Retry Mechanism** (`run_retry()`):
   - Retries failed records up to MAX_RETRIES=5
   - Prevents infinite retry loops with counter tracking

### Error Handling Patterns
- **HTTP Failures**: Caught and marked with status="failed", logged to error file
- **Empty Content**: Results in failed status for retry, logged to error file
- **SSL Issues**: Bypassable with `skip_ssl=True`
- **Database Errors**: SQLAlchemy connection pooling and retry logic
- **Error Logging**: All failures automatically logged with IVOD_ID, error type, and timestamp

### Elasticsearch Integration
- **Chinese Analysis**: Support for IK Analyzer or Smart Chinese
- **Indexing Strategy**: Bulk indexing with progress tracking
- **Field Mapping**: Optimized for Chinese full-text search
- **Error Resilience**: Continues operation if ES unavailable

## Testing Strategy

### Unit Tests
- **Core Module**: Database operations, ORM model validation
- **Crawler Module**: HTTP request handling, data parsing
- **Tasks Module**: Workflow logic, retry mechanisms
- **Mocking**: requests-mock for HTTP, in-memory SQLite for database

### Integration Tests
- **Real API Testing**: Actual IVOD service interaction
- **Multi-Date Scenarios**: Recent vs older date handling
- **Database Integration**: Full workflow testing with real data
- **ES Integration**: Index creation and search validation

### Test Organization
```
tests/
├── core/           # Core module tests
├── crawler/        # Crawler functionality tests
├── db/            # Database operation tests
├── tasks/         # Workflow and task tests
└── unit/          # Additional unit tests
```

## Production Deployment

### Ubuntu Linux Deployment
```bash
# System setup
sudo useradd -m ivoduser
sudo su - ivoduser
cd ~
git clone <repo-url> ivod_transcript_db
cd ivod_transcript_db/crawler

# Environment setup
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
mkdir logs

# Cron scheduling
crontab -e
# Add daily tasks:
# 0 2 * * * cd /home/ivoduser/ivod_transcript_db/crawler && ./ivod_incremental.py >> logs/incremental.log 2>&1
# 0 3 * * * cd /home/ivoduser/ivod_transcript_db/crawler && ./ivod_retry.py >> logs/retry.log 2>&1
# 0 4 1 * * cd /home/ivoduser/ivod_transcript_db/crawler && ./ivod_full.py >> logs/full.log 2>&1
```

### Database Backend Selection
- **SQLite**: Simple setup for single-server deployment
- **PostgreSQL**: Recommended for production with concurrent access
- **MySQL**: Alternative production database with JSON field support

## Common Development Patterns

### Database Operations
```python
# Multi-backend compatible field handling
if DB_BACKEND == 'postgresql':
    ai_transcript_field = ARRAY(Text)
elif DB_BACKEND == 'mysql':
    ai_transcript_field = JSON
else:  # sqlite
    ai_transcript_field = Text
```

### Error Handling
```python
try:
    result = process_ivod(ivod_data)
    session.merge(result)
    session.commit()
except Exception as e:
    logger.error(f"Processing failed: {e}")
    ivod_record.status = 'failed'
    session.commit()
```

### Retry Logic
```python
failed_records = session.query(IVODTranscript).filter(
    IVODTranscript.status == 'failed',
    IVODTranscript.retry_count < MAX_RETRIES
).all()
```

## Troubleshooting

### Common Issues
1. **SSL Certificate Problems**: Set `SKIP_SSL=True` in `.env`
2. **Empty Transcript Results**: Normal for recent dates, retry mechanism handles this
3. **Database Connection**: Check service status and credentials
4. **Memory Issues**: Consider batch processing for large date ranges

### Debug Commands
```bash
# Test database connection
python -c "from ivod.db import get_session; print('DB OK')"

# Test SSL connection
python test.py

# Check environment variables
python -c "import os; print(os.getenv('DB_BACKEND'))"

# Manual workflow testing
python -c "from ivod.tasks import run_incremental; run_incremental()"
```

### Monitoring & Logging
- **Log Files**: Store in `logs/` directory with rotation
- **Status Tracking**: Monitor failed record counts
- **Performance**: Track processing times and success rates
- **Elasticsearch**: Monitor index size and search performance

This guidance should help Claude Code efficiently navigate and modify the crawler component while maintaining reliability and following established patterns.