/**
 * 測試串流式下載的記憶體使用情況
 */

const https = require('https');

const REAL_IVOD_URL = 'https://ivod-lyvod.cdn.hinet.net/vod_1/_definst_/mp4:1MClips/23f1796b33c52784c3dfefaa5d0d58acca5ad61c677c192cf0a1ba4207db2e7e69935296c30cbcfd5ea18f28b6918d91.mp4/playlist.m3u8';

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

async function parseM3U8(m3u8Url) {
  try {
    const text = await fetchUrl(m3u8Url);
    
    // 檢查是否是主播放列表
    const lines = text.split('\n').filter(line => line.trim());
    const m3u8Lines = lines.filter(line => line.includes('.m3u8') && !line.startsWith('#'));
    
    if (m3u8Lines.length > 0) {
      // 這是主播放列表，需要獲取子播放列表
      const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
      const subPlaylistUrl = m3u8Lines[0].startsWith('http') ? m3u8Lines[0] : baseUrl + m3u8Lines[0];
      return parseM3U8(subPlaylistUrl);
    }
    
    // 這是包含.ts片段的播放列表
    const segmentLines = lines.filter(line => line.trim() && !line.startsWith('#'));
    const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);
    
    return segmentLines.map(line => {
      if (line.startsWith('http')) {
        return line.trim();
      } else {
        return baseUrl + line.trim();
      }
    });
  } catch (err) {
    throw new Error('無法解析M3U8播放列表');
  }
}

function getMemoryUsage() {
  const usage = process.memoryUsage();
  return {
    rss: (usage.rss / 1024 / 1024).toFixed(2),
    heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2),
    heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2),
    external: (usage.external / 1024 / 1024).toFixed(2)
  };
}

async function simulateBatchDownload() {
  console.log('=== 串流式下載記憶體測試 ===\n');
  
  try {
    console.log('📋 初始記憶體使用:');
    const initialMemory = getMemoryUsage();
    console.log(`   RSS: ${initialMemory.rss} MB`);
    console.log(`   Heap Used: ${initialMemory.heapUsed} MB`);
    console.log(`   Heap Total: ${initialMemory.heapTotal} MB`);
    console.log('');

    // 解析M3U8
    console.log('🔍 解析M3U8播放列表...');
    const segmentUrls = await parseM3U8(REAL_IVOD_URL);
    console.log(`📊 找到 ${segmentUrls.length} 個影片片段`);
    
    const afterParseMemory = getMemoryUsage();
    console.log(`📋 解析後記憶體: Heap Used ${afterParseMemory.heapUsed} MB`);
    console.log('');

    // 模擬分批下載（只下載前5個片段作為測試）
    const BATCH_SIZE = 5;
    const testSegments = segmentUrls.slice(0, 5);
    
    console.log(`📥 開始分批下載測試 (${testSegments.length} 個片段)...`);
    console.log(`   批次大小: ${BATCH_SIZE}`);
    console.log('');

    let totalBytes = 0;
    let successCount = 0;

    for (let i = 0; i < testSegments.length; i++) {
      const url = testSegments[i];
      console.log(`📦 下載片段 ${i + 1}/${testSegments.length}:`);
      console.log(`   URL: ${url.substring(url.lastIndexOf('/') + 1)}`);
      
      try {
        const beforeDownload = getMemoryUsage();
        
        const response = await new Promise((resolve, reject) => {
          const req = https.get(url, { timeout: 10000 }, resolve);
          req.on('error', reject);
          req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
          });
        });

        if (response.statusCode !== 200) {
          console.log(`   ❌ HTTP ${response.statusCode}`);
          continue;
        }

        // 模擬串流讀取
        let segmentSize = 0;
        const chunks = [];
        
        response.on('data', (chunk) => {
          chunks.push(chunk);
          segmentSize += chunk.length;
        });

        await new Promise((resolve) => {
          response.on('end', resolve);
        });

        // 合併chunk（模擬實際處理）
        const segmentBuffer = Buffer.concat(chunks);
        totalBytes += segmentBuffer.length;
        successCount++;

        const afterDownload = getMemoryUsage();
        console.log(`   ✅ 下載成功: ${(segmentBuffer.length / 1024 / 1024).toFixed(2)} MB`);
        console.log(`   📊 記憶體變化: ${beforeDownload.heapUsed} → ${afterDownload.heapUsed} MB`);
        console.log('');

        // 模擬處理間隔
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (err) {
        console.log(`   ❌ 下載失敗: ${err.message}`);
      }
    }

    console.log('📈 下載完成統計:');
    console.log(`   成功下載: ${successCount}/${testSegments.length} 個片段`);
    console.log(`   總大小: ${(totalBytes / 1024 / 1024).toFixed(2)} MB`);
    
    const finalMemory = getMemoryUsage();
    console.log(`   最終記憶體: Heap Used ${finalMemory.heapUsed} MB`);
    
    const memoryIncrease = parseFloat(finalMemory.heapUsed) - parseFloat(initialMemory.heapUsed);
    console.log(`   記憶體增加: ${memoryIncrease.toFixed(2)} MB`);
    
    // 計算記憶體效率
    const efficiency = totalBytes / (memoryIncrease * 1024 * 1024);
    console.log(`   記憶體效率: ${efficiency.toFixed(2)}x (下載的數據/記憶體增加)`);
    
    console.log('\n🎯 分析結果:');
    if (memoryIncrease < totalBytes / 1024 / 1024 / 2) {
      console.log('✅ 記憶體使用效率良好，串流式下載有效減少記憶體壓力');
    } else {
      console.log('⚠️  記憶體使用仍然較高，可能需要進一步優化');
    }
    
    // 估算完整下載的記憶體需求
    const estimatedFullMemory = (memoryIncrease / testSegments.length) * segmentUrls.length;
    console.log(`📊 估算完整下載記憶體需求: ${estimatedFullMemory.toFixed(2)} MB`);
    
    if (estimatedFullMemory < 500) {
      console.log('✅ 完整下載記憶體需求在安全範圍內');
    } else {
      console.log('⚠️  完整下載可能需要較多記憶體，建議進一步優化批次大小');
    }

  } catch (error) {
    console.log(`❌ 測試失敗: ${error.message}`);
  }
}

simulateBatchDownload();