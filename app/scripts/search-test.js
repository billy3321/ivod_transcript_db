#!/usr/bin/env node
// search-test.js
// Test search functionality with current database backend

const { PrismaClient } = require('@prisma/client');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { setupDatabaseUrl, getDatabaseInfo, validateDatabaseConfig } = require('../lib/database-url');
require('dotenv').config();

// Setup DATABASE_URL using modular function
setupDatabaseUrl();

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

function getDbBackend() {
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  if (['sqlite', 'postgresql', 'mysql'].includes(backend)) {
    return backend;
  }
  return 'sqlite';
}

function getDbConnectionInfo() {
  const backend = getDbBackend();
  
  switch (backend) {
    case 'postgresql':
      return {
        type: 'PostgreSQL',
        host: process.env.PG_HOST || 'localhost',
        port: process.env.PG_PORT || '5432',
        database: process.env.PG_DB || 'ivod_db'
      };
    case 'mysql':
      return {
        type: 'MySQL',
        host: process.env.MYSQL_HOST || 'localhost',
        port: process.env.MYSQL_PORT || '3306',
        database: process.env.MYSQL_DB || 'ivod_db'
      };
    default:
      return {
        type: 'SQLite',
        path: process.env.SQLITE_PATH || '../db/ivod_local.db'
      };
  }
}

// Search logic matching the actual implementation
function createContainsCondition(field, value, dbBackend) {
  // Special handling for committee_names field based on database backend
  if (field === 'committee_names') {
    if (dbBackend === 'postgresql') {
      // PostgreSQL array field - use 'has' for array contains operation
      return { [field]: { has: value } };
    } else if (dbBackend === 'mysql') {
      // MySQL JSON field - use string_contains for JSON search
      return { [field]: { string_contains: value } };
    } else {
      // SQLite string field - use regular contains
      return { [field]: { contains: value } };
    }
  }
  
  // For MySQL, case insensitive mode is not supported on string fields
  if (dbBackend === 'mysql') {
    return { [field]: { contains: value } };
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

async function testDatabaseConnection() {
  logSection('測試資料庫連線');
  
  const dbBackend = getDbBackend();
  const dbInfo = getDbConnectionInfo();
  
  logInfo(`資料庫後端: ${dbBackend.toUpperCase()}`);
  logInfo(`連線資訊: ${JSON.stringify(dbInfo, null, 2)}`);
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    logSuccess(`${dbInfo.type} 資料庫連接成功`);
    
    // Check if table exists and get record count
    const count = await prisma.iVODTranscript.count();
    logSuccess(`資料表存在，包含 ${count} 筆記錄`);
    
    if (count === 0) {
      logWarning('資料庫中沒有測試資料，建議先運行 crawler 獲取一些資料');
      return false;
    }
    
    return true;
    
  } catch (error) {
    logError(`資料庫連接失敗: ${error.message}`);
    
    if (error.code === 'P2002') {
      logError('可能是資料庫 schema 問題');
    } else if (error.code === 'P1001') {
      logError('無法連接到資料庫伺服器，請檢查服務是否運行');
    }
    
    return false;
  } finally {
    await prisma.$disconnect();
  }
}

async function testBasicSearch() {
  logSection('測試基本搜尋功能');
  
  const dbBackend = getDbBackend();
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    // Get some sample data first
    const sampleData = await prisma.iVODTranscript.findMany({
      select: {
        ivod_id: true,
        title: true,
        speaker_name: true,
        committee_names: true
      },
      take: 3
    });
    
    logInfo('資料庫中的樣本資料:');
    sampleData.forEach((item, index) => {
      logInfo(`  ${index + 1}. [${item.ivod_id}] ${item.title}`);
      logInfo(`     發言人: ${item.speaker_name}`);
      logInfo(`     委員會: ${JSON.stringify(item.committee_names)}`);
    });
    
    // Define test cases based on sample data
    const testCases = [
      { term: '會議', description: '搜尋包含「會議」' },
      { term: '委員', description: '搜尋包含「委員」' },
      { term: '社會', description: '搜尋包含「社會」' },
      { term: '完整', description: '搜尋包含「完整」' }
    ];
    
    for (const testCase of testCases) {
      logInfo(`\n${testCase.description}...`);
      
      try {
        // Build search conditions using the same logic as the API
        const whereConditions = buildDatabaseQuery(testCase.term, dbBackend);
        
        logInfo(`查詢條件 (${dbBackend}): ${JSON.stringify(whereConditions, null, 2)}`);
        
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
            logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title?.substring(0, 50)}...`);
            logInfo(`     發言人: ${result.speaker_name}`);
            if (dbBackend === 'postgresql') {
              logInfo(`     委員會: ${Array.isArray(result.committee_names) ? result.committee_names.join(', ') : result.committee_names}`);
            } else {
              logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
            }
          });
        } else {
          logWarning(`搜尋「${testCase.term}」沒有找到結果`);
        }
        
      } catch (error) {
        logError(`搜尋「${testCase.term}」失敗: ${error.message}`);
        logError(`錯誤類型: ${error.constructor.name}`);
        if (error.code) {
          logError(`錯誤代碼: ${error.code}`);
        }
      }
    }
    
  } catch (error) {
    logError(`基本搜尋測試失敗: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function testCommitteeSearch() {
  logSection('測試委員會欄位搜尋');
  
  const dbBackend = getDbBackend();
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    logInfo(`測試 ${dbBackend} 資料庫的委員會欄位搜尋...`);
    
    // Test different committee search approaches based on backend
    if (dbBackend === 'postgresql') {
      logInfo('測試 PostgreSQL 陣列欄位搜尋 (has 操作符)...');
      try {
        const results = await prisma.iVODTranscript.findMany({
          where: {
            committee_names: { has: '社會福利及衛生環境委員會' }
          },
          select: {
            ivod_id: true,
            title: true,
            committee_names: true
          },
          take: 3
        });
        
        logSuccess(`PostgreSQL 陣列搜尋找到 ${results.length} 筆結果`);
        results.forEach((result, index) => {
          logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title?.substring(0, 50)}...`);
          logInfo(`     委員會: ${result.committee_names?.join(', ')}`);
        });
      } catch (error) {
        logError(`PostgreSQL 陣列搜尋失敗: ${error.message}`);
      }
    } else {
      logInfo(`測試 ${dbBackend} JSON/字串欄位搜尋 (string_contains 操作符)...`);
      try {
        const results = await prisma.iVODTranscript.findMany({
          where: {
            committee_names: { string_contains: '社會' }
          },
          select: {
            ivod_id: true,
            title: true,
            committee_names: true
          },
          take: 3
        });
        
        logSuccess(`${dbBackend} string_contains 搜尋找到 ${results.length} 筆結果`);
        results.forEach((result, index) => {
          logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title?.substring(0, 50)}...`);
          logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
        });
      } catch (error) {
        logError(`${dbBackend} string_contains 搜尋失敗: ${error.message}`);
      }
    }
    
    // Test universal LIKE search for partial matching
    logInfo('\n測試通用 LIKE 搜尋 (部分匹配)...');
    const likeTestCases = [
      { search: '社會福利', description: '搜尋「社會福利」' },
      { search: '教育文化', description: '搜尋「教育文化」' },
      { search: '教育及文化', description: '搜尋「教育及文化」' },
      { search: '委員會', description: '搜尋「委員會」' }
    ];
    
    for (const testCase of likeTestCases) {
      try {
        const results = await prisma.$queryRaw`
          SELECT ivod_id, committee_names 
          FROM ivod_transcripts 
          WHERE committee_names LIKE ${`%${testCase.search}%`}
          LIMIT 3
        `;
        
        if (results.length > 0) {
          logSuccess(`LIKE ${testCase.description}: 找到 ${results.length} 筆結果`);
          results.forEach(r => {
            logInfo(`    [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`);
          });
        } else {
          logWarning(`LIKE ${testCase.description}: 沒有找到結果`);
        }
      } catch (error) {
        logError(`LIKE ${testCase.description} 失敗: ${error.message}`);
      }
    }
    
  } catch (error) {
    logError(`委員會搜尋測試失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function testCaseInsensitivity() {
  logSection('測試大小寫敏感性');
  
  const dbBackend = getDbBackend();
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    const testCases = [
      { term: '會議', description: '小寫搜尋' },
      { term: '會議', description: '大寫搜尋' },
      { term: 'Meeting', description: '英文搜尋' }
    ];
    
    for (const testCase of testCases) {
      logInfo(`\n${testCase.description}: "${testCase.term}"`);
      
      try {
        const whereConditions = {
          OR: [
            createContainsCondition('title', testCase.term, dbBackend),
            createContainsCondition('meeting_name', testCase.term, dbBackend)
          ]
        };
        
        const results = await prisma.iVODTranscript.findMany({
          where: whereConditions,
          select: {
            ivod_id: true,
            title: true
          },
          take: 2
        });
        
        logInfo(`找到 ${results.length} 筆結果`);
        
      } catch (error) {
        logError(`大小寫測試失敗: ${error.message}`);
      }
    }
    
  } catch (error) {
    logError(`大小寫敏感性測試失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

function displayDatabaseSpecificNotes() {
  logSection('資料庫特定說明');
  
  const dbBackend = getDbBackend();
  
  switch (dbBackend) {
    case 'mysql':
      log('MySQL 特定設定:', 'yellow');
      logInfo('- committee_names 使用 JSON 欄位類型');
      logInfo('- 搜尋時避免對 JSON 欄位使用 case insensitive 模式');
      logInfo('- 大文字欄位使用 @db.LongText 註解');
      logInfo('- 預設大小寫不敏感 (取決於 collation 設定)');
      break;
      
    case 'postgresql':
      log('PostgreSQL 特定設定:', 'yellow');
      logInfo('- committee_names 使用 String[] 陣列類型');
      logInfo('- 搜尋時使用 has/hasSome/hasEvery 陣列操作符');
      logInfo('- 支援 case insensitive 搜尋模式');
      logInfo('- 建議對陣列欄位建立 GIN 索引以提升效能');
      break;
      
    default:
      log('SQLite 特定設定:', 'yellow');
      logInfo('- committee_names 使用 String 文字類型儲存 JSON');
      logInfo('- 不支援 case insensitive 搜尋模式');
      logInfo('- 所有文字欄位都是文字類型');
      logInfo('- 適合開發和小型部署');
      break;
  }
}

async function main() {
  console.log('');
  log('🔍 IVOD Transcript DB - 搜尋功能測試', 'bright');
  console.log('');
  
  try {
    // Test database connection
    const connectionSuccess = await testDatabaseConnection();
    if (!connectionSuccess) {
      return;
    }
    
    // Test basic search functionality
    await testBasicSearch();
    
    // Test committee-specific search
    await testCommitteeSearch();
    
    // Test case sensitivity
    await testCaseInsensitivity();
    
    // Display database-specific notes
    displayDatabaseSpecificNotes();
    
    logSection('測試完成');
    logSuccess('搜尋功能測試完成');
    
    const dbBackend = getDbBackend();
    if (dbBackend === 'mysql') {
      logInfo('如果 MySQL 搜尋有問題，請檢查:');
      logInfo('1. MySQL 服務是否正在運行');
      logInfo('2. 資料庫連線設定是否正確');
      logInfo('3. committee_names JSON 欄位是否正確儲存');
      logInfo('4. 字符集和 collation 設定 (建議使用 utf8mb4_unicode_ci)');
    }
    
  } catch (error) {
    logSection('測試失敗');
    logError(`測試過程中發生錯誤: ${error.message}`);
    
    const dbBackend = getDbBackend();
    logError(`請檢查 ${dbBackend.toUpperCase()} 服務是否正在運行，以及連線設定是否正確`);
    
    if (error.code) {
      logError(`錯誤代碼: ${error.code}`);
    }
    
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

module.exports = { main };