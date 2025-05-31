// database-url.js
// Modular DATABASE_URL setup utility

const { resolve } = require('path');

/**
 * Setup DATABASE_URL environment variable based on DB_BACKEND
 * This function dynamically constructs the database URL from individual
 * environment variables and sets it as DATABASE_URL for Prisma
 */
function setupDatabaseUrl() {
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  
  if (backend === 'sqlite') {
    const sqlitePath = process.env.SQLITE_PATH || '../db/ivod_test.db';
    const resolvedPath = resolve(sqlitePath);
    process.env.DATABASE_URL = `file://${resolvedPath}`;
    return {
      backend: 'sqlite',
      url: process.env.DATABASE_URL,
      info: `SQLite 檔案: ${resolvedPath}`
    };
  } 
  
  if (backend === 'postgresql') {
    const { PG_USER, PG_PASS, PG_HOST, PG_PORT, PG_DB } = process.env;
    
    if (!PG_USER || !PG_PASS || !PG_HOST || !PG_PORT || !PG_DB) {
      throw new Error('PostgreSQL 環境變數不完整，需要: PG_USER, PG_PASS, PG_HOST, PG_PORT, PG_DB');
    }
    
    process.env.DATABASE_URL = `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
    return {
      backend: 'postgresql',
      url: process.env.DATABASE_URL,
      info: `PostgreSQL: ${PG_HOST}:${PG_PORT}/${PG_DB}`
    };
  }
  
  if (backend === 'mysql') {
    const { MYSQL_USER, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT, MYSQL_DB } = process.env;
    
    if (!MYSQL_USER || !MYSQL_PASS || !MYSQL_HOST || !MYSQL_PORT || !MYSQL_DB) {
      throw new Error('MySQL 環境變數不完整，需要: MYSQL_USER, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT, MYSQL_DB');
    }
    
    process.env.DATABASE_URL = `mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`;
    return {
      backend: 'mysql',
      url: process.env.DATABASE_URL,
      info: `MySQL: ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`
    };
  }
  
  throw new Error(`不支援的資料庫後端: ${backend}. 支援的後端: sqlite, postgresql, mysql`);
}

/**
 * Get database connection information for display purposes
 * Returns connection details without sensitive information
 */
function getDatabaseInfo() {
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  
  switch (backend) {
    case 'postgresql':
      return {
        type: 'PostgreSQL',
        host: process.env.PG_HOST || '未設定',
        port: process.env.PG_PORT || '未設定',
        database: process.env.PG_DB || '未設定',
        user: process.env.PG_USER || '未設定',
        passwordSet: !!process.env.PG_PASS
      };
    case 'mysql':
      return {
        type: 'MySQL',
        host: process.env.MYSQL_HOST || '未設定',
        port: process.env.MYSQL_PORT || '未設定',
        database: process.env.MYSQL_DB || '未設定',
        user: process.env.MYSQL_USER || '未設定',
        passwordSet: !!process.env.MYSQL_PASS
      };
    default:
      return {
        type: 'SQLite',
        path: process.env.SQLITE_PATH || '../db/ivod_test.db'
      };
  }
}

/**
 * Validate that all required environment variables are set for the current backend
 */
function validateDatabaseConfig() {
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  
  if (backend === 'sqlite') {
    return { valid: true, backend };
  }
  
  if (backend === 'postgresql') {
    const required = ['PG_USER', 'PG_PASS', 'PG_HOST', 'PG_PORT', 'PG_DB'];
    const missing = required.filter(key => !process.env[key]);
    
    return {
      valid: missing.length === 0,
      backend,
      missing: missing
    };
  }
  
  if (backend === 'mysql') {
    const required = ['MYSQL_USER', 'MYSQL_PASS', 'MYSQL_HOST', 'MYSQL_PORT', 'MYSQL_DB'];
    const missing = required.filter(key => !process.env[key]);
    
    return {
      valid: missing.length === 0,
      backend,
      missing: missing
    };
  }
  
  return {
    valid: false,
    backend,
    error: `不支援的資料庫後端: ${backend}`
  };
}

module.exports = {
  setupDatabaseUrl,
  getDatabaseInfo,
  validateDatabaseConfig
};