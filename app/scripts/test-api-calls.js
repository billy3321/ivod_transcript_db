#!/usr/bin/env node
// test-api-calls.js
// 直接測試 API 端點

const http = require('http');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
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

function logInfo(message) {
  log(`ℹ️  ${message}`, 'cyan');
}

function makeAPIRequest(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve({
            statusCode: res.statusCode,
            data: result
          });
        } catch (error) {
          resolve({
            statusCode: res.statusCode,
            data: data,
            parseError: error.message
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('請求超時'));
    });

    req.end();
  });
}

async function testAPIEndpoints() {
  console.log('🔍 測試 API 端點');
  console.log('='.repeat(50));

  const testCases = [
    {
      description: '測試委員會搜尋 - 「社會福利」(應觸發通用搜尋)',
      path: '/api/ivods?committee=社會福利'
    },
    {
      description: '測試委員會搜尋 - 「教育文化」(應觸發通用搜尋)', 
      path: '/api/ivods?committee=教育文化'
    },
    {
      description: '測試發言人搜尋 - 「完整」(應觸發通用搜尋)',
      path: '/api/ivods?speaker=完整'
    },
    {
      description: '測試會議名稱搜尋 - 「財政」(應觸發通用搜尋)',
      path: '/api/ivods?meeting_name=財政'
    },
    {
      description: '測試混合搜尋 - 「q + committee」(應觸發通用搜尋)',
      path: '/api/ivods?q=立法院&committee=社會福利'
    },
    {
      description: '測試一般搜尋 - 「完整會議」(不觸發通用搜尋)',
      path: '/api/ivods?q=完整會議'
    }
  ];

  for (const testCase of testCases) {
    logInfo(`\n${testCase.description}:`);
    logInfo(`路徑: ${testCase.path}`);
    
    try {
      const result = await makeAPIRequest(testCase.path);
      
      if (result.statusCode === 200) {
        logSuccess(`API 呼叫成功 (狀態碼: ${result.statusCode})`);
        
        if (result.data && typeof result.data === 'object') {
          const { data, total } = result.data;
          logInfo(`找到 ${data ? data.length : 0} 筆結果 (總共 ${total || 0} 筆)`);
          
          if (data && data.length > 0) {
            data.slice(0, 2).forEach((item, index) => {
              logInfo(`  ${index + 1}. [${item.ivod_id}] ${item.title || '無標題'}`);
              if (item.speaker_name) logInfo(`     發言人: ${item.speaker_name}`);
              if (item.committee_names) logInfo(`     委員會: ${JSON.stringify(item.committee_names)}`);
              if (item.meeting_name) logInfo(`     會議: ${item.meeting_name.substring(0, 50)}...`);
            });
          }
        } else {
          logError(`回應格式錯誤: ${JSON.stringify(result.data).substring(0, 200)}`);
        }
      } else {
        logError(`API 呼叫失敗 (狀態碼: ${result.statusCode})`);
        if (result.parseError) {
          logError(`解析錯誤: ${result.parseError}`);
        }
        logError(`回應: ${JSON.stringify(result.data).substring(0, 200)}`);
      }
    } catch (error) {
      logError(`請求失敗: ${error.message}`);
    }
  }
  
  console.log('\n說明：');
  logInfo('✅ 當搜尋參數包含 speaker、meeting_name 或 committee 時，');
  logInfo('   API 會自動使用通用搜尋 (LIKE 查詢) 進行部分匹配');
  logInfo('✅ 「社會福利」應該能搜尋到「社會福利及衛生環境委員會」');
  logInfo('✅ 「完整」應該能搜尋到「完整會議」');
  logInfo('✅ 「財政」應該能搜尋到財政委員會相關會議');
}

async function testHealthCheck() {
  logInfo('測試健康檢查端點...');
  
  try {
    const result = await makeAPIRequest('/api/health');
    if (result.statusCode === 200) {
      logSuccess('伺服器正常運行');
      return true;
    } else {
      logError(`健康檢查失敗: ${result.statusCode}`);
      return false;
    }
  } catch (error) {
    logError(`無法連接到伺服器: ${error.message}`);
    return false;
  }
}

async function main() {
  log('🔍 API 端點功能測試', 'bright');
  console.log('');
  
  const isHealthy = await testHealthCheck();
  if (!isHealthy) {
    logError('伺服器不可用，請確認 Next.js 開發伺服器正在運行 (npm run dev)');
    process.exit(1);
  }
  
  await testAPIEndpoints();
  
  console.log('\n測試完成');
}

if (require.main === module) {
  main().catch(error => {
    console.error('測試過程中發生錯誤:', error);
  });
}