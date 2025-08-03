#!/usr/bin/env node

/**
 * 測試 Cross-Origin-Isolation Headers 腳本
 * 驗證生產環境 FFmpeg WebAssembly 支援
 */

const https = require('https');
const http = require('http');

function testHeaders(url) {
  console.log(`🔍 檢查 ${url} 的 Cross-Origin-Isolation headers...`);
  
  const protocol = url.startsWith('https:') ? https : http;
  
  return new Promise((resolve, reject) => {
    const request = protocol.request(url, { method: 'HEAD' }, (res) => {
      const headers = res.headers;
      
      console.log('\n📊 相關 Headers:');
      console.log(`Cross-Origin-Embedder-Policy: ${headers['cross-origin-embedder-policy'] || '❌ 未設定'}`);
      console.log(`Cross-Origin-Opener-Policy: ${headers['cross-origin-opener-policy'] || '❌ 未設定'}`);
      console.log(`X-Frame-Options: ${headers['x-frame-options'] || '未設定'}`);
      console.log(`Server: ${headers['server'] || '未知'}`);
      
      // 檢查必要的 headers
      const hasCoep = headers['cross-origin-embedder-policy'] === 'require-corp';
      const hasCoop = headers['cross-origin-opener-policy'] === 'same-origin';
      
      console.log('\n🎯 FFmpeg WebAssembly 相容性檢查:');
      console.log(`✅ Cross-Origin-Embedder-Policy: ${hasCoep ? '✅ 正確' : '❌ 缺少或錯誤'}`);
      console.log(`✅ Cross-Origin-Opener-Policy: ${hasCoop ? '✅ 正確' : '❌ 缺少或錯誤'}`);
      
      if (hasCoep && hasCoop) {
        console.log('\n🎉 恭喜！你的站點已支援 FFmpeg WebAssembly！');
        console.log('💡 現在 window.crossOriginIsolated 應該會是 true');
        console.log('💡 影片下載功能中的 MP4 轉換應該可以正常工作');
      } else {
        console.log('\n⚠️  站點尚未完全支援 FFmpeg WebAssembly');
        console.log('🔧 請確認 Next.js headers 設定已部署');
        if (headers['server'] === 'cloudflare') {
          console.log('🔧 由於使用 Cloudflare，可能需要額外在 CF Dashboard 設定 headers');
        }
      }
      
      resolve({ hasCoep, hasCoop });
    });
    
    request.on('error', (error) => {
      console.error('❌ 請求失敗:', error.message);
      reject(error);
    });
    
    request.end();
  });
}

// 測試多個 URL
async function main() {
  const urls = [
    'https://ivod.billy3321.tw',
    'https://ivod.billy3321.tw/ivod/1234567'  // 測試內頁
  ];
  
  console.log('🚀 Cross-Origin-Isolation Headers 測試腳本');
  console.log('=' .repeat(60));
  
  for (const url of urls) {
    try {
      await testHeaders(url);
      console.log('\n' + '-'.repeat(60));
    } catch (error) {
      console.error(`測試 ${url} 失敗:`, error.message);
    }
  }
  
  console.log('\n📖 說明:');
  console.log('- require-corp: 需要明確設定 Cross-Origin-Resource-Policy');
  console.log('- same-origin: 僅允許同源彈出視窗');
  console.log('- 這些設定讓瀏覽器啟用 SharedArrayBuffer 以支援 FFmpeg');
  console.log('\n💡 如果 headers 未正確顯示，請：');
  console.log('1. 確認 next.config.js 變更已部署');
  console.log('2. 清除瀏覽器快取');
  console.log('3. 如使用 Cloudflare，檢查 Transform Rules 設定');
}

if (require.main === module) {
  main().catch(console.error);
}