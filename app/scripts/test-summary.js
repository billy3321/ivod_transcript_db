#!/usr/bin/env node

/**
 * 測試摘要腳本
 * 運行測試並輸出簡潔的失敗項目摘要
 */

const { spawn, execSync } = require('child_process');
const colors = require('colors');
const cliProgress = require('cli-progress');
const path = require('path');

function runTestSummary(pattern = '') {
  // Step 1: Get the total number of test files
  const listTestsArgs = ['--listTests', '--json'];
  if (pattern) {
    listTestsArgs.push('--findRelatedTests', pattern);
  }

  let testFilePaths;
  try {
    const jestOutput = execSync(`npx jest ${listTestsArgs.join(' ')}`, { stdio: 'pipe', encoding: 'utf-8' });
    testFilePaths = JSON.parse(jestOutput);
  } catch (e) {
    console.error('❌ 無法獲取測試列表，請檢查 Jest 設定。'.red);
    const errorDetails = e.stderr ? e.stderr.toString() : e.toString();
    console.error(errorDetails.gray);
    process.exit(1);
  }

  const totalFiles = testFilePaths.length;

  if (totalFiles === 0) {
    console.log('🟡 找不到符合條件的測試檔案。'.yellow);
    process.exit(0);
  }

  // Step 2: Run the tests with the enhanced progress bar
  const jestArgs = [
    '--passWithNoTests',
    '--verbose',
    '--runInBand'
  ];
  
  if (pattern) {
    jestArgs.push('--testPathPattern', pattern);
  }

  console.log(`🧪 正在執行 ${totalFiles} 個測試檔案...`.cyan);
  
  const progressBar = new cliProgress.SingleBar({
    format: ' {bar} | {percentage}% | {tests} tests | {value}/{total} 檔案 | {file}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true,
    clearOnComplete: true,
    stopOnComplete: true,
  });
  
  let completedFiles = 0;
  let completedTestCases = 0;
  let currentFileName = "初始化中...";

  progressBar.start(totalFiles, 0, { file: currentFileName, tests: 0 });

  const jest = spawn('npx', ['jest', ...jestArgs], {
    stdio: ['inherit', 'pipe', 'pipe']
  });

  let output = '';
  let errorOutput = '';
  let startTime = Date.now();

  const processChunk = (chunk) => {
    // Count individual test cases (✓ or ✕)
    const testCaseMatches = chunk.match(/✓|✕/g);
    if (testCaseMatches) {
      completedTestCases += testCaseMatches.length;
    }

    // Check for file completion (PASS or FAIL)
    const lines = chunk.split('\n');
    let fileCompletedInChunk = false;
    for (const line of lines) {
        if (line.startsWith('PASS') || line.startsWith('FAIL')) {
            completedFiles++;
            const filePath = line.replace(/^(PASS|FAIL)\s+/, '').trim();
            currentFileName = path.basename(filePath);
            fileCompletedInChunk = true;
            // Update the bar position and text placeholders
            progressBar.update(completedFiles, {
                file: currentFileName,
                tests: completedTestCases
            });
        }
    }
    
    // If no file completed, still update the test count text
    if (!fileCompletedInChunk) {
        progressBar.update(completedFiles, {
            tests: completedTestCases,
            file: currentFileName
        });
    }
  };

  jest.stdout.on('data', (data) => {
    const chunk = data.toString();
    output += chunk;
    processChunk(chunk);
  });

  jest.stderr.on('data', (data) => {
    const chunk = data.toString();
    errorOutput += chunk;
    processChunk(chunk); // Jest sometimes logs PASS/FAIL to stderr
  });

  jest.on('close', (code) => {
    progressBar.stop();
    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    
    let failures = [];
    let testResults = {
      passed: 0,
      failed: 0,
      suites: 0,
      failedSuites: 0
    };
    
    const combinedOutput = output + '\n' + errorOutput;
    parseTestResults(combinedOutput, testResults, failures);
    
    if (failures.length > 0) {
      console.log('\n' + '='.repeat(60).cyan);
      console.log('📋 測試失敗摘要 (可直接複製給 Claude)'.cyan.bold);
      console.log('='.repeat(60).cyan);
      printSummary(testResults, failures, code);
    } else if (code === 0) {
        console.log('\n' + '='.repeat(60).green);
        console.log('✅ 所有測試都通過了！'.green.bold);
        console.log(`   總共 ${testResults.suites} 個測試套件, ${testResults.passed} 個測試項目`);
        console.log(`   耗時: ${totalTime}s`);
        console.log('='.repeat(60).green);
    } else {
      // Handle cases where there are no failures but exit code is non-zero
      console.log('\n' + '='.repeat(60).red);
      console.log('❌ 測試執行期間發生錯誤。'.red.bold);
      console.log(errorOutput.red);
      console.log('='.repeat(60).red);
    }
    process.exit(code);
  });
}

function groupFailuresByFile(failures) {
  const grouped = {};
  
  failures.forEach(failure => {
    const file = failure.suite || 'unknown';
    if (!grouped[file]) {
      grouped[file] = [];
    }
    grouped[file].push(failure);
  });
  
  return Object.entries(grouped).map(([file, tests]) => ({
    file,
    tests
  }));
}

function categorizeFailures(groupedFailures) {
  const warnings = [];
  const errors = [];
  
  groupedFailures.forEach(fileGroup => {
    const isWarning = fileGroup.tests.some(test => 
      test.test.includes('timeout') ||
      test.test.includes('slow') ||
      test.details.includes('Warning') ||
      test.details.includes('deprecated') ||
      test.details.includes('console.warn')
    );
    
    if (isWarning) {
      warnings.push(fileGroup);
    } else {
      errors.push(fileGroup);
    }
  });
  
  return { warnings, errors };
}

function parseTestResults(output, testResults, failures) {
  const lines = output.split('\n');
  let currentSuite = '';
  let inFailureSection = false;
  let currentFailure = '';
  
  for (const line of lines) {
    if (line.includes('PASS') || line.includes('FAIL')) {
      const match = line.match(/(PASS|FAIL)\s+(.+)/);
      if (match) {
        const [, status, suitePath] = match;
        currentSuite = suitePath.replace(__dirname + '/', '');
        testResults.suites++;
        
        if (status === 'FAIL') {
          testResults.failedSuites++;
        }
      }
    }
    
    if (line.includes('✕')) {
      const testName = line.replace(/\s*✕\s*/, '').trim();
      failures.push({
        suite: currentSuite,
        test: testName,
        details: ''
      });
    }
    
    if (line.includes('Tests:')) {
      const passedMatch = line.match(/(\d+)\s+passed/);
      const failedMatch = line.match(/(\d+)\s+failed/);
      
      if (passedMatch) testResults.passed = parseInt(passedMatch[1]);
      if (failedMatch) testResults.failed = parseInt(failedMatch[1]);
    }
    
    if (line.includes('●')) {
      inFailureSection = true;
      currentFailure = line.replace('●', '').trim();
    } else if (inFailureSection && line.trim() === '') {
      inFailureSection = false;
      currentFailure = '';
    } else if (inFailureSection && currentFailure) {
      if (failures.length > 0) {
        failures[failures.length - 1].details += line + '\n';
      }
    }
  }
}

function printSummary(testResults, failures, exitCode) {
  console.log('\n' + '='.repeat(60).yellow);
  console.log('📊 測試摘要 TEST SUMMARY'.yellow.bold);
  console.log('='.repeat(60).yellow);
  
  console.log('\n📈 統計：');
  console.log(`   測試套件：${testResults.suites} 個 (${testResults.failedSuites > 0 ? `${testResults.failedSuites} 失敗`.red : '全部通過'.green})`);
  console.log(`   測試項目：${testResults.passed + testResults.failed} 個 (${testResults.passed} 通過`.green + `, ${testResults.failed} 失敗`.red + ')');
  
  if (failures.length > 0) {
    const groupedFailures = groupFailuresByFile(failures);
    const { warnings, errors } = categorizeFailures(groupedFailures);
    
    if (warnings.length > 0) {
      console.log('\n⚠️  測試警告 (WARNINGS)：'.yellow.bold);
      console.log('-'.repeat(50).yellow);
      
      warnings.forEach((fileGroup) => {
        console.log(`\n📁 ${fileGroup.file}`.yellow.bold);
        fileGroup.tests.forEach((failure, testIndex) => {
          console.log(`   ${testIndex + 1}. ${failure.test}`.yellow);
          if (failure.details.trim()) {
            const shortDetails = failure.details.split('\n').slice(0, 2).join('\n');
            console.log(`      💡 ${shortDetails.substring(0, 80)}${shortDetails.length > 80 ? '...' : ''}`.gray);
          }
        });
      });
    }
    
    if (errors.length > 0) {
      console.log('\n❌ 測試錯誤 (ERRORS)：'.red.bold);
      console.log('-'.repeat(50).red);
      
      errors.forEach((fileGroup) => {
        console.log(`\n📁 ${fileGroup.file}`.red.bold);
        fileGroup.tests.forEach((failure, testIndex) => {
          console.log(`   ${testIndex + 1}. ${failure.test}`.red);
          if (failure.details.trim()) {
            const shortDetails = failure.details.split('\n').slice(0, 2).join('\n');
            console.log(`      💡 ${shortDetails.substring(0, 80)}${shortDetails.length > 80 ? '...' : ''}`.gray);
          }
        });
      });
    }
  }
  
  console.log('\n' + '='.repeat(60).yellow);
  
  if (failures.length > 0) {
    console.log('\n🔧 建議動作：'.cyan.bold);
    console.log('1. 複製上面的測試失敗清單');
    console.log('2. 貼給 Claude 請求修正');
    console.log('3. 若需要更詳細的錯誤訊息，可執行 npm run test:failures 查看詳細錯誤');
  }
}

// 從命令行參數取得測試模式
const args = process.argv.slice(2);
const pattern = args[0] || '';

runTestSummary(pattern);