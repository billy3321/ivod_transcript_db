#!/usr/bin/env node
// test-prisma-json-contains.js
// 測試 Prisma JSON 欄位的 contains 操作

const { PrismaClient } = require('@prisma/client');
const { setupDatabaseUrl } = require('../lib/database-url');
require('dotenv').config();

// Setup DATABASE_URL
setupDatabaseUrl();

async function testPrismaJSONContains() {
  console.log('🔍 測試 Prisma JSON 欄位的 contains 操作');
  console.log('='.repeat(60));
  
  const prisma = new PrismaClient();
  
  try {
    await prisma.$connect();
    
    console.log('測試 1: 使用 contains 搜尋「社會福利」');
    try {
      const results1 = await prisma.iVODTranscript.findMany({
        where: {
          committee_names: { contains: '社會福利' }
        },
        select: {
          ivod_id: true,
          committee_names: true
        }
      });
      
      console.log(`✅ 找到 ${results1.length} 筆結果`);
      results1.forEach(r => console.log(`  [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
    } catch (error) {
      console.log(`❌ 錯誤: ${error.message}`);
    }
    
    console.log('\n測試 2: 使用 contains 搜尋「教育文化」');
    try {
      const results2 = await prisma.iVODTranscript.findMany({
        where: {
          committee_names: { contains: '教育文化' }
        },
        select: {
          ivod_id: true,
          committee_names: true
        }
      });
      
      console.log(`✅ 找到 ${results2.length} 筆結果`);
      results2.forEach(r => console.log(`  [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
    } catch (error) {
      console.log(`❌ 錯誤: ${error.message}`);
    }
    
    console.log('\n測試 3: 使用 contains 搜尋「委員會」');
    try {
      const results3 = await prisma.iVODTranscript.findMany({
        where: {
          committee_names: { contains: '委員會' }
        },
        select: {
          ivod_id: true,
          committee_names: true
        }
      });
      
      console.log(`✅ 找到 ${results3.length} 筆結果`);
      results3.forEach(r => console.log(`  [${r.ivod_id}] ${JSON.stringify(r.committee_names)}`));
    } catch (error) {
      console.log(`❌ 錯誤: ${error.message}`);
    }
    
  } catch (error) {
    console.error(`連線失敗: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  testPrismaJSONContains();
}