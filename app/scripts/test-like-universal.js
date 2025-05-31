#!/usr/bin/env node
// test-like-universal.js
// 測試通用 LIKE 搜尋是否適用於所有資料庫

const { PrismaClient } = require('@prisma/client');
const { setupDatabaseUrl, getDatabaseInfo } = require('../lib/database-url');
require('dotenv').config();

// Setup DATABASE_URL
setupDatabaseUrl();

async function testUniversalLikeSearch() {
  console.log('🔍 測試通用 LIKE 搜尋');
  console.log('='.repeat(50));
  
  const prisma = new PrismaClient();
  const dbInfo = getDatabaseInfo();
  
  console.log(`資料庫類型: ${dbInfo.type}`);
  
  try {
    await prisma.$connect();
    
    const testCases = [
      { search: '社會福利', description: '搜尋「社會福利」' },
      { search: '教育文化', description: '搜尋「教育文化」' },  
      { search: '教育及文化', description: '搜尋「教育及文化」' },
      { search: '委員會', description: '搜尋「委員會」' }
    ];
    
    for (const testCase of testCases) {
      console.log(`\n${testCase.description}:`);
      
      try {
        // 使用原始 SQL LIKE 查詢
        const results = await prisma.$queryRaw`
          SELECT ivod_id, committee_names 
          FROM ivod_transcripts 
          WHERE committee_names LIKE ${`%${testCase.search}%`}
          LIMIT 5
        `;
        
        if (results.length > 0) {
          console.log(`✅ 找到 ${results.length} 筆結果`);
          results.forEach(r => {
            console.log(`  [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`);
          });
        } else {
          console.log(`⚠️  沒有找到結果`);
        }
      } catch (error) {
        console.log(`❌ 錯誤: ${error.message}`);
      }
    }
    
    // 測試其他欄位的 LIKE 搜尋
    console.log('\n測試其他欄位:');
    
    try {
      const speakerResults = await prisma.$queryRaw`
        SELECT ivod_id, speaker_name 
        FROM ivod_transcripts 
        WHERE speaker_name LIKE ${'%完整%'}
        LIMIT 3
      `;
      
      console.log(`✅ 發言人搜尋 "完整": 找到 ${speakerResults.length} 筆結果`);
      speakerResults.forEach(r => {
        console.log(`  [${r.ivod_id}] ${r.speaker_name}`);
      });
    } catch (error) {
      console.log(`❌ 發言人搜尋錯誤: ${error.message}`);
    }
    
    try {
      const meetingResults = await prisma.$queryRaw`
        SELECT ivod_id, meeting_name 
        FROM ivod_transcripts 
        WHERE meeting_name LIKE ${'%財政%'}
        LIMIT 3
      `;
      
      console.log(`✅ 會議名稱搜尋 "財政": 找到 ${meetingResults.length} 筆結果`);
      meetingResults.forEach(r => {
        console.log(`  [${r.ivod_id}] ${r.meeting_name?.substring(0, 50)}...`);
      });
    } catch (error) {
      console.log(`❌ 會議名稱搜尋錯誤: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`連線失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testUniversalLikeSearch();
}