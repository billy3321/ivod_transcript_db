/**
 * 手動測試 VideoDownloader 組件的真實 M3U8 下載功能
 * 這個腳本會測試真實的 IVOD M3U8 網址是否可以正常解析和下載
 */

const https = require('https');
const http = require('http');

// 真實的 IVOD M3U8 網址
const REAL_IVOD_URL = 'https://ivod-lyvod.cdn.hinet.net/vod_1/_definst_/mp4:1MClips/23f1796b33c52784c3dfefaa5d0d58acca5ad61c677c192cf0a1ba4207db2e7e69935296c30cbcfd5ea18f28b6918d91.mp4/playlist.m3u8';

// 測試網址列表
const TEST_URLS = [
  {
    name: 'Real IVOD URL',
    url: REAL_IVOD_URL,
    expectedSegments: true
  },
  {
    name: 'Invalid M3U8 URL',
    url: 'https://example.com/invalid.m3u8',
    expectedSegments: false
  },
  {
    name: 'Non-M3U8 URL',
    url: 'https://example.com/video.mp4',
    expectedSegments: false
  }
];

// Helper function to make HTTP(S) requests
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IVOD-VideoDownloader-Test/1.0)'
      }
    };
    
    const req = client.get(url, options, (res) => {
      let data = '';
      
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
        return;
      }
      
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (15 seconds)'));
    });
  });
}

// Helper function to check URL availability (HEAD request)
function checkUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IVOD-VideoDownloader-Test/1.0)'
      }
    };
    
    const req = client.request(url, options, (res) => {
      resolve({
        statusCode: res.statusCode,
        contentLength: res.headers['content-length'],
        contentType: res.headers['content-type']
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout (10 seconds)'));
    });
    
    req.end();
  });
}

// 模擬 VideoDownloader 的 M3U8 解析邏輯
async function parseM3U8(m3u8Url) {
  try {
    const text = await fetchUrl(m3u8Url);
    const lines = text.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    
    // 解析相對路徑，轉換為絕對路徑
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    return lines.map(line => {
      if (line.startsWith('http')) {
        return line.trim();
      } else {
        return baseUrl + line.trim();
      }
    });
  } catch (err) {
    throw new Error(`無法解析M3U8播放列表: ${err.message}`);
  }
}

// 測試單個 M3U8 網址
async function testM3U8Url(testCase) {
  console.log(`\n🔍 測試: ${testCase.name}`);
  console.log(`📍 網址: ${testCase.url}`);
  
  try {
    // 1. 檢查 URL 格式
    if (!testCase.url.includes('.m3u8')) {
      console.log('❌ 不是 M3U8 格式的網址');
      return { success: false, reason: 'Invalid format' };
    }
    
    // 2. 測試網址可訪問性
    console.log('🔗 檢查網址可訪問性...');
    const headResult = await checkUrl(testCase.url);
    console.log(`✅ 網址可訪問 (狀態: ${headResult.statusCode}, 類型: ${headResult.contentType || '未知'})`);
    
    // 3. 下載和解析 M3U8 內容
    console.log('📥 下載 M3U8 內容...');
    const segmentUrls = await parseM3U8(testCase.url);
    console.log(`📊 找到 ${segmentUrls.length} 個影片片段`);
    
    if (segmentUrls.length === 0) {
      console.log('⚠️  播放列表中沒有影片片段');
      return { success: false, reason: 'No segments found' };
    }
    
    // 4. 顯示前幾個片段
    const showCount = Math.min(3, segmentUrls.length);
    for (let i = 0; i < showCount; i++) {
      console.log(`   🎬 片段 ${i + 1}: ${segmentUrls[i]}`);
    }
    
    if (segmentUrls.length > 3) {
      console.log(`   ... 還有 ${segmentUrls.length - 3} 個片段`);
    }
    
    // 5. 測試第一個片段的可訪問性
    console.log('🔗 測試第一個片段的可訪問性...');
    try {
      const segmentResult = await checkUrl(segmentUrls[0]);
      console.log(`✅ 第一個片段可訪問 (狀態: ${segmentResult.statusCode}, 大小: ${segmentResult.contentLength || '未知'} bytes)`);
    } catch (segError) {
      console.log(`⚠️  第一個片段無法訪問: ${segError.message}`);
    }
    
    // 6. 估算總下載大小（如果可能）
    if (segmentUrls.length > 0) {
      try {
        const sampleResult = await checkUrl(segmentUrls[0]);
        if (sampleResult.contentLength) {
          const estimatedTotal = parseInt(sampleResult.contentLength) * segmentUrls.length;
          const estimatedMB = (estimatedTotal / (1024 * 1024)).toFixed(2);
          console.log(`📏 估算總大小: 約 ${estimatedMB} MB`);
        }
      } catch (err) {
        console.log('📏 無法估算總大小');
      }
    }
    
    console.log(`✅ M3U8 解析成功！可以進行下載。`);
    return { 
      success: true, 
      segmentCount: segmentUrls.length,
      segmentUrls: segmentUrls.slice(0, 3) // 只返回前3個作為示例
    };
    
  } catch (error) {
    console.log(`❌ 測試失敗: ${error.message}`);
    return { success: false, reason: error.message };
  }
}

// 主測試函數
async function runVideoDownloadTests() {
  console.log('=== VideoDownloader M3U8 下載功能測試 ===');
  console.log('這個腳本會測試真實的 IVOD M3U8 網址是否可以正常解析和下載\n');
  
  const results = [];
  
  for (const testCase of TEST_URLS) {
    const result = await testM3U8Url(testCase);
    results.push({
      name: testCase.name,
      url: testCase.url,
      ...result
    });
    
    // 在測試之間暫停一下
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // 總結測試結果
  console.log('\n📋 測試結果總結:');
  console.log('==========================================');
  
  results.forEach((result, index) => {
    console.log(`${index + 1}. ${result.name}: ${result.success ? '✅ 成功' : '❌ 失敗'}`);
    if (result.success) {
      console.log(`   - 找到 ${result.segmentCount} 個影片片段`);
    } else {
      console.log(`   - 失敗原因: ${result.reason}`);
    }
  });
  
  const successCount = results.filter(r => r.success).length;
  console.log(`\n🎯 測試完成: ${successCount}/${results.length} 個測試通過`);
  
  if (successCount > 0) {
    console.log('\n💡 VideoDownloader 組件應該能夠正常處理這些 M3U8 網址。');
    console.log('💡 用戶可以在瀏覽器中點擊下載按鈕來下載 IVOD 影片。');
  } else {
    console.log('\n⚠️  所有測試都失敗了，可能是網路問題或 IVOD 服務不可用。');
  }
  
  // 輸出前端測試建議
  console.log('\n🔧 前端測試建議:');
  console.log('1. 在瀏覽器中打開 IVOD 詳細頁面');
  console.log('2. 尋找有 video_url 的記錄');
  console.log('3. 點擊「下載影片」按鈕');
  console.log('4. 觀察下載進度和最終結果');
  console.log('5. 檢查下載的 .ts 檔案是否可以用 VLC 播放');
}

// 執行測試
runVideoDownloadTests().catch(console.error);