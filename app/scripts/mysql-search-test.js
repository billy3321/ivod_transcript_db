#!/usr/bin/env node
// mysql-search-test.js
// Test MySQL search functionality specifically

const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(70));
  log(title, 'bright');
  console.log('='.repeat(70));
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

// Mock search parser for testing
function createContainsCondition(field, value, dbBackend) {
  // Special handling for committee_names field based on database backend
  if (field === 'committee_names') {
    if (dbBackend === 'postgresql') {
      // PostgreSQL array field - use 'has' for array contains operation
      return { [field]: { has: value } };
    } else if (dbBackend === 'mysql') {
      // MySQL JSON field - avoid case insensitive mode as it may not be supported
      return { [field]: { contains: value } };
    } else {
      // SQLite string field - use regular contains
      return { [field]: { contains: value } };
    }
  }
  
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  return isInsensitiveSupported
    ? { [field]: { contains: value, mode: 'insensitive' } }
    : { [field]: { contains: value } };
}

function buildDatabaseQuery(searchTerm, dbBackend) {
  const searchFields = [
    'title',
    'meeting_name', 
    'speaker_name',
    'committee_names',
    'ai_transcript',
    'ly_transcript'
  ];
  
  const conditions = searchFields.map(field => 
    createContainsCondition(field, searchTerm, dbBackend)
  );
  
  return { OR: conditions };
}

async function loadTestDataFromSQLite() {
  logSection('載入 SQLite 測試資料');
  
  const sqliteDbPath = path.resolve(__dirname, '../../db/ivod_test.db');
  
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(sqliteDbPath, (err) => {
      if (err) {
        logError(`無法連接 SQLite 測試資料庫: ${err.message}`);
        reject(err);
        return;
      }
      
      logSuccess(`已連接 SQLite 測試資料庫: ${sqliteDbPath}`);
    });
    
    const query = `
      SELECT ivod_id, title, speaker_name, committee_names, ai_transcript, ly_transcript
      FROM ivod_transcripts 
      LIMIT 20
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        logError(`查詢 SQLite 資料失敗: ${err.message}`);
        reject(err);
        return;
      }
      
      logSuccess(`載入 ${rows.length} 筆測試資料`);
      
      // 顯示資料樣本
      if (rows.length > 0) {
        const sample = rows[0];
        logInfo(`範例資料:`);
        logInfo(`  IVOD ID: ${sample.ivod_id}`);
        logInfo(`  標題: ${sample.title?.substring(0, 50)}...`);
        logInfo(`  發言人: ${sample.speaker_name}`);
        logInfo(`  委員會: ${sample.committee_names}`);
        logInfo(`  AI 逐字稿: ${sample.ai_transcript ? '有內容' : '無'}`);
        logInfo(`  LY 逐字稿: ${sample.ly_transcript ? '有內容' : '無'}`);
      }
      
      db.close();
      resolve(rows);
    });
  });
}

async function insertTestDataToMySQL(testData) {
  logSection('插入測試資料到 MySQL');
  
  // Temporarily set DB_BACKEND to mysql for this test
  const originalDbBackend = process.env.DB_BACKEND;
  process.env.DB_BACKEND = 'mysql';
  
  // Update Prisma schema for MySQL
  const { execSync } = require('child_process');
  try {
    logInfo('更新 Prisma schema 為 MySQL...');
    execSync('npm run prisma:prepare', { cwd: process.cwd() });
    execSync('npx prisma generate', { cwd: process.cwd() });
    logSuccess('Prisma 設定已更新為 MySQL');
  } catch (error) {
    logError(`Prisma 設定更新失敗: ${error.message}`);
    throw error;
  }
  
  const prisma = new PrismaClient();
  
  try {
    // Test MySQL connection
    await prisma.$connect();
    logSuccess('MySQL 資料庫連接成功');
    
    // Clear existing test data
    logInfo('清理現有測試資料...');
    await prisma.iVODTranscript.deleteMany({});
    logSuccess('現有資料已清理');
    
    // Insert test data
    logInfo('插入測試資料...');
    let insertedCount = 0;
    
    for (const row of testData.slice(0, 10)) { // Insert first 10 records for testing
      try {
        // Parse committee_names if it's a JSON string
        let committeeNames;
        if (row.committee_names) {
          try {
            committeeNames = JSON.parse(row.committee_names);
          } catch {
            committeeNames = [];
          }
        } else {
          committeeNames = [];
        }
        
        await prisma.iVODTranscript.create({
          data: {
            ivod_id: row.ivod_id,
            ivod_url: `https://ivod.ly.gov.tw/Play/VOD/${row.ivod_id}`,
            date: new Date(),
            title: row.title,
            speaker_name: row.speaker_name,
            committee_names: committeeNames,
            ai_transcript: row.ai_transcript,
            ly_transcript: row.ly_transcript,
            last_updated: new Date()
          }
        });
        insertedCount++;
      } catch (error) {
        logWarning(`插入記錄 ${row.ivod_id} 失敗: ${error.message}`);
      }
    }
    
    logSuccess(`成功插入 ${insertedCount} 筆測試資料到 MySQL`);
    return insertedCount;
    
  } catch (error) {
    logError(`MySQL 操作失敗: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
    // Restore original DB_BACKEND
    process.env.DB_BACKEND = originalDbBackend;
  }
}

async function testMySQLSearch() {
  logSection('測試 MySQL 搜尋功能');
  
  // Set DB_BACKEND to mysql for this test
  const originalDbBackend = process.env.DB_BACKEND;
  process.env.DB_BACKEND = 'mysql';
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    logSuccess('MySQL 連接成功');
    
    // Test different search scenarios
    const testCases = [
      { term: '社會', description: '搜尋標題包含「社會」' },
      { term: '委員', description: '搜尋包含「委員」' },
      { term: '會議', description: '搜尋包含「會議」' },
      { term: '福利', description: '搜尋包含「福利」' }
    ];
    
    for (const testCase of testCases) {
      logInfo(`\n${testCase.description}...`);
      
      try {
        // Build search conditions
        const whereConditions = buildDatabaseQuery(testCase.term, 'mysql');
        
        logInfo(`查詢條件: ${JSON.stringify(whereConditions, null, 2)}`);
        
        // Execute search
        const results = await prisma.iVODTranscript.findMany({
          where: whereConditions,
          select: {
            ivod_id: true,
            title: true,
            speaker_name: true,
            committee_names: true
          },
          take: 5
        });
        
        if (results.length > 0) {
          logSuccess(`找到 ${results.length} 筆結果`);
          results.forEach((result, index) => {
            logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title}`);
            logInfo(`     發言人: ${result.speaker_name}`);
            logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
          });
        } else {
          logWarning(`搜尋「${testCase.term}」沒有找到結果`);
        }
        
      } catch (error) {
        logError(`搜尋「${testCase.term}」失敗: ${error.message}`);
        logError(`錯誤詳情: ${error.stack}`);
      }
    }
    
    // Test committee_names specific search
    logInfo('\n測試委員會欄位搜尋...');
    try {
      const committeeResults = await prisma.iVODTranscript.findMany({
        where: {
          committee_names: { contains: '社會' }
        },
        select: {
          ivod_id: true,
          title: true,
          committee_names: true
        },
        take: 3
      });
      
      if (committeeResults.length > 0) {
        logSuccess(`委員會搜尋找到 ${committeeResults.length} 筆結果`);
        committeeResults.forEach((result, index) => {
          logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title}`);
          logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
        });
      } else {
        logWarning('委員會搜尋沒有找到結果');
      }
    } catch (error) {
      logError(`委員會搜尋失敗: ${error.message}`);
      logError(`錯誤詳情: ${error.stack}`);
    }
    
  } catch (error) {
    logError(`MySQL 搜尋測試失敗: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
    process.env.DB_BACKEND = originalDbBackend;
  }
}

async function testSearchAPI() {
  logSection('測試搜尋 API');
  
  // Set temporary environment for testing
  process.env.DB_BACKEND = 'mysql';
  process.env.ENABLE_ELASTICSEARCH = 'false'; // Force DB search
  
  try {
    // Import search API handler
    const searchHandler = require('../pages/api/search.ts');
    
    // Mock request and response objects
    const testCases = [
      { q: '社會' },
      { q: '委員' },
      { q: '會議' }
    ];
    
    for (const testCase of testCases) {
      logInfo(`\n測試 API 搜尋: ${testCase.q}`);
      
      const mockReq = {
        method: 'GET',
        query: testCase,
        url: `/api/search?q=${encodeURIComponent(testCase.q)}`
      };
      
      const mockRes = {
        status: (code) => ({
          json: (data) => {
            if (code === 200) {
              logSuccess(`API 搜尋成功，找到 ${data.data?.length || 0} 筆結果`);
              if (data.fallback) {
                logInfo('使用資料庫搜尋（ES 降級）');
              }
            } else {
              logError(`API 搜尋失敗，狀態碼: ${code}`);
              logError(`錯誤: ${JSON.stringify(data)}`);
            }
          }
        })
      };
      
      try {
        await searchHandler.default(mockReq, mockRes);
      } catch (error) {
        logError(`API 測試失敗: ${error.message}`);
      }
    }
    
  } catch (error) {
    logError(`搜尋 API 測試失敗: ${error.message}`);
    logWarning('API 測試可能需要在實際環境中執行');
  }
}

async function main() {
  console.log('');
  log('🔍 IVOD Transcript DB - MySQL 搜尋功能測試', 'bright');
  console.log('');
  
  try {
    // Step 1: Load test data from SQLite
    const testData = await loadTestDataFromSQLite();
    
    // Step 2: Insert test data to MySQL
    await insertTestDataToMySQL(testData);
    
    // Step 3: Test MySQL search functionality
    await testMySQLSearch();
    
    // Step 4: Test search API
    await testSearchAPI();
    
    logSection('測試完成');
    logSuccess('MySQL 搜尋功能測試完成');
    
  } catch (error) {
    logSection('測試失敗');
    logError(`測試過程中發生錯誤: ${error.message}`);
    logError('請檢查 MySQL 服務是否正在運行，以及連線設定是否正確');
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main };