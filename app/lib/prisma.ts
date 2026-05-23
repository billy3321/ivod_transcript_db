import dotenv from 'dotenv';
import { resolve } from 'path';
import { getDatabaseConfig, getDatabaseEnvironment } from './database-env';

dotenv.config();

// 根據環境設定資料庫連線
const dbConfig = getDatabaseConfig();
const dbEnv = getDatabaseEnvironment();

// 設定 DATABASE_URL 環境變數供 Prisma 使用
if (process.env.DB_BACKEND?.toLowerCase() === 'sqlite') {
  // SQLite config has path property
  const sqliteConfig = dbConfig as { path: string; url: string };
  process.env.DATABASE_URL = `file://${resolve(sqliteConfig.path)}`;
} else {
  // PostgreSQL/MySQL config has url property
  process.env.DATABASE_URL = dbConfig.url;
}

import { PrismaClient } from '@prisma/client';

// 在開發環境顯示資料庫環境資訊（不印含密碼的 DATABASE_URL）
if (process.env.NODE_ENV !== 'production') {
  const backend = process.env.DB_BACKEND || 'sqlite';
  console.log(`🗄️  Database Environment: ${dbEnv}, Backend: ${backend}`);
}

const prisma = new PrismaClient();
export default prisma;