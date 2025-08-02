#!/usr/bin/env node

const fs = require('fs');

/**
 * 修復測試檔案中的無效日期格式
 */

function fixTestDates(filePath) {
  console.log(`正在修復 ${filePath} 的日期格式...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: Fix simple date format
  const simpleDatePattern = /date: '2022-01-01'/g;
  if (content.match(simpleDatePattern)) {
    content = content.replace(simpleDatePattern, "date: '2022-01-01T09:00:00+08:00'");
    modified = true;
    console.log(`  - 修復了簡單日期格式`);
  }

  // Pattern 2: Fix date: '2022-01-02'
  const date2Pattern = /date: '2022-01-02'/g;
  if (content.match(date2Pattern)) {
    content = content.replace(date2Pattern, "date: '2022-01-02T09:00:00+08:00'");
    modified = true;
    console.log(`  - 修復了 2022-01-02 日期格式`);
  }

  // Pattern 3: Add missing last_updated and meeting_time to mock data where they're missing
  const missingFieldsPattern = /(\s+)(ai_transcript: ['"][^'"]*['"](?:,)?\s*\n)(\s*)(ly_transcript: ['"][^'"]*['"](?:,)?\s*\n)?(\s*)((?:video_url|ivod_url): ['"][^'"]*['"](?:,)?\s*\n)?(\s*)\}/g;
  
  content = content.replace(missingFieldsPattern, (match, indent1, aiTranscript, indent2, lyTranscript, indent3, videoUrl, indent4, closeBrace) => {
    // Check if last_updated is already present
    if (match.includes('last_updated')) {
      return match;
    }
    
    const lastUpdated = `${indent1}last_updated: '2022-01-01T10:00:00+08:00',\n`;
    const meetingTime = `${indent1}meeting_time: '2022-01-01T09:00:00+08:00'\n`;
    
    return aiTranscript + 
           (lyTranscript || '') + 
           (videoUrl || '') +
           lastUpdated +
           meetingTime +
           indent4 + '}';
  });

  // Pattern 4: Add missing fields to data objects that are missing them
  const mockDataPattern = /(\s+data: \{[^}]*speaker_name: ['"][^'"]*['"][,]?\s*)((?:\s+committee_names: [^,]*[,]?\s*)*)((?:\s+video_length: ['"][^'"]*['"][,]?\s*)*)([^}]*?)(\s*\}[,]?\s*\})/g;
  
  content = content.replace(mockDataPattern, (match, beforeSpeaker, committees, videoLength, restFields, closeData) => {
    // Check if last_updated already exists
    if (match.includes('last_updated')) {
      return match;
    }
    
    // Only add if missing
    if (!restFields.includes('last_updated')) {
      const missingFields = `\n        last_updated: '2022-01-01T10:00:00+08:00',\n        meeting_time: '2022-01-01T09:00:00+08:00'`;
      restFields = restFields.replace(/(\s*)$/, missingFields + '$1');
    }
    
    return beforeSpeaker + committees + videoLength + restFields + closeData;
  });

  // Write file if modified
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${filePath} 修復完成`);
  } else {
    console.log(`ℹ️ ${filePath} 無需修改`);
  }
}

const testFile = '/Users/billy3321/git/cic/ivod_transcript_db/app/__tests__/pages/ivod/[id].test.tsx';

console.log('🔧 開始修復測試日期格式...\n');

if (fs.existsSync(testFile)) {
  fixTestDates(testFile);
} else {
  console.log(`⚠️ 檔案不存在: ${testFile}`);
}

console.log('\n🎉 測試日期格式修復完成！');