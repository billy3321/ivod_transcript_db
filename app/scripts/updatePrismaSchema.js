#!/usr/bin/env node
/**
 * Update Prisma schema provider based on DB_BACKEND in .env.
 * Also update committee_names field type to match crawler/db.py logic per backend.
 * This script should be run before "prisma generate" to set the provider and schema automatically.
 */

const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from app/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
const supported = ['sqlite', 'postgresql', 'mysql'];
const backend = process.env.DB_BACKEND || 'sqlite';

if (!supported.includes(backend)) {
  console.error(
    `Unsupported DB_BACKEND: ${backend}. Supported values: ${supported.join(', ')}`
  );
  process.exit(1);
}

let schema = fs.readFileSync(schemaPath, 'utf-8');

// Replace provider line in datasource block
schema = schema.replace(
  /(datasource db\s*\{\s*provider\s*=\s*")[^"]*(")/m,
  `$1${backend}$2`
);

// Handle date field based on backend
if (backend === 'sqlite') {
  // SQLite stores Date as string, so use String type in Prisma
  schema = schema.replace(
    /^\s*date\s+.*$/m,
    '  date            String'
  );
} else {
  // PostgreSQL and MySQL properly support Date type
  schema = schema.replace(
    /^\s*date\s+.*$/m,
    '  date            DateTime'
  );
}

// Handle meeting_time field based on backend
if (backend === 'sqlite') {
  // SQLite stores timestamp as string
  schema = schema.replace(
    /^\s*meeting_time\s+.*$/m,
    '  meeting_time    String?'
  );
} else {
  // PostgreSQL and MySQL use proper timestamp with timezone
  schema = schema.replace(
    /^\s*meeting_time\s+.*$/m,
    '  meeting_time    DateTime?'
  );
}

// Handle last_updated field based on backend
if (backend === 'sqlite') {
  // SQLite stores timestamp as string
  schema = schema.replace(
    /^\s*last_updated\s+.*$/m,
    '  last_updated    String'
  );
} else {
  // PostgreSQL and MySQL use proper timestamp with timezone
  schema = schema.replace(
    /^\s*last_updated\s+.*$/m,
    '  last_updated    DateTime'
  );
}

// Handle ai_transcript and ly_transcript fields for large text content
if (backend === 'mysql') {
  // MySQL needs @db.LongText for large content
  schema = schema.replace(
    /^\s*ai_transcript\s+.*$/m,
    '  ai_transcript   String? @db.LongText'
  );
  schema = schema.replace(
    /^\s*ly_transcript\s+.*$/m,
    '  ly_transcript   String? @db.LongText'
  );
} else {
  // PostgreSQL and SQLite TEXT can handle large content without special annotation
  schema = schema.replace(
    /^\s*ai_transcript\s+.*$/m,
    '  ai_transcript   String?'
  );
  schema = schema.replace(
    /^\s*ly_transcript\s+.*$/m,
    '  ly_transcript   String?'
  );
}

// Handle committee_names field based on backend
if (backend === 'postgresql') {
  schema = schema.replace(
    /^\s*committee_names\s+.*$/m,
    '  committee_names String[]?'
  );
} else if (backend === 'mysql'){
  schema = schema.replace(
    /^\s*committee_names\s+.*$/m,
    '  committee_names Json?'
  )
} else if (backend === 'sqlite'){
  schema = schema.replace(
    /^\s*committee_names\s+.*$/m,
    '  committee_names String?'
  )
} else {
  schema = schema.replace(
    /^\s*committee_names\s+.*$/m,
    '  committee_names String?'
  );
}

fs.writeFileSync(schemaPath, schema, 'utf-8');
console.log(`✅ Updated Prisma schema provider to "${backend}"`);