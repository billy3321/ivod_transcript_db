#!/usr/bin/env node

/**
 * Migration script from SQLite to MySQL for IVOD Transcript Database
 * Handles field type conversions between SQLite and MySQL
 */

const sqlite3 = require('sqlite3').verbose();
const mysql = require('mysql2/promise');
const path = require('path');

// SQLite database path
const SQLITE_DB_PATH = path.join(__dirname, '../db/ivod_test.db');

// MySQL connection settings from .env
const MYSQL_CONFIG = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: parseInt(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'ivod_user',
  password: process.env.MYSQL_PASS || 'ivod_password',
  database: process.env.MYSQL_DB || 'ivod_db',
  charset: 'utf8mb4'
};

async function migrateData() {
  let mysqlConn;
  
  try {
    // Connect to MySQL
    console.log('Connecting to MySQL...');
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('✓ Connected to MySQL');

    // Create table if not exists
    console.log('Creating MySQL table structure...');
    await mysqlConn.execute(`
      CREATE TABLE IF NOT EXISTS ivod_transcripts (
        ivod_id INT PRIMARY KEY,
        ivod_url TEXT NOT NULL,
        date DATETIME NOT NULL,
        meeting_code VARCHAR(255),
        meeting_code_str VARCHAR(255),
        category VARCHAR(255),
        video_type VARCHAR(255),
        video_start VARCHAR(255),
        video_end VARCHAR(255),
        video_length VARCHAR(255),
        video_url TEXT,
        title TEXT,
        speaker_name VARCHAR(255),
        meeting_time DATETIME,
        meeting_name TEXT,
        ai_transcript LONGTEXT,
        ly_transcript LONGTEXT,
        ai_status VARCHAR(50) DEFAULT 'pending',
        ai_retries INT DEFAULT 0,
        ly_status VARCHAR(50) DEFAULT 'pending',
        ly_retries INT DEFAULT 0,
        last_updated DATETIME NOT NULL,
        committee_names JSON,
        INDEX idx_date (date),
        INDEX idx_ai_status (ai_status),
        INDEX idx_ly_status (ly_status)
      ) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
    `);
    console.log('✓ Table structure created');

    // Clear existing data
    console.log('Clearing existing data...');
    await mysqlConn.execute('TRUNCATE TABLE ivod_transcripts');

    // Open SQLite database
    console.log('Opening SQLite database...');
    const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH, sqlite3.OPEN_READONLY);

    // Get all records from SQLite
    const records = await new Promise((resolve, reject) => {
      sqliteDb.all('SELECT * FROM ivod_transcripts', (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    console.log(`✓ Found ${records.length} records in SQLite`);

    // Helper function to convert date string to MySQL datetime
    const convertToMySQLDateTime = (dateStr) => {
      if (!dateStr) return null;
      
      // Handle various date formats
      try {
        // If it's already a valid date
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return date.toISOString().slice(0, 19).replace('T', ' ');
        }
        
        // Try parsing YYYY-MM-DD format
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
          return dateStr + ' 00:00:00';
        }
        
        // Try parsing YYYY/MM/DD format
        if (/^\d{4}\/\d{2}\/\d{2}$/.test(dateStr)) {
          return dateStr.replace(/\//g, '-') + ' 00:00:00';
        }
        
        return null;
      } catch (e) {
        return null;
      }
    };

    // Helper function to convert committee_names to JSON
    const convertCommitteeNames = (committeeNames) => {
      if (!committeeNames) return null;
      
      try {
        // If it's already JSON string, parse and re-stringify
        const parsed = JSON.parse(committeeNames);
        return JSON.stringify(parsed);
      } catch (e) {
        // If it's not JSON, treat as a single committee name
        return JSON.stringify([committeeNames]);
      }
    };

    // Insert records in batches
    const BATCH_SIZE = 50;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      
      console.log(`Migrating records ${i + 1} to ${Math.min(i + BATCH_SIZE, records.length)}...`);
      
      const values = batch.map(row => [
        row.ivod_id,
        row.ivod_url,
        convertToMySQLDateTime(row.date) || '2000-01-01 00:00:00',
        row.meeting_code,
        row.meeting_code_str,
        row.category,
        row.video_type,
        row.video_start,
        row.video_end,
        row.video_length,
        row.video_url,
        row.title,
        row.speaker_name,
        convertToMySQLDateTime(row.meeting_time),
        row.meeting_name,
        row.ai_transcript,
        row.ly_transcript,
        row.ai_status || 'pending',
        row.ai_retries || 0,
        row.ly_status || 'pending',
        row.ly_retries || 0,
        convertToMySQLDateTime(row.last_updated) || new Date().toISOString().slice(0, 19).replace('T', ' '),
        convertCommitteeNames(row.committee_names)
      ]);

      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
      
      const insertQuery = `
        INSERT INTO ivod_transcripts (
          ivod_id, ivod_url, date, meeting_code, meeting_code_str,
          category, video_type, video_start, video_end, video_length,
          video_url, title, speaker_name, meeting_time, meeting_name,
          ai_transcript, ly_transcript, ai_status, ai_retries,
          ly_status, ly_retries, last_updated, committee_names
        ) VALUES ${placeholders}
      `;

      await mysqlConn.execute(insertQuery, values.flat());
    }

    // Verify migration
    const [countResult] = await mysqlConn.execute('SELECT COUNT(*) as count FROM ivod_transcripts');
    console.log(`\n✓ Migration complete! ${countResult[0].count} records in MySQL`);

    // Close connections
    sqliteDb.close();
    await mysqlConn.end();

  } catch (error) {
    console.error('Migration failed:', error);
    if (mysqlConn) await mysqlConn.end();
    process.exit(1);
  }
}

// Load .env file
require('dotenv').config();

// Run migration
console.log('Starting SQLite to MySQL migration...');
console.log('MySQL Connection:', {
  host: MYSQL_CONFIG.host,
  port: MYSQL_CONFIG.port,
  user: MYSQL_CONFIG.user,
  database: MYSQL_CONFIG.database
});

migrateData();