#!/usr/bin/env node
// test-committee-search.js
// 測試委員會搜尋的部分匹配問題

const { PrismaClient } = require('@prisma/client');
const { setupDatabaseUrl } = require('../lib/database-url');
require('dotenv').config();

// Setup DATABASE_URL
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

async function testCommitteeSearch() {
  log('\n🔍 委員會搜尋部分匹配測試', 'bright');
  console.log('='.repeat(60));
  
  const prisma = new PrismaClient();
  const dbBackend = getDbBackend();
  
  try {
    await prisma.$connect();
    
    // 先看看資料庫中實際的委員會資料
    logInfo('分析資料庫中的委員會資料...');
    const allRecords = await prisma.iVODTranscript.findMany({
      select: {
        ivod_id: true,
        committee_names: true
      }
    });
    
    logInfo('資料庫中的委員會資料：');
    allRecords.forEach(record => {
      logInfo(`  IVOD ${record.ivod_id}: ${JSON.stringify(record.committee_names)}`);
    });
    
    // 測試不同的搜尋策略
    const testCases = [
      { search: '社會福利', description: '搜尋「社會福利」' },
      { search: '教育文化', description: '搜尋「教育文化」' },
      { search: '教育及文化', description: '搜尋「教育及文化」' },
      { search: '測試委員會', description: '搜尋「測試委員會」' },
      { search: '委員會', description: '搜尋「委員會」' }
    ];
    
    for (const testCase of testCases) {
      logInfo(`\n${testCase.description}:`);
      
      if (dbBackend === 'mysql') {
        // 測試現有的 string_contains 方法
        logInfo('  方法 1: string_contains (現有方法)');
        try {
          const results1 = await prisma.iVODTranscript.findMany({
            where: {
              committee_names: { string_contains: testCase.search }
            },
            select: {
              ivod_id: true,
              committee_names: true
            }
          });
          
          if (results1.length > 0) {
            logSuccess(`    找到 ${results1.length} 筆結果`);
            results1.forEach(r => logInfo(`      [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
          } else {
            logWarning(`    沒有找到結果`);
          }
        } catch (error) {
          logError(`    錯誤: ${error.message}`);
        }
        
        // 測試 JSON_SEARCH 方法
        logInfo('  方法 2: JSON_SEARCH (新方法)');
        try {
          const results2 = await prisma.$queryRaw`
            SELECT ivod_id, committee_names 
            FROM ivod_transcripts 
            WHERE JSON_SEARCH(committee_names, 'one', ${`%${testCase.search}%`}) IS NOT NULL
            LIMIT 5
          `;
          
          if (results2.length > 0) {
            logSuccess(`    找到 ${results2.length} 筆結果`);
            results2.forEach(r => logInfo(`      [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
          } else {
            logWarning(`    沒有找到結果`);
          }
        } catch (error) {
          logError(`    錯誤: ${error.message}`);
        }
        
        // 測試 LIKE 方法  
        logInfo('  方法 3: LIKE (備用方法)');
        try {
          const results3 = await prisma.$queryRaw`
            SELECT ivod_id, committee_names 
            FROM ivod_transcripts 
            WHERE committee_names LIKE ${`%${testCase.search}%`}
            LIMIT 5
          `;
          
          if (results3.length > 0) {
            logSuccess(`    找到 ${results3.length} 筆結果`);
            results3.forEach(r => logInfo(`      [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
          } else {
            logWarning(`    沒有找到結果`);
          }
        } catch (error) {
          logError(`    錯誤: ${error.message}`);
        }
        
      } else {
        // 對於 SQLite 和 PostgreSQL 的測試
        logInfo(`  ${dbBackend.toUpperCase()} 搜尋測試`);
        try {
          let condition;
          if (dbBackend === 'postgresql') {
            // PostgreSQL 陣列搜尋
            condition = {
              committee_names: {
                hasSome: [testCase.search]
              }
            };
          } else {
            // SQLite 字串搜尋
            condition = {
              committee_names: {
                contains: testCase.search
              }
            };
          }
          
          const results = await prisma.iVODTranscript.findMany({
            where: condition,
            select: {
              ivod_id: true,
              committee_names: true
            }
          });
          
          if (results.length > 0) {
            logSuccess(`    找到 ${results.length} 筆結果`);
            results.forEach(r => logInfo(`      [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
          } else {
            logWarning(`    沒有找到結果`);
          }
        } catch (error) {
          logError(`    錯誤: ${error.message}`);
        }
      }
    }
    
    logInfo('\n結論與建議：');
    if (dbBackend === 'mysql') {
      logInfo('1. MySQL JSON 欄位的 string_contains 無法進行部分匹配');
      logInfo('2. 建議使用 JSON_SEARCH 函數進行部分匹配搜尋');
      logInfo('3. 或者使用 LIKE 操作符作為備用方案');
      logInfo('4. 需要修改 searchParser.ts 中的 MySQL 查詢邏輯');
    } else {
      logInfo(`${dbBackend.toUpperCase()} 的部分匹配搜尋應該正常工作`);
    }
    
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  await testCommitteeSearch();
}

if (require.main === module) {
  main();
}

module.exports = { main };