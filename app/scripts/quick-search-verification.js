#!/usr/bin/env node
// quick-search-verification.js
// 快速驗證搜尋邏輯運作狀況

const http = require('http');

function makeAPIRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, data: JSON.parse(data) });
        } catch (error) {
          resolve({ statusCode: res.statusCode, data: data });
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(3000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

async function quickVerification() {
  console.log('🔍 IVOD 搜尋邏輯快速驗證');
  console.log('=' .repeat(50));

  const tests = [
    {
      name: '1. 進階語法 - 引號搜尋',
      path: '/api/search?q=%22%E5%AE%8C%E6%95%B4%E6%9C%83%E8%AD%B0%22',
      check: (result) => result.data?.parsed?.hasAdvancedSyntax === true
    },
    {
      name: '2. 進階語法 - AND 運算',
      path: '/api/search?q=%E9%A0%90%E7%AE%97%20AND%20%E6%95%99%E8%82%B2',
      check: (result) => result.data?.parsed?.hasAdvancedSyntax === true
    },
    {
      name: '3. LIKE 模糊搜尋 - 委員會',
      path: '/api/ivods?committee=%E7%A4%BE%E6%9C%83%E7%A6%8F%E5%88%A9',
      check: (result) => result.data?.total >= 1
    },
    {
      name: '4. LIKE 模糊搜尋 - 發言人',
      path: '/api/ivods?speaker=%E5%AE%8C%E6%95%B4',
      check: (result) => result.data?.total >= 1
    },
    {
      name: '5. 結合搜尋 - 上方+下方',
      path: '/api/ivods?q=%E7%AB%8B%E6%B3%95%E9%99%A2&committee=%E7%A4%BE%E6%9C%83%E7%A6%8F%E5%88%A9',
      check: (result) => result.data?.total >= 1
    },
    {
      name: '6. ES Fallback 檢查',
      path: '/api/search?q=%E5%AE%8C%E6%95%B4',
      check: (result) => result.data?.fallback !== undefined
    }
  ];

  let passed = 0;
  let total = tests.length;

  for (const test of tests) {
    try {
      const result = await makeAPIRequest(test.path);
      const success = test.check(result);
      
      console.log(`${success ? '✅' : '❌'} ${test.name}: ${success ? 'PASS' : 'FAIL'}`);
      if (success) passed++;
      
    } catch (error) {
      console.log(`❌ ${test.name}: ERROR - ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`測試結果: ${passed}/${total} 通過`);
  
  if (passed === total) {
    console.log('🎉 所有搜尋邏輯運作正常！');
  } else {
    console.log('⚠️  部分測試失敗，請檢查相關功能');
  }
}

quickVerification().catch(console.error);