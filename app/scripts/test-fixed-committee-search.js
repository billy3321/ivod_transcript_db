#!/usr/bin/env node
// test-fixed-committee-search.js
// 測試修復後的委員會搜尋功能

const { setupDatabaseUrl } = require('../lib/database-url');
const fetch = require('node').fetch || (async (url) => {
  const http = require('http');
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ 
        json: () => JSON.parse(data),
        status: res.statusCode
      }));
    });
    req.on('error', reject);
  });
});
require('dotenv').config();

// Setup DATABASE_URL
setupDatabaseUrl();

async function testCommitteeAPI() {
  console.log('🔍 測試修復後的委員會搜尋 API');
  console.log('='.repeat(50));
  
  const baseUrl = 'http://localhost:3000';
  
  const testCases = [
    {
      description: '測試「社會福利」搜尋',
      url: `${baseUrl}/api/ivods?committee=社會福利`
    },
    {
      description: '測試「教育文化」搜尋',
      url: `${baseUrl}/api/ivods?committee=教育文化`
    },
    {
      description: '測試「教育及文化」搜尋',
      url: `${baseUrl}/api/ivods?committee=教育及文化`
    },
    {
      description: '測試「委員會」搜尋',
      url: `${baseUrl}/api/ivods?committee=委員會`
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n${testCase.description}:`);
    console.log(`URL: ${testCase.url}`);
    
    try {
      // 模擬 API 呼叫
      const response = await fetch(testCase.url);
      const data = await response.json();
      
      if (response.status === 200) {
        console.log(`✅ 找到 ${data.data.length} 筆結果 (總共 ${data.total} 筆)`);
        data.data.slice(0, 2).forEach((item, index) => {
          console.log(`  ${index + 1}. [${item.ivod_id}] ${item.title || '(無標題)'}`);
          console.log(`     委員會: ${JSON.stringify(item.committee_names)}`);
        });
      } else {
        console.log(`❌ API 錯誤: ${response.status}`);
        console.log(`錯誤信息: ${JSON.stringify(data)}`);
      }
    } catch (error) {
      console.log(`❌ 呼叫失敗: ${error.message}`);
    }
  }
}

if (require.main === module) {
  testCommitteeAPI().then(() => {
    console.log('\n測試完成');
  }).catch(error => {
    console.error('測試失敗:', error.message);
  });
}