#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client');
const dotenv = require('dotenv');
const { setupDatabaseUrl, getDatabaseInfo, validateDatabaseConfig } = require('../lib/database-url');

// Load environment variables
dotenv.config();

// Setup DATABASE_URL using modular function
const dbSetup = setupDatabaseUrl();
const backend = dbSetup.backend;

async function testDatabaseConnection() {
  
  console.log('=== 資料庫連線資訊 ===');
  console.log(`資料庫後端: ${backend || '未設定'}`);
  
  // Display connection information based on backend type
  let connectionInfo = '';
  let databaseUrl = '';
  
  if (backend === 'sqlite') {
    const sqlitePath = process.env.SQLITE_PATH || '../db/ivod_test.db';
    const resolvedPath = resolve(sqlitePath);
    connectionInfo = `SQLite 檔案路徑: ${resolvedPath}`;
    databaseUrl = `file://${resolvedPath}`;
  } else if (backend === 'postgresql') {
    const { PG_USER, PG_PASS, PG_HOST, PG_PORT, PG_DB } = process.env;
    connectionInfo = `PostgreSQL 連線資訊:
  主機: ${PG_HOST || '未設定'}
  端口: ${PG_PORT || '未設定'}
  資料庫: ${PG_DB || '未設定'}
  使用者: ${PG_USER || '未設定'}
  密碼: ${PG_PASS ? '已設定' : '未設定'}`;
    databaseUrl = `postgresql://${PG_USER}:${PG_PASS}@${PG_HOST}:${PG_PORT}/${PG_DB}`;
  } else if (backend === 'mysql') {
    const { MYSQL_USER, MYSQL_PASS, MYSQL_HOST, MYSQL_PORT, MYSQL_DB } = process.env;
    connectionInfo = `MySQL 連線資訊:
  主機: ${MYSQL_HOST || '未設定'}
  端口: ${MYSQL_PORT || '未設定'}
  資料庫: ${MYSQL_DB || '未設定'}
  使用者: ${MYSQL_USER || '未設定'}
  密碼: ${MYSQL_PASS ? '已設定' : '未設定'}`;
    databaseUrl = `mysql://${MYSQL_USER}:${MYSQL_PASS}@${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DB}`;
  } else {
    console.error('❌ 錯誤: DB_BACKEND 環境變數未設定或無效');
    console.log('支援的值: sqlite, postgresql, mysql');
    process.exit(1);
  }
  
  console.log(connectionInfo);
  console.log(`連線字串: ${databaseUrl}`);
  console.log('');
  
  // Test database connection
  console.log('=== 連線測試 ===');
  const prisma = new PrismaClient();
  
  try {
    // Test basic connection
    console.log('正在測試資料庫連線...');
    await prisma.$connect();
    console.log('✅ 資料庫連線成功');
    
    // Test if we can query the database
    console.log('正在測試資料查詢...');
    const count = await prisma.iVODTranscript.count();
    console.log(`✅ 資料查詢成功，共有 ${count} 筆 IVOD 記錄`);
    
    // Test a sample query
    console.log('正在測試範例查詢...');
    const sample = await prisma.iVODTranscript.findFirst({
      select: {
        ivod_id: true,
        meeting_name: true,
        date: true,
        ai_status: true,
        ly_status: true
      }
    });
    
    if (sample) {
      console.log('✅ 範例記錄查詢成功:');
      console.log(`  IVOD ID: ${sample.ivod_id}`);
      console.log(`  會議名稱: ${sample.meeting_name || '無'}`);
      console.log(`  日期: ${sample.date || '無'}`);
      console.log(`  AI 轉寫狀態: ${sample.ai_status || '無'}`);
      console.log(`  立法院轉寫狀態: ${sample.ly_status || '無'}`);
    } else {
      console.log('⚠️  資料庫為空，沒有找到任何記錄');
    }
    
    // Test database schema
    console.log('正在檢查資料庫結構...');
    let tableExists = false;
    try {
      if (backend === 'sqlite') {
        const tableInfo = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' AND name='ivod_transcripts'`;
        tableExists = tableInfo && tableInfo.length > 0;
      } else if (backend === 'postgresql') {
        const tableInfo = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_name = 'ivod_transcripts'`;
        tableExists = tableInfo && tableInfo.length > 0;
      } else if (backend === 'mysql') {
        const tableInfo = await prisma.$queryRaw`SHOW TABLES LIKE 'ivod_transcripts'`;
        tableExists = tableInfo && tableInfo.length > 0;
      }
    } catch (error) {
      console.log('⚠️  無法檢查資料表結構');
    }
    
    if (tableExists) {
      console.log('✅ ivod_transcripts 資料表存在');
    } else {
      console.log('⚠️  警告: ivod_transcripts 資料表不存在，可能需要執行資料庫遷移');
    }
    
  } catch (error) {
    console.error('❌ 資料庫連線或查詢失敗:');
    console.error(`錯誤訊息: ${error.message}`);
    
    if (error.code) {
      console.error(`錯誤代碼: ${error.code}`);
    }
    
    // Provide specific troubleshooting tips
    if (backend === 'sqlite') {
      console.log('\n💡 SQLite 疑難排解:');
      console.log('- 檢查 SQLITE_PATH 路徑是否正確');
      console.log('- 確認資料庫檔案是否存在');
      console.log('- 檢查檔案權限');
    } else if (backend === 'postgresql') {
      console.log('\n💡 PostgreSQL 疑難排解:');
      console.log('- 檢查 PostgreSQL 服務是否運行');
      console.log('- 確認連線參數是否正確');
      console.log('- 檢查防火牆設定');
    } else if (backend === 'mysql') {
      console.log('\n💡 MySQL 疑難排解:');
      console.log('- 檢查 MySQL 服務是否運行');
      console.log('- 確認連線參數是否正確');
      console.log('- 檢查使用者權限');
    }
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
  
  console.log('\n🎉 資料庫連線測試完成');
}

// Run the test
testDatabaseConnection().catch((error) => {
  console.error('未預期的錯誤:', error);
  process.exit(1);
});