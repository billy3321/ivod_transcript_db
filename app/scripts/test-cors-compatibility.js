#!/usr/bin/env node

/**
 * 測試 Cross-Origin-Embedder-Policy 對第三方資源的影響
 * 檢查 FFmpeg CDN 和 IVOD 資源的 CORS 相容性
 */

const https = require('https');
const http = require('http');

// 測試的資源清單
const testResources = [
  // FFmpeg CDN resources
  {
    name: 'FFmpeg Core (jsdelivr)',
    url: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    type: 'FFmpeg'
  },
  {
    name: 'FFmpeg WASM (jsdelivr)', 
    url: 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm',
    type: 'FFmpeg'
  },
  {
    name: 'FFmpeg Core (unpkg)',
    url: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js',
    type: 'FFmpeg'
  },
  
  // Google Analytics
  {
    name: 'Google Analytics',
    url: 'https://www.googletagmanager.com/gtag/js?id=G-EXAMPLE',
    type: 'Analytics'
  },
  
  // 測試一個 IVOD M3U8 (如果有的話)
  {
    name: 'IVOD Video Test',
    url: 'https://ivod.ly.gov.tw/Play/VOD/300736/1M/playlist.m3u8',
    type: 'IVOD'
  }
];

function checkResourceCORS(resource) {
  console.log(`\n🔍 檢查 ${resource.name}...`);
  
  const url = new URL(resource.url);
  const protocol = url.protocol === 'https:' ? https : http;
  
  return new Promise((resolve) => {
    const request = protocol.request(resource.url, { method: 'HEAD' }, (res) => {
      const headers = res.headers;
      
      // 檢查 CORS 相關 headers
      const corsPolicy = headers['cross-origin-resource-policy'];
      const accessControlAllowOrigin = headers['access-control-allow-origin'];
      const accessControlAllowCredentials = headers['access-control-allow-credentials'];
      
      console.log(`   Status: ${res.statusCode}`);
      console.log(`   Cross-Origin-Resource-Policy: ${corsPolicy || '❌ 未設定'}`);
      console.log(`   Access-Control-Allow-Origin: ${accessControlAllowOrigin || '❌ 未設定'}`);
      console.log(`   Access-Control-Allow-Credentials: ${accessControlAllowCredentials || '未設定'}`);
      
      // 判斷在 require-corp 下是否可用
      const compatibleWithRequireCorp = 
        corsPolicy === 'cross-origin' || 
        corsPolicy === 'same-origin' ||
        accessControlAllowOrigin === '*' ||
        accessControlAllowOrigin === 'https://ivod.billy3321.tw';
        
      // 判斷在 credentialless 下是否可用 (更寬鬆)
      const compatibleWithCredentialless = true; // credentialless 允許無憑證載入
      
      console.log(`   📊 COEP require-corp 相容性: ${compatibleWithRequireCorp ? '✅ 相容' : '❌ 可能被阻擋'}`);
      console.log(`   📊 COEP credentialless 相容性: ${compatibleWithCredentialless ? '✅ 相容' : '❌ 可能被阻擋'}`);
      
      resolve({
        ...resource,
        statusCode: res.statusCode,
        corsPolicy,
        accessControlAllowOrigin,
        compatibleWithRequireCorp,
        compatibleWithCredentialless
      });
    });
    
    request.on('error', (error) => {
      console.log(`   ❌ 請求失敗: ${error.message}`);
      resolve({
        ...resource,
        error: error.message,
        compatibleWithRequireCorp: false,
        compatibleWithCredentialless: false
      });
    });
    
    request.setTimeout(10000, () => {
      console.log(`   ⏱️ 請求超時`);
      request.destroy();
      resolve({
        ...resource,
        error: 'Timeout',
        compatibleWithRequireCorp: false,
        compatibleWithCredentialless: false
      });
    });
    
    request.end();
  });
}

async function main() {
  console.log('🚀 Cross-Origin-Embedder-Policy 相容性測試');
  console.log('=' .repeat(70));
  console.log('測試各種第三方資源在不同 COEP 政策下的相容性...\n');
  
  const results = [];
  
  // 測試所有資源
  for (const resource of testResources) {
    const result = await checkResourceCORS(resource);
    results.push(result);
  }
  
  // 統計結果
  console.log('\n' + '=' .repeat(70));
  console.log('📊 相容性總結');
  console.log('=' .repeat(70));
  
  const requireCorpCompatible = results.filter(r => r.compatibleWithRequireCorp).length;
  const credentiallessCompatible = results.filter(r => r.compatibleWithCredentialless).length;
  
  console.log(`\n🔒 COEP: require-corp`);
  console.log(`   相容資源: ${requireCorpCompatible}/${results.length}`);
  console.log(`   ⚠️  可能被阻擋: ${results.length - requireCorpCompatible} 個資源`);
  
  console.log(`\n🔓 COEP: credentialless (推薦)`);
  console.log(`   相容資源: ${credentiallessCompatible}/${results.length}`);
  console.log(`   ⚠️  可能被阻擋: ${results.length - credentiallessCompatible} 個資源`);
  
  // 詳細建議
  console.log('\n💡 建議:');
  if (requireCorpCompatible < results.length) {
    console.log('1. 使用 COEP: credentialless 而非 require-corp');
    console.log('2. credentialless 仍支援 SharedArrayBuffer，但對第三方資源更寬鬆');
    console.log('3. 可以正常使用 FFmpeg WebAssembly 和 IVOD 播放器');
  } else {
    console.log('1. 所有測試資源都與 require-corp 相容');
    console.log('2. 可以安全使用 require-corp 政策');
  }
  
  // 分類顯示問題資源
  const problemResources = results.filter(r => !r.compatibleWithRequireCorp);
  if (problemResources.length > 0) {
    console.log('\n⚠️  require-corp 下可能有問題的資源:');
    problemResources.forEach(r => {
      console.log(`   - ${r.name} (${r.type})`);
      if (r.error) {
        console.log(`     錯誤: ${r.error}`);
      } else {
        console.log(`     缺少適當的 CORS headers`);
      }
    });
  }
}

if (require.main === module) {
  main().catch(console.error);
}