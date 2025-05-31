#!/usr/bin/env node
// search-interface-test.js
// Comprehensive test for search interface with real scenarios

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

function getDbBackend() {
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  if (['sqlite', 'postgresql', 'mysql'].includes(backend)) {
    return backend;
  }
  return 'sqlite';
}

// Create database-specific condition helper
function createContainsCondition(field, value, dbBackend) {
  if (field === 'committee_names') {
    if (dbBackend === 'postgresql') {
      return { [field]: { has: value } };
    } else if (dbBackend === 'mysql') {
      return { [field]: { string_contains: value } };
    } else {
      return { [field]: { contains: value } };
    }
  }
  
  if (dbBackend === 'mysql') {
    return { [field]: { contains: value } };
  }
  
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  return isInsensitiveSupported
    ? { [field]: { contains: value, mode: 'insensitive' } }
    : { [field]: { contains: value } };
}

async function analyzeExistingData() {
  logSection('分析現有資料');
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    // Get total count
    const totalCount = await prisma.iVODTranscript.count();
    logSuccess(`資料庫總共有 ${totalCount} 筆記錄`);
    
    // Get sample data with details
    const sampleData = await prisma.iVODTranscript.findMany({
      select: {
        ivod_id: true,
        title: true,
        speaker_name: true,
        committee_names: true,
        meeting_name: true,
        date: true
      },
      take: 10
    });
    
    logInfo('\n前 10 筆資料：');
    sampleData.forEach((item, index) => {
      logInfo(`${index + 1}. [${item.ivod_id}] ${item.title || '無標題'}`);
      logInfo(`   發言人: ${item.speaker_name || '無'}`);
      logInfo(`   會議名稱: ${item.meeting_name || '無'}`);
      logInfo(`   委員會: ${JSON.stringify(item.committee_names)}`);
      logInfo(`   日期: ${item.date}`);
      console.log('');
    });
    
    // Analyze unique speakers
    const speakers = await prisma.$queryRaw`
      SELECT DISTINCT speaker_name, COUNT(*) as count 
      FROM ivod_transcripts 
      WHERE speaker_name IS NOT NULL AND speaker_name != '' 
      GROUP BY speaker_name 
      ORDER BY count DESC 
      LIMIT 10
    `;
    
    logInfo('前 10 位發言人統計：');
    speakers.forEach((speaker, index) => {
      logInfo(`${index + 1}. ${speaker.speaker_name}: ${speaker.count} 筆記錄`);
    });
    
    // Analyze committee data
    const dbBackend = getDbBackend();
    logInfo('\n委員會資料分析：');
    
    if (dbBackend === 'mysql') {
      // For MySQL JSON field
      const committees = await prisma.$queryRaw`
        SELECT committee_names, COUNT(*) as count 
        FROM ivod_transcripts 
        WHERE JSON_LENGTH(committee_names) > 0
        GROUP BY committee_names 
        ORDER BY count DESC 
        LIMIT 10
      `;
      
      committees.forEach((item, index) => {
        logInfo(`${index + 1}. ${JSON.stringify(item.committee_names)}: ${item.count} 筆記錄`);
      });
    } else {
      // For SQLite/PostgreSQL
      const records = await prisma.iVODTranscript.findMany({
        select: { committee_names: true },
        where: {
          committee_names: { not: null }
        },
        take: 10
      });
      
      const committeeCounts = {};
      records.forEach(record => {
        const committees = Array.isArray(record.committee_names) 
          ? record.committee_names 
          : (typeof record.committee_names === 'string' ? JSON.parse(record.committee_names || '[]') : []);
        
        committees.forEach(committee => {
          committeeCounts[committee] = (committeeCounts[committee] || 0) + 1;
        });
      });
      
      Object.entries(committeeCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .forEach(([committee, count], index) => {
          logInfo(`${index + 1}. ${committee}: ${count} 筆記錄`);
        });
    }
    
    return { totalCount, sampleData, speakers };
    
  } catch (error) {
    logError(`分析資料時發生錯誤: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function testSpecificFieldSearch() {
  logSection('測試特定欄位搜尋');
  
  const prisma = new PrismaClient();
  const dbBackend = getDbBackend();
  
  try {
    await prisma.$connect();
    
    // Test 1: Speaker search (URL decoded)
    logInfo('測試 1: 發言人搜尋 (黃國昌)');
    const speaker = '黃國昌';
    
    try {
      const speakerResults = await prisma.iVODTranscript.findMany({
        where: {
          speaker_name: createContainsCondition('speaker_name', speaker, dbBackend).speaker_name
        },
        select: {
          ivod_id: true,
          title: true,
          speaker_name: true
        },
        take: 5
      });
      
      if (speakerResults.length > 0) {
        logSuccess(`找到 ${speakerResults.length} 筆「${speaker}」的記錄`);
        speakerResults.forEach((result, index) => {
          logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title}`);
          logInfo(`     發言人: ${result.speaker_name}`);
        });
      } else {
        logWarning(`沒有找到「${speaker}」的記錄`);
        
        // Check for similar speakers
        const similarSpeakers = await prisma.iVODTranscript.findMany({
          where: {
            speaker_name: createContainsCondition('speaker_name', '黃', dbBackend).speaker_name
          },
          select: { speaker_name: true },
          distinct: ['speaker_name'],
          take: 5
        });
        
        if (similarSpeakers.length > 0) {
          logInfo('相似的發言人：');
          similarSpeakers.forEach(s => logInfo(`  - ${s.speaker_name}`));
        }
      }
    } catch (error) {
      logError(`發言人搜尋失敗: ${error.message}`);
    }
    
    // Test 2: Committee search
    logInfo('\n測試 2: 委員會搜尋 (教育文化)');
    const committee = '教育文化';
    
    try {
      const committeeCondition = createContainsCondition('committee_names', committee, dbBackend);
      
      const committeeResults = await prisma.iVODTranscript.findMany({
        where: {
          committee_names: committeeCondition.committee_names
        },
        select: {
          ivod_id: true,
          title: true,
          committee_names: true
        },
        take: 5
      });
      
      if (committeeResults.length > 0) {
        logSuccess(`找到 ${committeeResults.length} 筆「${committee}」的記錄`);
        committeeResults.forEach((result, index) => {
          logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title}`);
          logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
        });
      } else {
        logWarning(`沒有找到「${committee}」的記錄`);
        
        // Check for similar committees
        const allCommittees = await prisma.iVODTranscript.findMany({
          select: { committee_names: true },
          where: {
            committee_names: { not: undefined }
          },
          take: 20
        });
        
        const uniqueCommittees = new Set();
        allCommittees.forEach(record => {
          const committees = Array.isArray(record.committee_names) 
            ? record.committee_names 
            : (typeof record.committee_names === 'string' ? JSON.parse(record.committee_names || '[]') : []);
          committees.forEach(c => uniqueCommittees.add(c));
        });
        
        logInfo('資料庫中的委員會：');
        Array.from(uniqueCommittees).slice(0, 10).forEach(c => logInfo(`  - ${c}`));
      }
    } catch (error) {
      logError(`委員會搜尋失敗: ${error.message}`);
      logError(`查詢條件: ${JSON.stringify(createContainsCondition('committee_names', committee, dbBackend))}`);
    }
    
    // Test 3: Combined search
    logInfo('\n測試 3: 組合搜尋 (q + speaker + committee)');
    
    try {
      const conditions = [];
      
      // General search
      const q = '黃國昌';
      const searchFields = [
        createContainsCondition('title', q, dbBackend),
        createContainsCondition('meeting_name', q, dbBackend),
        createContainsCondition('speaker_name', q, dbBackend),
        createContainsCondition('committee_names', q, dbBackend),
        createContainsCondition('ai_transcript', q, dbBackend),
        createContainsCondition('ly_transcript', q, dbBackend),
      ];
      
      conditions.push({ OR: searchFields });
      
      // Specific speaker
      conditions.push({
        speaker_name: createContainsCondition('speaker_name', '黃國昌', dbBackend).speaker_name
      });
      
      // Specific committee
      conditions.push({
        committee_names: createContainsCondition('committee_names', '教育文化', dbBackend).committee_names
      });
      
      const combinedWhere = { AND: conditions };
      
      logInfo(`組合查詢條件: ${JSON.stringify(combinedWhere, null, 2)}`);
      
      const combinedResults = await prisma.iVODTranscript.findMany({
        where: combinedWhere,
        select: {
          ivod_id: true,
          title: true,
          speaker_name: true,
          committee_names: true
        },
        take: 5
      });
      
      if (combinedResults.length > 0) {
        logSuccess(`組合搜尋找到 ${combinedResults.length} 筆記錄`);
        combinedResults.forEach((result, index) => {
          logInfo(`  ${index + 1}. [${result.ivod_id}] ${result.title}`);
          logInfo(`     發言人: ${result.speaker_name}`);
          logInfo(`     委員會: ${JSON.stringify(result.committee_names)}`);
        });
      } else {
        logWarning('組合搜尋沒有找到結果');
      }
    } catch (error) {
      logError(`組合搜尋失敗: ${error.message}`);
    }
    
  } catch (error) {
    logError(`特定欄位搜尋測試失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function testURLEncoding() {
  logSection('測試 URL 編碼處理');
  
  const testCases = [
    { 
      encoded: '%E9%BB%83%E5%9C%8B%E6%98%8C', 
      decoded: '黃國昌',
      description: '中文姓名 URL 編碼'
    },
    {
      encoded: '%E6%95%99%E8%82%B2%E6%96%87%E5%8C%96',
      decoded: '教育文化',
      description: '委員會名稱 URL 編碼'
    }
  ];
  
  testCases.forEach(testCase => {
    const decoded = decodeURIComponent(testCase.encoded);
    if (decoded === testCase.decoded) {
      logSuccess(`${testCase.description}: ${testCase.encoded} → ${decoded}`);
    } else {
      logError(`${testCase.description}: 解碼失敗 ${testCase.encoded} → ${decoded} (期望: ${testCase.decoded})`);
    }
  });
}

async function testAPIEndpoints() {
  logSection('模擬 API 端點測試');
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    // Simulate the actual API logic
    const testAPICall = async (params, description) => {
      logInfo(`\n${description}`);
      logInfo(`參數: ${JSON.stringify(params)}`);
      
      try {
        const { q, speaker, committee, meeting_name, page = 1, pageSize = 20 } = params;
        const dbBackend = getDbBackend();
        const conditions = [];
        
        // General search
        if (q) {
          const searchFields = [
            createContainsCondition('title', q, dbBackend),
            createContainsCondition('meeting_name', q, dbBackend),
            createContainsCondition('speaker_name', q, dbBackend),
            createContainsCondition('committee_names', q, dbBackend),
            createContainsCondition('ai_transcript', q, dbBackend),
            createContainsCondition('ly_transcript', q, dbBackend),
          ];
          conditions.push({ OR: searchFields });
        }
        
        // Specific fields
        if (speaker) {
          conditions.push({
            speaker_name: createContainsCondition('speaker_name', speaker, dbBackend).speaker_name
          });
        }
        
        if (committee) {
          conditions.push({
            committee_names: createContainsCondition('committee_names', committee, dbBackend).committee_names
          });
        }
        
        if (meeting_name) {
          conditions.push({
            meeting_name: createContainsCondition('meeting_name', meeting_name, dbBackend).meeting_name
          });
        }
        
        const where = conditions.length > 0 ? { AND: conditions } : {};
        const skip = (page - 1) * pageSize;
        
        const [data, total] = await Promise.all([
          prisma.iVODTranscript.findMany({
            where,
            select: {
              ivod_id: true,
              title: true,
              speaker_name: true,
              committee_names: true,
              meeting_name: true
            },
            skip,
            take: pageSize,
            orderBy: { date: 'desc' }
          }),
          prisma.iVODTranscript.count({ where })
        ]);
        
        logSuccess(`查詢成功: 找到 ${data.length} 筆結果 (總共 ${total} 筆)`);
        
        if (data.length > 0) {
          data.slice(0, 3).forEach((item, index) => {
            logInfo(`  ${index + 1}. [${item.ivod_id}] ${item.title}`);
            logInfo(`     發言人: ${item.speaker_name}`);
            logInfo(`     委員會: ${JSON.stringify(item.committee_names)}`);
          });
        }
        
        return { success: true, count: data.length, total };
        
      } catch (error) {
        logError(`查詢失敗: ${error.message}`);
        return { success: false, error: error.message };
      }
    };
    
    // Test cases based on your examples
    const testCases = [
      {
        params: { speaker: '黃國昌' },
        description: 'API 測試 1: 發言人搜尋 (speaker=黃國昌)'
      },
      {
        params: { committee: '教育文化' },
        description: 'API 測試 2: 委員會搜尋 (committee=教育文化)'
      },
      {
        params: { 
          q: '黃國昌', 
          speaker: '黃國昌', 
          committee: '教育文化' 
        },
        description: 'API 測試 3: 組合搜尋 (q=黃國昌&speaker=黃國昌&committee=教育文化)'
      },
      {
        params: { q: '完整會議' },
        description: 'API 測試 4: 一般搜尋 (q=完整會議)'
      },
      {
        params: { committee: '社會福利' },
        description: 'API 測試 5: 委員會部分搜尋 (committee=社會福利)'
      }
    ];
    
    for (const testCase of testCases) {
      await testAPICall(testCase.params, testCase.description);
    }
    
  } catch (error) {
    logError(`API 端點測試失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  console.log('');
  log('🔍 IVOD Transcript DB - 搜尋介面全面測試', 'bright');
  console.log('');
  
  const dbInfo = getDatabaseInfo();
  logInfo(`資料庫類型: ${dbInfo.type}`);
  
  try {
    // Step 1: Analyze existing data
    await analyzeExistingData();
    
    // Step 2: Test URL encoding
    await testURLEncoding();
    
    // Step 3: Test specific field searches
    await testSpecificFieldSearch();
    
    // Step 4: Test API endpoints
    await testAPIEndpoints();
    
    logSection('測試總結');
    logSuccess('搜尋介面全面測試完成');
    
    logInfo('\n如果發現問題：');
    logInfo('1. 檢查資料庫中是否有相應的測試資料');
    logInfo('2. 確認委員會搜尋使用 LIKE 進行部分匹配');
    logInfo('3. 驗證 URL 編碼/解碼是否正確');
    logInfo('4. 檢查資料庫欄位類型是否與查詢邏輯匹配');
    logInfo('5. 對於 MySQL 委員會搜尋，應使用原始 SQL LIKE 查詢');
    
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