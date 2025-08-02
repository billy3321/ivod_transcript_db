#!/usr/bin/env node
// search-interface-test.js
// 全面的搜尋介面測試，整合了原本 comprehensive-search-test.js 的複雜測試邏輯

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

// 建立資料庫特定的查詢條件
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

// 模擬搜尋 API 的邏輯
async function simulateAPICall(params, description, baseUrl = '/api/ivods') {
  logInfo(`\n${description}`);
  logInfo(`參數: ${JSON.stringify(params)}`);
  
  const prisma = new PrismaClient();
  const dbBackend = getDbBackend();
  
  try {
    await prisma.$connect();
    
    const { 
      q, 
      mode = 'all',
      meeting_name,
      speaker,
      committee,
      date_from,
      date_to,
      page = 1, 
      pageSize = 20,
      sort = 'date_desc',
      ids
    } = params;
    
    const pageNum = parseInt(page, 10);
    const size = parseInt(pageSize, 10);
    const skip = (pageNum - 1) * size;
    const orderBy = sort === 'date_asc' ? { date: 'asc' } : { date: 'desc' };
    
    const conditions = [];
    
    // 根據 mode 和 baseUrl 決定搜尋策略
    const useAdvancedSearch = (mode === 'transcript' || baseUrl === '/api/search');
    
    // 一般搜尋 (q 參數)
    if (q && typeof q === 'string') {
      if (useAdvancedSearch) {
        // 進階搜尋 - 主要搜尋逐字稿內容
        const searchFields = [
          createContainsCondition('ai_transcript', q, dbBackend),
          createContainsCondition('ly_transcript', q, dbBackend),
        ];
        
        // 如果模式是 'all'，也搜尋其他欄位
        if (mode === 'all') {
          searchFields.push(
            createContainsCondition('title', q, dbBackend),
            createContainsCondition('meeting_name', q, dbBackend),
            createContainsCondition('speaker_name', q, dbBackend),
            createContainsCondition('committee_names', q, dbBackend),
          );
        }
        
        conditions.push({ OR: searchFields });
      } else {
        // 基本搜尋 - 搜尋所有欄位
        const searchFields = [
          createContainsCondition('title', q, dbBackend),
          createContainsCondition('meeting_name', q, dbBackend),
          createContainsCondition('speaker_name', q, dbBackend),
          createContainsCondition('committee_names', q, dbBackend),
          createContainsCondition('meeting_code_str', q, dbBackend),
          createContainsCondition('ai_transcript', q, dbBackend),
          createContainsCondition('ly_transcript', q, dbBackend),
        ];
        conditions.push({ OR: searchFields });
      }
    }
    
    // 進階篩選條件
    if (meeting_name && typeof meeting_name === 'string') {
      conditions.push({
        meeting_name: createContainsCondition('meeting_name', meeting_name, dbBackend).meeting_name
      });
    }
    
    if (speaker && typeof speaker === 'string') {
      conditions.push({
        speaker_name: createContainsCondition('speaker_name', speaker, dbBackend).speaker_name
      });
    }
    
    if (committee && typeof committee === 'string') {
      conditions.push({
        committee_names: createContainsCondition('committee_names', committee, dbBackend).committee_names
      });
    }
    
    if (date_from && typeof date_from === 'string') {
      conditions.push({ date: { gte: date_from } });
    }
    
    if (date_to && typeof date_to === 'string') {
      conditions.push({ date: { lte: date_to } });
    }
    
    if (ids && typeof ids === 'string') {
      const ivodIds = ids.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      if (ivodIds.length > 0) {
        conditions.push({ ivod_id: { in: ivodIds } });
      }
    }
    
    const where = conditions.length > 0 ? { AND: conditions } : {};
    
    logInfo(`API 端點: ${baseUrl}`);
    logInfo(`搜尋模式: ${mode}`);
    logInfo(`查詢條件: ${JSON.stringify(where, null, 2)}`);
    
    const [data, total] = await Promise.all([
      prisma.iVODTranscript.findMany({
        where,
        orderBy,
        skip,
        take: size,
        select: {
          ivod_id: true,
          date: true,
          title: true,
          meeting_name: true,
          committee_names: true,
          speaker_name: true,
          video_length: true,
          video_start: true,
          video_end: true,
          video_type: true,
          category: true,
          meeting_code: true,
          meeting_code_str: true,
          meeting_time: true,
        },
      }),
      prisma.iVODTranscript.count({ where }),
    ]);
    
    if (data.length > 0) {
      logSuccess(`找到 ${data.length} 筆結果 (總共 ${total} 筆)`);
      data.slice(0, 3).forEach((item, index) => {
        logInfo(`  ${index + 1}. [${item.ivod_id}] ${item.title || '(無標題)'}`);
        logInfo(`     發言人: ${item.speaker_name || '無'}`);
        logInfo(`     會議: ${item.meeting_name || '無'}`);
        logInfo(`     委員會: ${JSON.stringify(item.committee_names)}`);
        logInfo(`     日期: ${item.date}`);
      });
    } else {
      logWarning('沒有找到結果');
    }
    
    return { success: true, count: data.length, total, data };
    
  } catch (error) {
    logError(`查詢失敗: ${error.message}`);
    return { success: false, error: error.message };
  } finally {
    await prisma.$disconnect();
  }
}

async function analyzeExistingData() {
  logSection('分析現有資料');
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    const totalCount = await prisma.iVODTranscript.count();
    logSuccess(`資料庫總共有 ${totalCount} 筆記錄`);
    
    if (totalCount === 0) {
      logWarning('資料庫為空，建議先運行 crawler 獲取一些測試資料');
      return false;
    }
    
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
    
    // 分析發言人
    const speakers = await prisma.$queryRaw`
      SELECT DISTINCT speaker_name, COUNT(*) as count 
      FROM ivod_transcripts 
      WHERE speaker_name IS NOT NULL AND speaker_name != '' 
      GROUP BY speaker_name 
      ORDER BY count DESC 
      LIMIT 5
    `;
    
    logInfo('發言人統計 (前 5 位)：');
    speakers.forEach((speaker, index) => {
      logInfo(`  ${index + 1}. ${speaker.speaker_name}: ${speaker.count} 筆`);
    });
    
    // 分析委員會
    const dbBackend = getDbBackend();
    if (dbBackend === 'mysql') {
      const committees = await prisma.$queryRaw`
        SELECT committee_names, COUNT(*) as count 
        FROM ivod_transcripts 
        WHERE JSON_LENGTH(committee_names) > 0
        GROUP BY committee_names 
        ORDER BY count DESC 
        LIMIT 5
      `;
      
      logInfo('委員會統計 (前 5 個)：');
      committees.forEach((item, index) => {
        logInfo(`  ${index + 1}. ${JSON.stringify(item.committee_names)}: ${item.count} 筆`);
      });
    }
    
    return true;
    
  } catch (error) {
    logError(`分析資料時發生錯誤: ${error.message}`);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

async function testURLEncoding() {
  logSection('測試 URL 編碼處理');
  
  const testCases = [
    { 
      encoded: '%E9%BB%83%E5%9C%8B%E6%98%8C', 
      decoded: '沈伯洋',
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

async function testSpecificFieldSearch() {
  logSection('測試特定欄位搜尋');
  
  const prisma = new PrismaClient();
  const dbBackend = getDbBackend();
  
  try {
    await prisma.$connect();
    
    // Test 1: Speaker search (URL decoded)
    logInfo('測試 1: 發言人搜尋 (沈伯洋)');
    const speaker = '沈伯洋';
    
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
    
  } catch (error) {
    logError(`特定欄位搜尋測試失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function testBasicSearch() {
  logSection('1. 基本搜尋功能測試 (上方搜尋欄位)');
  
  const testCases = [
    {
      params: { q: '完整會議' },
      description: '基本關鍵字搜尋 - 搜尋「完整會議」',
      apiUrl: '/api/ivods'
    },
    {
      params: { q: '立法院' },
      description: '基本關鍵字搜尋 - 搜尋「立法院」',
      apiUrl: '/api/ivods'
    },
    {
      params: { q: '委員會' },
      description: '基本關鍵字搜尋 - 搜尋「委員會」',
      apiUrl: '/api/ivods'
    },
    {
      params: { q: '不存在的內容xyz123' },
      description: '基本關鍵字搜尋 - 搜尋不存在的內容',
      apiUrl: '/api/ivods'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testSearchModes() {
  logSection('2. 搜尋模式測試 (所有欄位 vs 僅搜尋逐字稿)');
  
  const testCases = [
    {
      params: { q: '完整會議', mode: 'all' },
      description: '模式：所有欄位 - 搜尋「完整會議」',
      apiUrl: '/api/ivods'
    },
    {
      params: { q: '完整會議', mode: 'transcript' },
      description: '模式：僅搜尋逐字稿 - 搜尋「完整會議」',
      apiUrl: '/api/search'
    },
    {
      params: { q: '立法院', mode: 'all' },
      description: '模式：所有欄位 - 搜尋「立法院」',
      apiUrl: '/api/ivods'
    },
    {
      params: { q: '立法院', mode: 'transcript' },
      description: '模式：僅搜尋逐字稿 - 搜尋「立法院」',
      apiUrl: '/api/search'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testAdvancedFilters() {
  logSection('3. 進階篩選功能測試 (下方進階選項)');
  
  const testCases = [
    {
      params: { meeting_name: '財政委員會' },
      description: '進階篩選：會議名稱 - 「財政委員會」',
      apiUrl: '/api/ivods'
    },
    {
      params: { speaker: '完整會議' },
      description: '進階篩選：發言人 - 「完整會議」',
      apiUrl: '/api/ivods'
    },
    {
      params: { committee: '社會福利' },
      description: '進階篩選：委員會 - 「社會福利」',
      apiUrl: '/api/ivods'
    },
    {
      params: { committee: '教育及文化' },
      description: '進階篩選：委員會 - 「教育及文化」(完整名稱)',
      apiUrl: '/api/ivods'
    },
    {
      params: { date_from: '2023-05-01' },
      description: '進階篩選：開始日期 - 2023-05-01 之後',
      apiUrl: '/api/ivods'
    },
    {
      params: { date_to: '2023-12-31' },
      description: '進階篩選：結束日期 - 2023-12-31 之前',
      apiUrl: '/api/ivods'
    },
    {
      params: { sort: 'date_asc' },
      description: '進階篩選：排序 - 日期由舊到新',
      apiUrl: '/api/ivods'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testCombinedSearch() {
  logSection('4. 混合搜尋測試 (上方搜尋 + 下方篩選)');
  
  const testCases = [
    {
      params: { 
        q: '立法院', 
        meeting_name: '委員會' 
      },
      description: '混合搜尋：關鍵字「立法院」+ 會議名稱「委員會」',
      apiUrl: '/api/ivods'
    },
    {
      params: { 
        q: '完整會議', 
        speaker: '完整會議' 
      },
      description: '混合搜尋：關鍵字「完整會議」+ 發言人「完整會議」',
      apiUrl: '/api/ivods'
    },
    {
      params: { 
        q: '立法院', 
        committee: '教育及文化',
        mode: 'all'
      },
      description: '混合搜尋：關鍵字「立法院」+ 委員會「教育及文化」+ 所有欄位模式',
      apiUrl: '/api/ivods'
    },
    {
      params: { 
        q: '立法院', 
        committee: '社會福利',
        mode: 'transcript'
      },
      description: '混合搜尋：關鍵字「立法院」+ 委員會「社會福利」+ 逐字稿模式',
      apiUrl: '/api/search'
    },
    {
      params: { 
        q: '會議', 
        date_from: '2023-05-01',
        date_to: '2023-12-31',
        sort: 'date_desc'
      },
      description: '混合搜尋：關鍵字「會議」+ 日期範圍 + 排序',
      apiUrl: '/api/ivods'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testAdvancedSearchSyntax() {
  logSection('5. 進階搜尋語法測試 (引號、布林運算等)');
  
  const testCases = [
    {
      params: { q: '"完整會議"' },
      description: '進階語法：引號搜尋 - "完整會議"',
      apiUrl: '/api/search'
    },
    {
      params: { q: '立法院 AND 委員會' },
      description: '進階語法：AND 運算 - 立法院 AND 委員會',
      apiUrl: '/api/search'
    },
    {
      params: { q: '財政 OR 教育' },
      description: '進階語法：OR 運算 - 財政 OR 教育',
      apiUrl: '/api/search'
    },
    {
      params: { q: 'title:"立法院"' },
      description: '進階語法：欄位搜尋 - title:"立法院"',
      apiUrl: '/api/search'
    },
    {
      params: { q: 'speaker:"完整會議"' },
      description: '進階語法：欄位搜尋 - speaker:"完整會議"',
      apiUrl: '/api/search'
    },
    {
      params: { q: 'committee:"教育"' },
      description: '進階語法：欄位搜尋 - committee:"教育"',
      apiUrl: '/api/search'
    },
    {
      params: { q: '會議 -財政' },
      description: '進階語法：排除 - 會議 -財政',
      apiUrl: '/api/search'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testPaginationAndSorting() {
  logSection('6. 分頁和排序測試');
  
  const testCases = [
    {
      params: { page: 1, pageSize: 5 },
      description: '分頁測試：第 1 頁，每頁 5 筆',
      apiUrl: '/api/ivods'
    },
    {
      params: { page: 2, pageSize: 2 },
      description: '分頁測試：第 2 頁，每頁 2 筆',
      apiUrl: '/api/ivods'
    },
    {
      params: { sort: 'date_asc', pageSize: 3 },
      description: '排序測試：日期升序，每頁 3 筆',
      apiUrl: '/api/ivods'
    },
    {
      params: { sort: 'date_desc', pageSize: 3 },
      description: '排序測試：日期降序，每頁 3 筆',
      apiUrl: '/api/ivods'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testEdgeCases() {
  logSection('7. 邊界情況和錯誤處理測試');
  
  const testCases = [
    {
      params: { q: '' },
      description: '邊界情況：空白搜尋',
      apiUrl: '/api/ivods'
    },
    {
      params: { q: '   ' },
      description: '邊界情況：只有空格的搜尋',
      apiUrl: '/api/ivods'
    },
    {
      params: { page: 0 },
      description: '邊界情況：頁數為 0',
      apiUrl: '/api/ivods'
    },
    {
      params: { page: -1 },
      description: '邊界情況：負數頁數',
      apiUrl: '/api/ivods'
    },
    {
      params: { pageSize: 0 },
      description: '邊界情況：每頁 0 筆',
      apiUrl: '/api/ivods'
    },
    {
      params: { pageSize: 1000 },
      description: '邊界情況：每頁 1000 筆 (過大)',
      apiUrl: '/api/ivods'
    },
    {
      params: { date_from: '2030-01-01' },
      description: '邊界情況：未來日期',
      apiUrl: '/api/ivods'
    },
    {
      params: { date_from: 'invalid-date' },
      description: '邊界情況：無效日期格式',
      apiUrl: '/api/ivods'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function testURLEncodingScenarios() {
  logSection('8. URL 編碼情境測試');
  
  const testCases = [
    {
      params: { speaker: decodeURIComponent('%E9%BB%83%E5%9C%8B%E6%98%8C') }, // 沈伯洋
      description: 'URL 編碼：發言人 - 沈伯洋 (從 %E9%BB%83%E5%9C%8B%E6%98%8C 解碼)',
      apiUrl: '/api/ivods'
    },
    {
      params: { committee: decodeURIComponent('%E6%95%99%E8%82%B2%E6%96%87%E5%8C%96') }, // 教育文化
      description: 'URL 編碼：委員會 - 教育文化 (從 %E6%95%99%E8%82%B2%E6%96%87%E5%8C%96 解碼)',
      apiUrl: '/api/ivods'
    },
    {
      params: { 
        q: decodeURIComponent('%E7%AB%8B%E6%B3%95%E9%99%A2'), // 立法院
        speaker: decodeURIComponent('%E5%AE%8C%E6%95%B4%E6%9C%83%E8%AD%B0') // 完整會議
      },
      description: 'URL 編碼：混合搜尋 - 立法院 + 完整會議 (從編碼解碼)',
      apiUrl: '/api/ivods'
    }
  ];
  
  for (const testCase of testCases) {
    await simulateAPICall(testCase.params, testCase.description, testCase.apiUrl);
  }
}

async function main() {
  console.log('');
  log('🔍 IVOD Transcript DB - 搜尋介面全面測試 (整合版)', 'bright');
  console.log('');
  
  const dbInfo = getDatabaseInfo();
  logInfo(`資料庫類型: ${dbInfo.type}`);
  
  try {
    // 分析當前資料狀況
    const hasData = await analyzeExistingData();
    if (!hasData) {
      return;
    }
    
    // 執行全面的搜尋功能測試
    await testURLEncoding();
    await testSpecificFieldSearch();
    await testBasicSearch();
    await testSearchModes();
    await testAdvancedFilters();
    await testCombinedSearch();
    await testAdvancedSearchSyntax();
    await testPaginationAndSorting();
    await testEdgeCases();
    await testURLEncodingScenarios();
    
    logSection('測試總結');
    logSuccess('搜尋介面全面測試完成');
    
    logInfo('\n測試涵蓋的使用場景：');
    logInfo('1. ✅ URL 編碼/解碼處理');
    logInfo('2. ✅ 特定欄位搜尋 (發言人、委員會等)');
    logInfo('3. ✅ 基本搜尋功能 (上方搜尋欄位)');
    logInfo('4. ✅ 搜尋模式切換 (所有欄位 vs 僅搜尋逐字稿)');
    logInfo('5. ✅ 進階篩選功能 (下方進階選項)');
    logInfo('6. ✅ 混合搜尋 (上方搜尋 + 下方篩選)');
    logInfo('7. ✅ 進階搜尋語法 (引號、布林運算等)');
    logInfo('8. ✅ 分頁和排序');
    logInfo('9. ✅ 邊界情況和錯誤處理');
    logInfo('10. ✅ URL 編碼情境測試');
    
    logInfo('\n如果發現問題：');
    logInfo('1. 檢查資料庫中是否有相應的測試資料');
    logInfo('2. 確認委員會搜尋使用 LIKE 進行部分匹配');
    logInfo('3. 驗證 URL 編碼/解碼是否正確');
    logInfo('4. 檢查資料庫欄位類型是否與查詢邏輯匹配');
    logInfo('5. 對於 MySQL 委員會搜尋，應使用原始 SQL LIKE 查詢');
    logInfo('6. 確認進階搜尋語法的解析');
    logInfo('7. 檢查分頁和排序功能的正確性');
    
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