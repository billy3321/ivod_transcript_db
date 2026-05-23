/**
 * 資料庫環境設定工具
 * 根據不同環境（development、production、testing）提供不同的資料庫設定
 */

export type DatabaseEnvironment = 'development' | 'production' | 'testing';

/**
 * 獲取當前資料庫環境
 * 優先順序：NODE_ENV -> 預設為 development
 */
export function getDatabaseEnvironment(): DatabaseEnvironment {
  // 測試環境
  if (process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID) {
    return 'testing';
  }
  
  // 生產環境
  if (process.env.NODE_ENV === 'production') {
    return 'production';
  }
  
  // 開發環境可以透過 DB_ENV 指定使用 production 資料庫
  if (process.env.DB_ENV === 'production') {
    return 'production';
  }
  
  // 預設為開發環境
  return 'development';
}

/**
 * 根據環境獲取資料庫設定
 */
export function getDatabaseConfig(env?: DatabaseEnvironment) {
  const dbEnv = env || getDatabaseEnvironment();
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  
  switch (backend) {
    case 'sqlite':
      return getSQLiteConfig(dbEnv);
    case 'postgresql':
      return getPostgreSQLConfig(dbEnv);
    case 'mysql':
      return getMySQLConfig(dbEnv);
    default:
      throw new Error(`Unsupported DB_BACKEND: ${backend}`);
  }
}

/**
 * SQLite 環境設定
 */
function getSQLiteConfig(env: DatabaseEnvironment) {
  const basePath = '../db';
  
  switch (env) {
    case 'testing':
      return {
        path: process.env.TEST_SQLITE_PATH || `${basePath}/ivod_test.db`,
        url: `file://${process.env.TEST_SQLITE_PATH || `${basePath}/ivod_test.db`}`
      };
    case 'development':
      return {
        path: process.env.DEV_SQLITE_PATH || `${basePath}/ivod_dev.db`,
        url: `file://${process.env.DEV_SQLITE_PATH || `${basePath}/ivod_dev.db`}`
      };
    case 'production':
      return {
        path: process.env.SQLITE_PATH || `${basePath}/ivod_local.db`,
        url: `file://${process.env.SQLITE_PATH || `${basePath}/ivod_local.db`}`
      };
  }
}

function assertProductionEnv(env: DatabaseEnvironment, required: string[]) {
  // 只在 production 嚴格驗證；development/testing 允許 fallback 預設值方便本機開發
  if (env !== 'production') return;
  if (process.env.NODE_ENV !== 'production') return;
  const missing = required.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variable(s) in production: ${missing.join(', ')}`
    );
  }
}

/**
 * PostgreSQL 環境設定
 */
function getPostgreSQLConfig(env: DatabaseEnvironment) {
  assertProductionEnv(env, ['PG_HOST', 'PG_USER', 'PG_PASS', 'PG_DB']);

  const baseConfig = {
    host: process.env.PG_HOST || 'localhost',
    port: process.env.PG_PORT || '5432',
    user: process.env.PG_USER || 'ivod_user',
    pass: process.env.PG_PASS || 'ivod_password'
  };

  let database: string;
  switch (env) {
    case 'testing':
      database = process.env.PG_TEST_DB || 'ivod_test_db';
      break;
    case 'development':
      database = process.env.PG_DEV_DB || 'ivod_dev_db';
      break;
    case 'production':
      database = process.env.PG_DB || 'ivod_db';
      break;
  }

  return {
    database,
    url: `postgresql://${baseConfig.user}:${baseConfig.pass}@${baseConfig.host}:${baseConfig.port}/${database}`
  };
}

/**
 * MySQL 環境設定
 */
function getMySQLConfig(env: DatabaseEnvironment) {
  assertProductionEnv(env, ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_PASS', 'MYSQL_DB']);

  const baseConfig = {
    host: process.env.MYSQL_HOST || 'localhost',
    port: process.env.MYSQL_PORT || '3306',
    user: process.env.MYSQL_USER || 'ivod_user',
    pass: process.env.MYSQL_PASS || 'ivod_password'
  };

  let database: string;
  switch (env) {
    case 'testing':
      database = process.env.MYSQL_TEST_DB || 'ivod_test_db';
      break;
    case 'development':
      database = process.env.MYSQL_DEV_DB || 'ivod_dev_db';
      break;
    case 'production':
      database = process.env.MYSQL_DB || 'ivod_db';
      break;
  }

  return {
    database,
    url: `mysql://${baseConfig.user}:${baseConfig.pass}@${baseConfig.host}:${baseConfig.port}/${database}`
  };
}

/**
 * 獲取 Elasticsearch 設定（根據環境）
 */
export function getElasticsearchConfig(env?: DatabaseEnvironment) {
  const dbEnv = env || getDatabaseEnvironment();
  
  const baseConfig = {
    host: process.env.ES_HOST || 'localhost',
    port: process.env.ES_PORT || '9200',
    scheme: process.env.ES_SCHEME || 'http',
    user: process.env.ES_USER,
    password: process.env.ES_PASS
  };
  
  let index: string;
  switch (dbEnv) {
    case 'testing':
      index = process.env.ES_TEST_INDEX || 'ivod_test_transcripts';
      break;
    case 'development':
      index = process.env.ES_DEV_INDEX || 'ivod_dev_transcripts';
      break;
    case 'production':
      index = process.env.ES_INDEX || 'ivod_transcripts';
      break;
  }
  
  return {
    ...baseConfig,
    index
  };
}