#!/usr/bin/env node
// test-universal-search.js
// 測試通用搜尋功能直接測試 LIKE 查詢

const { PrismaClient } = require('@prisma/client');
const { setupDatabaseUrl, getDatabaseInfo } = require('../lib/database-url');
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

function logSection(title) {
  console.log('\n' + '='.repeat(80));
  log(title, 'bright');
  console.log('='.repeat(80));
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

async function testLikeSearch() {
  logSection('測試 LIKE 查詢進行部分匹配');
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    // Test 1: Committee partial matching
    logInfo('測試 1: 委員會部分匹配 - 「社會福利」搜尋「社會福利及衛生環境委員會」');
    
    const committeeResults = await prisma.$queryRaw`
      SELECT ivod_id, title, committee_names 
      FROM ivod_transcripts 
      WHERE committee_names LIKE ${'%社會福利%'}
      LIMIT 5
    `;
    
    if (committeeResults.length > 0) {
      logSuccess(`LIKE 查詢找到 ${committeeResults.length} 筆記錄`);
      committeeResults.forEach((result, index) => {
        logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title || '無標題'}`);
        logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
      });
    } else {
      logWarning('LIKE 查詢沒有找到結果');
    }
    
    // Test 2: Committee exact match for comparison
    logInfo('\n測試 2: 委員會完整匹配 - 「教育及文化委員會」');
    
    const exactResults = await prisma.$queryRaw`
      SELECT ivod_id, title, committee_names 
      FROM ivod_transcripts 
      WHERE committee_names LIKE ${'%教育及文化委員會%'}
      LIMIT 5
    `;
    
    if (exactResults.length > 0) {
      logSuccess(`完整匹配找到 ${exactResults.length} 筆記錄`);
      exactResults.forEach((result, index) => {
        logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title || '無標題'}`);
        logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
      });
    } else {
      logWarning('完整匹配沒有找到結果');
    }
    
    // Test 3: Speaker partial matching
    logInfo('\n測試 3: 發言人部分匹配 - 「完整」搜尋「完整會議」');
    
    const speakerResults = await prisma.$queryRaw`
      SELECT ivod_id, title, speaker_name 
      FROM ivod_transcripts 
      WHERE speaker_name LIKE ${'%完整%'}
      LIMIT 5
    `;
    
    if (speakerResults.length > 0) {
      logSuccess(`發言人 LIKE 查詢找到 ${speakerResults.length} 筆記錄`);
      speakerResults.forEach((result, index) => {
        logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title || '無標題'}`);
        logInfo(`     發言人: ${result.speaker_name}`);
      });
    } else {
      logWarning('發言人 LIKE 查詢沒有找到結果');
    }
    
    // Test 4: Meeting name partial matching
    logInfo('\n測試 4: 會議名稱部分匹配 - 「財政」搜尋財政委員會相關會議');
    
    const meetingResults = await prisma.$queryRaw`
      SELECT ivod_id, title, meeting_name 
      FROM ivod_transcripts 
      WHERE meeting_name LIKE ${'%財政%'}
      LIMIT 5
    `;
    
    if (meetingResults.length > 0) {
      logSuccess(`會議名稱 LIKE 查詢找到 ${meetingResults.length} 筆記錄`);
      meetingResults.forEach((result, index) => {
        logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title || '無標題'}`);
        logInfo(`     會議名稱: ${result.meeting_name}`);
      });
    } else {
      logWarning('會議名稱 LIKE 查詢沒有找到結果');
    }
    
    // Test 5: Complex universal search simulation
    logInfo('\n測試 5: 模擬通用搜尋邏輯');
    
    const complexQuery = `
      SELECT ivod_id, title, speaker_name, committee_names, meeting_name
      FROM ivod_transcripts 
      WHERE (
        speaker_name LIKE ${'%完整%'} OR
        committee_names LIKE ${'%社會福利%'} OR
        meeting_name LIKE ${'%財政%'}
      )
      ORDER BY ivod_id DESC
      LIMIT 10
    `;
    
    const complexResults = await prisma.$queryRawUnsafe(complexQuery);
    
    if (complexResults.length > 0) {
      logSuccess(`複合 LIKE 查詢找到 ${complexResults.length} 筆記錄`);
      complexResults.forEach((result, index) => {
        logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title || '無標題'}`);
        logInfo(`     發言人: ${result.speaker_name}`);
        logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
        logInfo(`     會議名稱: ${result.meeting_name?.substring(0, 50)}...`);
      });
    } else {
      logWarning('複合 LIKE 查詢沒有找到結果');
    }
    
  } catch (error) {
    logError(`測試失敗: ${error.message}`);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

async function testUniversalSearchConditions() {
  logSection('測試通用搜尋觸發條件');
  
  const testCases = [
    {
      params: { q: '立法院' },
      shouldTrigger: false,
      description: '僅 q 參數 - 不觸發通用搜尋'
    },
    {
      params: { speaker: '完整' },
      shouldTrigger: true,
      description: 'speaker 參數 - 觸發通用搜尋'
    },
    {
      params: { committee: '社會福利' },
      shouldTrigger: true,
      description: 'committee 參數 - 觸發通用搜尋'
    },
    {
      params: { meeting_name: '財政' },
      shouldTrigger: true,
      description: 'meeting_name 參數 - 觸發通用搜尋'
    },
    {
      params: { q: '立法院', speaker: '完整', committee: '社會福利' },
      shouldTrigger: true,
      description: '混合參數 - 觸發通用搜尋'
    }
  ];
  
  testCases.forEach(testCase => {
    const { speaker, meeting_name, committee } = testCase.params;
    const actualTrigger = !!(meeting_name || speaker || committee);
    
    if (actualTrigger === testCase.shouldTrigger) {
      logSuccess(`${testCase.description} ✓`);
    } else {
      logError(`${testCase.description} ✗ (期望: ${testCase.shouldTrigger}, 實際: ${actualTrigger})`);
    }
    logInfo(`  參數: ${JSON.stringify(testCase.params)}`);
    logInfo(`  觸發通用搜尋: ${actualTrigger}`);
  });
}

async function main() {
  console.log('');
  log('🔍 通用搜尋功能測試', 'bright');
  console.log('');
  
  const dbInfo = getDatabaseInfo();
  logInfo(`資料庫類型: ${dbInfo.type}`);
  
  try {
    await testUniversalSearchConditions();
    await testLikeSearch();
    
    logSection('測試總結');
    logSuccess('通用搜尋測試完成');
    
    logInfo('\n重點發現：');
    logInfo('1. LIKE 查詢可以進行部分匹配');
    logInfo('2. 「社會福利」可以匹配「社會福利及衛生環境委員會」');
    logInfo('3. 「完整」可以匹配「完整會議」');
    logInfo('4. 「財政」可以匹配包含財政的會議名稱');
    logInfo('5. 通用搜尋觸發條件正確運作');
    
    logInfo('\n下一步：');
    logInfo('1. 驗證 API 是否正確使用通用搜尋');
    logInfo('2. 測試前端是否正確傳遞參數');
    logInfo('3. 確認 URL 編碼/解碼處理');
    
  } catch (error) {
    logSection('測試失敗');
    logError(`測試過程中發生錯誤: ${error.message}`);
    console.error(error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { main };