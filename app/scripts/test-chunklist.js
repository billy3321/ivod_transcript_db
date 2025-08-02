/**
 * 測試 IVOD chunklist.m3u8 的實際內容
 */

const https = require('https');

const CHUNKLIST_URL = 'https://ivod-lyvod.cdn.hinet.net/vod_1/_definst_/mp4:1MClips/23f1796b33c52784c3dfefaa5d0d58acca5ad61c677c192cf0a1ba4207db2e7e69935296c30cbcfd5ea18f28b6918d91.mp4/chunklist.m3u8';

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const options = {
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IVOD-VideoDownloader-Test/1.0)'
      }
    };
    
    const req = https.get(url, options, (res) => {
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
      reject(new Error('Request timeout'));
    });
  });
}

async function testChunklist() {
  console.log('🔍 測試 IVOD chunklist.m3u8 內容...');
  console.log(`📍 網址: ${CHUNKLIST_URL}\n`);
  
  try {
    const content = await fetchUrl(CHUNKLIST_URL);
    console.log('📄 M3U8 內容:');
    console.log('='.repeat(50));
    console.log(content);
    console.log('='.repeat(50));
    
    // 解析影片片段
    const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
    console.log(`\n📊 找到 ${lines.length} 個影片片段:`);
    
    const baseUrl = CHUNKLIST_URL.substring(0, CHUNKLIST_URL.lastIndexOf('/') + 1);
    
    lines.forEach((line, index) => {
      const segmentUrl = line.startsWith('http') ? line : baseUrl + line;
      console.log(`   ${index + 1}. ${segmentUrl}`);
    });
    
    if (lines.length > 0) {
      // 測試第一個片段
      const firstSegment = lines[0].startsWith('http') ? lines[0] : baseUrl + lines[0];
      console.log(`\n🔗 測試第一個片段: ${firstSegment}`);
      
      try {
        const testReq = https.request(firstSegment, { method: 'HEAD', timeout: 10000 }, (res) => {
          console.log(`✅ 第一個片段可訪問:`);
          console.log(`   狀態: ${res.statusCode}`);
          console.log(`   大小: ${res.headers['content-length'] || '未知'} bytes`);
          console.log(`   類型: ${res.headers['content-type'] || '未知'}`);
          
          if (res.headers['content-length']) {
            const totalSize = parseInt(res.headers['content-length']) * lines.length;
            const totalMB = (totalSize / (1024 * 1024)).toFixed(2);
            console.log(`📏 估算總影片大小: 約 ${totalMB} MB`);
          }
          
          console.log('\n✅ VideoDownloader 應該能夠下載這些影片片段！');
        });
        
        testReq.on('error', (err) => {
          console.log(`❌ 無法訪問第一個片段: ${err.message}`);
        });
        
        testReq.on('timeout', () => {
          testReq.destroy();
          console.log('❌ 片段訪問超時');
        });
        
        testReq.end();
        
      } catch (err) {
        console.log(`❌ 測試片段時發生錯誤: ${err.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ 無法獲取 chunklist 內容: ${error.message}`);
  }
}

testChunklist();