#!/usr/bin/env node
// test-new-api.js
// 測試新的通用搜尋 API 功能

const { PrismaClient } = require('@prisma/client');
const { setupDatabaseUrl } = require('../lib/database-url');
require('dotenv').config();

// Setup DATABASE_URL
setupDatabaseUrl();

async function testNewAPI() {
  console.log('🔍 測試新的通用搜尋 API');
  console.log('='.repeat(50));
  
  // Import the universal search function (mock implementation)
  const { universalSearch, shouldUseUniversalSearch } = require('../lib/universal-search.ts');
  
  const testCases = [
    {
      description: '委員會部分匹配 - 「社會福利」',
      params: { committee: '社會福利', page: 1, pageSize: 20 }
    },
    {
      description: '委員會部分匹配 - 「教育文化」', 
      params: { committee: '教育文化', page: 1, pageSize: 20 }
    },
    {
      description: '委員會部分匹配 - 「教育及文化」',
      params: { committee: '教育及文化', page: 1, pageSize: 20 }
    },
    {
      description: '發言人部分匹配 - 「完整」',
      params: { speaker: '完整', page: 1, pageSize: 20 }
    },
    {
      description: '會議名稱部分匹配 - 「財政」',
      params: { meeting_name: '財政', page: 1, pageSize: 20 }
    },
    {
      description: '混合搜尋 - 關鍵字 + 委員會',
      params: { q: '立法院', committee: '教育及文化', page: 1, pageSize: 20 }
    },
    {
      description: '混合搜尋 - 關鍵字 + 發言人',
      params: { q: '會議', speaker: '完整', page: 1, pageSize: 20 }
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.description}:`);
    console.log(`參數: ${JSON.stringify(testCase.params)}`);
    
    try {
      // Check if we should use universal search
      const shouldUse = shouldUseUniversalSearch(testCase.params);
      console.log(`應使用通用搜尋: ${shouldUse ? '是' : '否'}`);
      
      if (shouldUse) {
        const result = await universalSearch(testCase.params);
        console.log(`✅ 找到 ${result.data.length} 筆結果 (總共 ${result.total} 筆)`);
        
        result.data.slice(0, 2).forEach((item, index) => {
          console.log(`  ${index + 1}. [${item.ivod_id}] ${item.title || '(無標題)'}`);
          if (item.speaker_name) console.log(`     發言人: ${item.speaker_name}`);
          if (item.committee_names) console.log(`     委員會: ${JSON.stringify(item.committee_names)}`);
        });
      } else {
        console.log('ℹ️  使用標準 Prisma 搜尋');
      }
    } catch (error) {
      console.log(`❌ 測試失敗: ${error.message}`);
    }
  }
  
  console.log('\n測試完成');
}

if (require.main === module) {
  testNewAPI().catch(error => {
    console.error('測試過程中發生錯誤:', error);
    process.exit(1);
  });
}