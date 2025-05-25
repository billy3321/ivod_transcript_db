# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project scrapes transcripts from Taiwan's Legislative Yuan IVOD service and stores them in a relational database (SQLite/PostgreSQL/MySQL). The system supports full data capture, incremental updates, and retry mechanisms for failed records.

## Project Structure

- **Core Module**: `ivod_core.py` - Contains DB setup, ORM models, and HTTP/scraping helpers
- **Task Workflows**: `ivod_tasks.py` - Defines the main task workflows (full/incremental/retry)
- **Execution Scripts**: `ivod_full.py`, `ivod_incremental.py`, `ivod_retry.py` - CLI wrappers
- **Configuration**: `.env` (from `.env.example`), `openssl.cnf`
- **Test Utilities**: `test.py` - For testing SSL/HTML parsing

## Development Environment Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env to set DB_BACKEND and connection parameters
```

## Common Commands

### Running the System

```bash
# Full data capture (first run or reset)
./ivod_full.py

# Incremental update (run daily)
./ivod_incremental.py

# Retry failed records (run daily/hourly)
./ivod_retry.py
```

### Web Application Commands

```bash
# Development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run tests
npm run test        # Watch mode
npm run test:ci     # CI mode

# Cypress tests
npm run cypress:open
npm run cypress:run

# Prisma database commands
npm run prisma:prepare
npm run prisma:generate
```

### Configuration Options

The system uses environment variables for configuration:
- `DB_BACKEND`: Choose between "sqlite", "postgresql", or "mysql"
- Database connection parameters depending on backend
- `SKIP_SSL`: Set to True to skip SSL verification if encountering SSL issues

## Key Implementation Details

1. **Database Architecture**:
   - Uses SQLAlchemy ORM with different backends (SQLite/PostgreSQL/MySQL)
   - The `IVODTranscript` model stores all transcript data and processing status

2. **Process Flow**:
   - `run_full()`: Captures all data from a fixed start date (default: 2024-02-01) to present
   - `run_incremental()`: Updates only the last two weeks of data, filling missing transcripts
   - `run_retry()`: Retries failed transcript fetches (up to MAX_RETRIES=5)

3. **Error Handling**:
   - Failed operations are marked with status="failed" and can be retried
   - Retry count is tracked per record to prevent infinite retry loops
   - SSL verification can be skipped using the `skip_ssl` parameter

## Common Issues

- Empty fetch results are marked as `failed` and can be retried
- If SSL verification fails, run with `skip_ssl=True` or set in `.env`
- To adjust the full capture start date, modify `start` in `ivod_tasks.py` `run_full()`