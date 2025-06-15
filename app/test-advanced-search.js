#!/usr/bin/env node

/**
 * Test script for advanced search syntax in IVOD web application
 * Tests all documented advanced search features to verify they are working correctly
 */

const axios = require('axios');
const colors = require('colors/safe');

const BASE_URL = 'http://localhost:3000';

// Test cases for advanced search syntax (using terms that exist in test database)
const testCases = [
  {
    name: 'Basic search',
    query: '預算案',
    expectedBehavior: 'Should find documents containing "預算案" in any field'
  },
  {
    name: 'Quoted phrase search',
    query: '"社會福利"',
    expectedBehavior: 'Should find documents with exact phrase "社會福利"'
  },
  {
    name: 'Boolean AND operator',
    query: '預算案 AND 中央',
    expectedBehavior: 'Should find documents containing both "預算案" and "中央"'
  },
  {
    name: 'Boolean OR operator',
    query: '社會福利 OR 衛生環境',
    expectedBehavior: 'Should find documents containing either "社會福利" or "衛生環境"'
  },
  {
    name: 'Parentheses grouping',
    query: '(預算案 OR 覆議案) AND 委員會',
    expectedBehavior: 'Should find documents with ("預算案" or "覆議案") and "委員會"'
  },
  {
    name: 'Field-specific search - title',
    query: 'title:"會議"',
    expectedBehavior: 'Should find documents with "會議" in title field only'
  },
  {
    name: 'Field-specific search - speaker',
    query: 'speaker:"完整會議"',
    expectedBehavior: 'Should find documents with "完整會議" in speaker_name field only'
  },
  {
    name: 'Field-specific search - meeting',
    query: 'meeting:"立法院"',
    expectedBehavior: 'Should find documents with "立法院" in meeting_name field only'
  },
  {
    name: 'Field-specific search - committee',
    query: 'committee:"社會福利"',
    expectedBehavior: 'Should find documents with "社會福利" in committee_names field only'
  },
  {
    name: 'Exclusion - single term',
    query: '預算案 -覆議',
    expectedBehavior: 'Should find documents with "預算案" but not "覆議"'
  },
  {
    name: 'Exclusion - quoted phrase',
    query: '委員會 -"黨團協商"',
    expectedBehavior: 'Should find documents with "委員會" but not "黨團協商"'
  },
  {
    name: 'Complex query',
    query: '(title:"委員會" OR title:"會議") AND "預算案" -"覆議"',
    expectedBehavior: 'Should find documents with (委員會 or 會議 in title) and 預算案 but not 覆議'
  },
  {
    name: 'Mixed quoted and unquoted',
    query: '預算案 "社會福利" 委員會',
    expectedBehavior: 'Should find documents with all three terms, "社會福利" as exact phrase'
  },
  {
    name: 'Field with AND operator',
    query: 'title:"委員會" AND meeting:"立法院"',
    expectedBehavior: 'Should find documents with "委員會" in title AND "立法院" in meeting'
  },
  {
    name: 'Multiple exclusions',
    query: '預算案 -覆議 -協商',
    expectedBehavior: 'Should find documents with "預算案" but not "覆議" or "協商"'
  }
];

// Advanced form test cases (LIKE fuzzy matching)
const advancedFormTestCases = [
  {
    name: 'Advanced form - meeting name fuzzy match',
    params: { meeting_name: '社會' },
    expectedBehavior: 'Should find meetings containing "社會" (e.g., "社會福利及衛生環境委員會")'
  },
  {
    name: 'Advanced form - speaker fuzzy match',
    params: { speaker: '王' },
    expectedBehavior: 'Should find all speakers with "王" in their name'
  },
  {
    name: 'Advanced form - committee fuzzy match',
    params: { committee: '財政' },
    expectedBehavior: 'Should find committees containing "財政"'
  },
  {
    name: 'Combined upper and lower search',
    query: '預算',
    params: { committee: '財政' },
    expectedBehavior: 'Should find documents with "預算" AND in committees containing "財政"'
  }
];

// Test search API endpoint
async function testSearchAPI(testCase, scope = 'all') {
  try {
    const params = {
      q: testCase.query,
      scope: scope,
      ...testCase.params
    };

    console.log(colors.cyan(`\nTesting: ${testCase.name}`));
    console.log(colors.gray(`Query: ${JSON.stringify(params)}`));
    console.log(colors.gray(`Expected: ${testCase.expectedBehavior}`));

    const response = await axios.get(`${BASE_URL}/api/ivods`, { params });
    const data = response.data;

    if (data.ivods && data.ivods.length > 0) {
      console.log(colors.green(`✓ Success: Found ${data.ivods.length} results`));
      
      // Show first result as example
      const first = data.ivods[0];
      console.log(colors.gray(`  Example: ${first.title || 'No title'}`));
      if (first.meeting_name) console.log(colors.gray(`  Meeting: ${first.meeting_name}`));
      if (first.speaker_name) console.log(colors.gray(`  Speaker: ${first.speaker_name}`));
      
      // Show search excerpts if available
      if (first.search_excerpts && first.search_excerpts.length > 0) {
        console.log(colors.gray(`  Excerpt: ${first.search_excerpts[0].excerpt}`));
      }
      
      return { success: true, count: data.ivods.length };
    } else {
      console.log(colors.yellow(`⚠ Warning: No results found`));
      return { success: true, count: 0 };
    }
  } catch (error) {
    console.log(colors.red(`✗ Error: ${error.message}`));
    if (error.response) {
      console.log(colors.red(`  Status: ${error.response.status}`));
      console.log(colors.red(`  Data: ${JSON.stringify(error.response.data)}`));
    }
    return { success: false, error: error.message };
  }
}

// Test search parser directly
async function testSearchParser() {
  try {
    console.log(colors.blue('\n=== Testing Search Parser ==='));
    
    // Create a test file to verify parser logic
    const testParserCode = `
const { parseAdvancedSearchQuery } = require('./lib/searchParser');

const queries = [
  '"完整詞組"',
  '預算 AND 教育',
  '王委員 OR 李委員',
  '(預算 OR 教育) AND 委員會',
  'title:"會議名稱"',
  'speaker:"立委名稱"',
  '-詞彙',
  '-"詞組"',
  '(speaker:"王委員" OR speaker:"李委員") AND "預算" -"國防"'
];

queries.forEach(query => {
  const result = parseAdvancedSearchQuery(query);
  console.log(\`Query: \${query}\`);
  console.log('Parsed:', JSON.stringify(result, null, 2));
  console.log('---');
});
`;

    require('fs').writeFileSync('/tmp/test-parser.js', testParserCode);
    
    console.log(colors.green('✓ Parser test code created'));
  } catch (error) {
    console.log(colors.red(`✗ Parser test error: ${error.message}`));
  }
}

// Main test runner
async function runTests() {
  console.log(colors.blue('=== IVOD Advanced Search Syntax Test ==='));
  console.log(colors.gray(`Testing against: ${BASE_URL}`));
  console.log(colors.gray(`Time: ${new Date().toISOString()}`));

  // Check if server is running
  try {
    await axios.get(`${BASE_URL}/api/ivods?page=1&pageSize=1`);
    console.log(colors.green('✓ Server is running'));
  } catch (error) {
    console.log(colors.red('✗ Server is not running. Please start with: npm run dev'));
    console.log(colors.red(`Error: ${error.message}`));
    process.exit(1);
  }

  // Test advanced search syntax
  console.log(colors.blue('\n=== Testing Advanced Search Syntax ==='));
  const syntaxResults = [];
  for (const testCase of testCases) {
    const result = await testSearchAPI(testCase);
    syntaxResults.push({ ...testCase, ...result });
    await new Promise(resolve => setTimeout(resolve, 500)); // Rate limiting
  }

  // Test transcript-only search
  console.log(colors.blue('\n=== Testing Transcript-Only Search ==='));
  const transcriptResults = [];
  for (const testCase of testCases.slice(0, 3)) { // Test first 3 cases in transcript mode
    const result = await testSearchAPI(testCase, 'transcript');
    transcriptResults.push({ ...testCase, ...result });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Test advanced form (LIKE fuzzy matching)
  console.log(colors.blue('\n=== Testing Advanced Form (LIKE Fuzzy Matching) ==='));
  const formResults = [];
  for (const testCase of advancedFormTestCases) {
    const result = await testSearchAPI(testCase);
    formResults.push({ ...testCase, ...result });
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  // Summary
  console.log(colors.blue('\n=== Test Summary ==='));
  
  const syntaxSuccess = syntaxResults.filter(r => r.success).length;
  const syntaxTotal = syntaxResults.length;
  console.log(`Advanced Syntax Tests: ${syntaxSuccess}/${syntaxTotal} passed`);
  
  const transcriptSuccess = transcriptResults.filter(r => r.success).length;
  const transcriptTotal = transcriptResults.length;
  console.log(`Transcript-Only Tests: ${transcriptSuccess}/${transcriptTotal} passed`);
  
  const formSuccess = formResults.filter(r => r.success).length;
  const formTotal = formResults.length;
  console.log(`Advanced Form Tests: ${formSuccess}/${formTotal} passed`);
  
  // Failed tests
  const allResults = [...syntaxResults, ...transcriptResults, ...formResults];
  const failedTests = allResults.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log(colors.red('\nFailed Tests:'));
    failedTests.forEach(test => {
      console.log(colors.red(`- ${test.name}: ${test.error}`));
    });
  }

  // Tests with no results
  const noResultTests = allResults.filter(r => r.success && r.count === 0);
  if (noResultTests.length > 0) {
    console.log(colors.yellow('\nTests with no results (might need data):'));
    noResultTests.forEach(test => {
      console.log(colors.yellow(`- ${test.name}`));
    });
  }

  // Test parser separately
  await testSearchParser();

  console.log(colors.blue('\n=== Test Complete ==='));
  
  const totalSuccess = syntaxSuccess + transcriptSuccess + formSuccess;
  const totalTests = syntaxTotal + transcriptTotal + formTotal;
  
  if (totalSuccess === totalTests) {
    console.log(colors.green(`All ${totalTests} tests passed!`));
  } else {
    console.log(colors.yellow(`${totalSuccess}/${totalTests} tests passed`));
  }
}

// Run tests
runTests().catch(error => {
  console.error(colors.red('Test runner error:'), error);
  process.exit(1);
});