const { PrismaClient } = require('@prisma/client');
const https = require('https');
const http = require('http');

// Import environment configuration and database environment logic
require('dotenv').config();
require('../lib/database-env');

// Helper function to make HTTP(S) requests
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IVOD-Test/1.0)'
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
      reject(new Error('Request timeout'));
    });
  });
}

// Helper function to check URL availability
function checkUrl(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const options = {
      method: 'HEAD',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; IVOD-Test/1.0)'
      }
    };
    
    const req = client.request(url, options, (res) => {
      resolve({
        statusCode: res.statusCode,
        contentLength: res.headers['content-length']
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    
    req.end();
  });
}

async function testVideoDownload() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== 測試真實 IVOD 影片下載功能 ===\n');
    
    // 1. 查詢有 video_url 的記錄
    console.log('🔍 正在查詢有影片網址的 IVOD 記錄...');
    const ivodsWithVideo = await prisma.iVODTranscript.findMany({
      where: {
        video_url: {
          not: null,
          contains: '.m3u8'
        }
      },
      select: {
        ivod_id: true,
        title: true,
        meeting_name: true,
        speaker_name: true,
        video_url: true,
        date: true
      },
      take: 5 // 只取前 5 筆
    });
    
    if (ivodsWithVideo.length === 0) {
      console.log('❌ 沒有找到包含 .m3u8 影片網址的記錄');
      return;
    }
    
    console.log(`✅ 找到 ${ivodsWithVideo.length} 筆有影片網址的記錄\n`);
    
    // 2. 測試每個影片網址
    for (let i = 0; i < ivodsWithVideo.length; i++) {
      const ivod = ivodsWithVideo[i];
      console.log(`📹 測試記錄 ${i + 1}/${ivodsWithVideo.length}:`);
      console.log(`   IVOD ID: ${ivod.ivod_id}`);
      console.log(`   標題: ${ivod.title || '無標題'}`);
      console.log(`   會議: ${ivod.meeting_name || '無會議名稱'}`);
      console.log(`   發言者: ${ivod.speaker_name || '無發言者'}`);
      console.log(`   日期: ${new Date(ivod.date).toLocaleDateString('zh-TW')}`);
      console.log(`   影片網址: ${ivod.video_url}`);
      
      // 測試 M3U8 連結可訪問性
      try {
        console.log('   🔗 測試影片網址連通性...');
        const m3u8Content = await fetchUrl(ivod.video_url);
        console.log(`   ✅ 影片網址可訪問，內容長度: ${m3u8Content.length} 字符`);
        
        // 解析 M3U8 內容
        const lines = m3u8Content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
        console.log(`   📊 M3U8 播放列表包含 ${lines.length} 個影片片段`);
        
        if (lines.length > 0) {
          console.log(`   🎬 第一個片段: ${lines[0]}`);
          console.log(`   🎬 最後一個片段: ${lines[lines.length - 1]}`);
          
          // 測試第一個片段的可訪問性
          const firstSegmentUrl = lines[0].startsWith('http') 
            ? lines[0] 
            : ivod.video_url.substring(0, ivod.video_url.lastIndexOf('/') + 1) + lines[0];
          
          console.log('   🔗 測試第一個片段連通性...');
          try {
            const segmentResult = await checkUrl(firstSegmentUrl);
            console.log(`   ✅ 第一個片段可訪問 (狀態: ${segmentResult.statusCode}, 大小: ${segmentResult.contentLength || '未知'} bytes)`);
          } catch (segError) {
            console.log(`   ⚠️  第一個片段無法訪問: ${segError.message}`);
          }
        }
        
      } catch (error) {
        console.log(`   ❌ 網路錯誤: ${error.message}`);
      }
      
      console.log(''); // 空行分隔
    }
    
    // 3. 生成測試數據
    console.log('📋 生成前端測試數據...');
    const testData = ivodsWithVideo.map(ivod => ({
      ivod_id: ivod.ivod_id,
      video_url: ivod.video_url,
      title: ivod.title,
      meeting_name: ivod.meeting_name,
      speaker_name: ivod.speaker_name,
      date: ivod.date
    }));
    
    console.log('```json');
    console.log(JSON.stringify(testData, null, 2));
    console.log('```\n');
    
    console.log('✅ 真實 IVOD 影片下載功能測試完成');
    
  } catch (error) {
    console.error('❌ 測試過程中發生錯誤:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 執行測試
testVideoDownload();