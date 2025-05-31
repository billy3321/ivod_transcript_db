#!/usr/bin/env node
// es-test.js
// Test Elasticsearch connection and functionality

const { Client } = require('@elastic/elasticsearch');
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
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60));
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

async function testElasticsearchConnection() {
  logSection('Elasticsearch 連線測試');

  // Check if ES is disabled
  const esEnabled = process.env.ENABLE_ELASTICSEARCH !== 'false';
  if (!esEnabled) {
    logWarning('Elasticsearch 已被 ENABLE_ELASTICSEARCH=false 停用');
    return false;
  }

  // Get ES configuration
  const esConfig = {
    host: process.env.ES_HOST || 'localhost',
    port: parseInt(process.env.ES_PORT || '9200'),
    scheme: process.env.ES_SCHEME || 'http',
    user: process.env.ES_USER,
    pass: process.env.ES_PASS,
    index: process.env.ES_INDEX || 'ivod_transcripts'
  };

  logInfo(`連線設定: ${esConfig.scheme}://${esConfig.host}:${esConfig.port}`);
  logInfo(`索引名稱: ${esConfig.index}`);
  if (esConfig.user) {
    logInfo(`認證: 使用者名稱 ${esConfig.user}`);
  }

  try {
    // Create Elasticsearch client
    const clientConfig = {
      node: `${esConfig.scheme}://${esConfig.host}:${esConfig.port}`
    };

    if (esConfig.user && esConfig.pass) {
      clientConfig.auth = {
        username: esConfig.user,
        password: esConfig.pass
      };
    }

    const client = new Client(clientConfig);

    // Test 1: Basic connection
    logInfo('測試 1: 基本連線...');
    const pingResult = await client.ping();
    if (pingResult.statusCode === 200) {
      logSuccess('Elasticsearch 連線成功');
    } else {
      logError(`連線失敗，狀態碼: ${pingResult.statusCode}`);
      return false;
    }

    // Test 2: Cluster info
    logInfo('測試 2: 叢集資訊...');
    const clusterInfo = await client.info();
    logSuccess(`Elasticsearch 版本: ${clusterInfo.body.version.number}`);
    logSuccess(`叢集名稱: ${clusterInfo.body.cluster_name}`);

    // Test 3: Check if index exists
    logInfo('測試 3: 檢查索引是否存在...');
    const indexExists = await client.indices.exists({ index: esConfig.index });
    if (indexExists.statusCode === 200) {
      logSuccess(`索引 "${esConfig.index}" 存在`);
      
      // Get index stats
      const indexStats = await client.indices.stats({ index: esConfig.index });
      const docCount = indexStats.body.indices[esConfig.index]?.total?.docs?.count || 0;
      logSuccess(`索引包含 ${docCount} 筆文件`);
    } else {
      logWarning(`索引 "${esConfig.index}" 不存在`);
    }

    // Test 4: Test search functionality
    logInfo('測試 4: 搜尋功能測試...');
    try {
      const searchResult = await client.search({
        index: esConfig.index,
        body: {
          query: { match_all: {} },
          size: 1
        }
      });
      
      const totalHits = searchResult.body.hits.total.value || searchResult.body.hits.total;
      logSuccess(`搜尋功能正常，總共 ${totalHits} 筆文件`);
      
      if (searchResult.body.hits.hits.length > 0) {
        const sampleDoc = searchResult.body.hits.hits[0];
        logInfo(`範例文件 ID: ${sampleDoc._id}`);
        if (sampleDoc._source.title) {
          logInfo(`範例標題: ${sampleDoc._source.title.substring(0, 50)}...`);
        }
      }
    } catch (searchError) {
      if (searchError.meta && searchError.meta.statusCode === 404) {
        logWarning('索引不存在，無法測試搜尋功能');
      } else {
        logError(`搜尋測試失敗: ${searchError.message}`);
        return false;
      }
    }

    // Test 5: Test Chinese analyzer
    logInfo('測試 5: 中文分析器測試...');
    try {
      const analyzeResult = await client.indices.analyze({
        index: esConfig.index,
        body: {
          analyzer: 'chinese_analyzer',
          text: '立法院會議記錄'
        }
      });
      
      if (analyzeResult.body.tokens && analyzeResult.body.tokens.length > 0) {
        logSuccess('中文分析器工作正常');
        logInfo(`分詞結果: ${analyzeResult.body.tokens.map(t => t.token).join(', ')}`);
      } else {
        logWarning('中文分析器可能無法正常工作');
      }
    } catch (analyzeError) {
      logWarning(`中文分析器測試失敗: ${analyzeError.message}`);
    }

    logSuccess('所有 Elasticsearch 測試完成');
    return true;

  } catch (error) {
    logError(`Elasticsearch 連線錯誤: ${error.message}`);
    
    if (error.code === 'ECONNREFUSED') {
      logError('連線被拒絕，請確認 Elasticsearch 服務是否運行');
    } else if (error.code === 'ENOTFOUND') {
      logError('找不到主機，請檢查 ES_HOST 設定');
    } else if (error.statusCode === 401) {
      logError('認證失敗，請檢查 ES_USER 和 ES_PASS 設定');
    }
    
    return false;
  }
}

async function testSearchAPIIntegration() {
  logSection('搜尋 API 整合測試');

  try {
    // Test if we can import the elastic client
    const elasticPath = '../lib/elastic';
    logInfo('測試 Elasticsearch 客戶端匯入...');
    
    try {
      const elastic = require(elasticPath);
      logSuccess('Elasticsearch 客戶端匯入成功');
    } catch (importError) {
      logError(`無法匯入 Elasticsearch 客戶端: ${importError.message}`);
      return false;
    }

    // Test environment variables
    logInfo('檢查環境變數設定...');
    const requiredVars = ['ES_HOST', 'ES_PORT', 'ES_INDEX'];
    let allVarsSet = true;

    requiredVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        logSuccess(`${varName} = ${value}`);
      } else {
        logWarning(`${varName} 未設定（將使用預設值）`);
      }
    });

    const optionalVars = ['ES_SCHEME', 'ES_USER', 'ES_PASS', 'ENABLE_ELASTICSEARCH'];
    optionalVars.forEach(varName => {
      const value = process.env[varName];
      if (value) {
        logInfo(`${varName} = ${varName.includes('PASS') ? '[已設定]' : value}`);
      }
    });

    logSuccess('搜尋 API 整合測試完成');
    return true;

  } catch (error) {
    logError(`搜尋 API 整合測試失敗: ${error.message}`);
    return false;
  }
}

function displayRecommendations(esWorking) {
  logSection('建議與設定');

  if (!esWorking) {
    log('如果 Elasticsearch 無法連線，你可以：', 'yellow');
    console.log('');
    log('1. 停用 Elasticsearch：', 'bright');
    log('   在 .env 檔案中設定: ENABLE_ELASTICSEARCH=false', 'cyan');
    console.log('');
    log('2. 安裝並啟動 Elasticsearch：', 'bright');
    log('   - Docker: docker run -d -p 9200:9200 -e "discovery.type=single-node" elasticsearch:7.17.0', 'cyan');
    log('   - 本地安裝: 請參考 Elasticsearch 官方文件', 'cyan');
    console.log('');
    log('3. 檢查網路設定：', 'bright');
    log('   - 確認 ES_HOST 和 ES_PORT 設定正確', 'cyan');
    log('   - 檢查防火牆設定', 'cyan');
    console.log('');
  } else {
    log('Elasticsearch 運作正常！', 'green');
    console.log('');
    log('建議的效能優化：', 'bright');
    log('- 定期運行 ./ivod_es.py 更新搜尋索引', 'cyan');
    log('- 監控索引大小和搜尋效能', 'cyan');
    log('- 考慮設定索引別名用於零停機更新', 'cyan');
    console.log('');
  }

  log('相關指令：', 'bright');
  log('- npm run es:test  # 執行此測試', 'cyan');
  log('- npm run db:test  # 測試資料庫連線', 'cyan');
  log('- npm run dev      # 啟動開發伺服器', 'cyan');
}

async function main() {
  console.log('');
  log('🔍 IVOD Transcript DB - Elasticsearch 連線測試', 'bright');
  console.log('');

  const esWorking = await testElasticsearchConnection();
  await testSearchAPIIntegration();
  
  displayRecommendations(esWorking);

  console.log('\n' + '='.repeat(60));
  if (esWorking) {
    log('✅ 測試完成：Elasticsearch 連線正常', 'green');
  } else {
    log('❌ 測試完成：Elasticsearch 連線異常', 'red');
    log('💡 系統將自動使用資料庫搜尋作為備援', 'yellow');
  }
  console.log('='.repeat(60));

  process.exit(esWorking ? 0 : 1);
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    logError(`測試執行錯誤: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { testElasticsearchConnection, testSearchAPIIntegration };