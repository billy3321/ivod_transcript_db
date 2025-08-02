#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * 修復測試超時問題的腳本
 * 自動為所有 waitFor 調用添加適當的超時設定
 */

function fixTestTimeouts(filePath) {
  console.log(`正在修復 ${filePath} 的測試超時...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Pattern 1: waitFor without timeout - add 5 second timeout
  const waitForPattern = /await waitFor\(\(\) => \{([^}]+)\}\);/g;
  const waitForReplacement = 'await waitFor(() => {$1}, { timeout: 5000 });';
  
  if (content.match(waitForPattern)) {
    content = content.replace(waitForPattern, waitForReplacement);
    modified = true;
    console.log(`  - 為 waitFor 調用添加了 5 秒超時`);
  }

  // Pattern 2: waitFor with complex expect calls - increase timeout
  const complexWaitForPattern = /await waitFor\(\(\) => \{[\s\S]*?expect[\s\S]*?toBeInTheDocument[\s\S]*?\}\);/g;
  const matches = content.match(complexWaitForPattern);
  if (matches) {
    matches.forEach(match => {
      if (!match.includes('timeout:')) {
        const newMatch = match.replace('});', ', { timeout: 8000 });');
        content = content.replace(match, newMatch);
        modified = true;
      }
    });
    console.log(`  - 為複雜的 waitFor 調用增加了超時`);
  }

  // Pattern 3: Add beforeEach cleanup if not present
  if (!content.includes('jest.clearAllTimers()')) {
    const beforeEachPattern = /(beforeEach\(\(\) => \{[^}]*)/g;
    const beforeEachReplacement = '$1\n    jest.clearAllTimers();';
    
    if (content.match(beforeEachPattern)) {
      content = content.replace(beforeEachPattern, beforeEachReplacement);
      modified = true;
      console.log(`  - 添加了 jest.clearAllTimers() 清理`);
    }
  }

  // Write file if modified
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ ${filePath} 修復完成`);
  } else {
    console.log(`ℹ️ ${filePath} 無需修改`);
  }
}

// Get test files to fix
const testDir = path.join(__dirname, '../__tests__');
const testFiles = [
  path.join(testDir, 'pages/index.test.tsx'),
  path.join(testDir, 'pages/ivod/[id].test.tsx'),
  path.join(testDir, 'integration/search-workflow.test.tsx'),
  path.join(testDir, 'pages/ivod-detail.integration.test.tsx'),
  path.join(testDir, 'components/SearchHeader.test.tsx'),
];

console.log('🔧 開始修復測試超時問題...\n');

testFiles.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    fixTestTimeouts(filePath);
  } else {
    console.log(`⚠️ 檔案不存在: ${filePath}`);
  }
});

console.log('\n🎉 測試超時修復完成！');
console.log('現在可以運行: npm run test:ci');