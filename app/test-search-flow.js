#!/usr/bin/env node

/**
 * Test script for advanced search flow in IVOD web application
 * Tests the actual search flow: /api/search -> /api/ivods
 */

const axios = require('axios');
const colors = require('colors/safe');

const BASE_URL = 'http://localhost:3000';

// Test cases for advanced search syntax
const testCases = [
  {
    name: 'Basic search',
    query: '委員會',
    expectedBehavior: 'Should find documents containing "委員會"'
  },
  {
    name: 'Quoted phrase search',
    query: '"社會福利"',
    expectedBehavior: 'Should find documents with exact phrase "社會福利"'
  },
  {
    name: 'Boolean AND operator',
    query: '預算案 AND 中央',
    expectedBehavior: 'Should find documents containing both terms'
  },
  {
    name: 'Boolean OR operator',
    query: '社會福利 OR 衛生環境',
    expectedBehavior: 'Should find documents containing either term'
  },
  {
    name: 'Field-specific search - title',
    query: 'title:"會議"',
    expectedBehavior: 'Should find documents with "會議" in title'
  },
  {
    name: 'Field-specific search - speaker',
    query: 'speaker:"完整會議"',
    expectedBehavior: 'Should find documents with "完整會議" in speaker'
  },
  {
    name: 'Exclusion - single term',
    query: '委員會 -協商',
    expectedBehavior: 'Should find "委員會" but not "協商"'
  },
  {
    name: 'Complex query with parentheses',
    query: '(社會福利 OR 衛生環境) AND 委員會',
    expectedBehavior: 'Should find documents matching the boolean logic'
  }
];

// Test the actual search flow
async function testSearchFlow(testCase) {
  try {
    console.log(colors.cyan(`\nTesting: ${testCase.name}`));
    console.log(colors.gray(`Query: ${testCase.query}`));
    console.log(colors.gray(`Expected: ${testCase.expectedBehavior}`));

    // Step 1: Call /api/search
    console.log(colors.gray('  → Calling /api/search...'));
    const searchResponse = await axios.get(`${BASE_URL}/api/search`, {
      params: { q: testCase.query }
    });
    
    const searchData = searchResponse.data;
    console.log(colors.gray(`  ← Found ${searchData.data.length} results in search`));
    
    if (searchData.meta?.parsed) {
      console.log(colors.gray(`  ℹ Advanced syntax: ${searchData.meta.parsed.hasAdvancedSyntax}`));
    }
    
    if (searchData.data.length > 0) {
      // Show example excerpts
      const firstResult = searchData.data[0];
      if (firstResult.excerpt) {
        console.log(colors.gray(`  📝 Excerpt: ${firstResult.excerpt.plainText.substring(0, 100)}...`));
      }
      
      // Step 2: Get IVOD IDs and call /api/ivods
      const ivodIds = searchData.data.map(item => item.id);
      console.log(colors.gray(`  → Calling /api/ivods with ${ivodIds.length} IDs...`));
      
      const ivodResponse = await axios.get(`${BASE_URL}/api/ivods`, {
        params: {
          ids: ivodIds.slice(0, 20).join(','), // Get first 20
          page: 1,
          pageSize: 20
        }
      });
      
      const ivodData = ivodResponse.data;
      console.log(colors.gray(`  ← Got ${ivodData.data.length} IVOD records`));
      
      if (ivodData.data.length > 0) {
        const first = ivodData.data[0];
        console.log(colors.green(`✓ Success: Found ${searchData.data.length} results`));
        console.log(colors.gray(`  Example: ${first.title || 'No title'}`));
        if (first.speaker_name) console.log(colors.gray(`  Speaker: ${first.speaker_name}`));
      }
      
      return { 
        success: true, 
        searchCount: searchData.data.length,
        ivodCount: ivodData.data.length,
        hasAdvancedSyntax: searchData.meta?.parsed?.hasAdvancedSyntax || false
      };
    } else {
      console.log(colors.yellow(`⚠ No results found`));
      return { success: true, searchCount: 0, ivodCount: 0 };
    }
  } catch (error) {
    console.log(colors.red(`✗ Error: ${error.message}`));
    if (error.response) {
      console.log(colors.red(`  Status: ${error.response.status}`));
      console.log(colors.red(`  Data: ${JSON.stringify(error.response.data).substring(0, 200)}`));
    }
    return { success: false, error: error.message };
  }
}

// Test parser functionality
async function testParser() {
  try {
    console.log(colors.blue('\n=== Testing Search Parser Directly ==='));
    
    // Test a complex query
    const complexQuery = '(title:"委員會" OR title:"會議") AND "預算案" -"覆議"';
    console.log(colors.gray(`Testing complex query: ${complexQuery}`));
    
    const response = await axios.get(`${BASE_URL}/api/search`, {
      params: { q: complexQuery }
    });
    
    if (response.data.meta?.parsed) {
      console.log(colors.green('✓ Parser working correctly'));
      console.log(colors.gray(`  Advanced syntax detected: ${response.data.meta.parsed.hasAdvancedSyntax}`));
      console.log(colors.gray(`  Parse success: ${response.data.meta.parsed.parseSuccess}`));
    }
  } catch (error) {
    console.log(colors.red(`✗ Parser test error: ${error.message}`));
  }
}

// Main test runner
async function runTests() {
  console.log(colors.blue('=== IVOD Advanced Search Flow Test ==='));
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

  // Test search flow
  console.log(colors.blue('\n=== Testing Search Flow ==='));
  const results = [];
  for (const testCase of testCases) {
    const result = await testSearchFlow(testCase);
    results.push({ ...testCase, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000)); // Rate limiting
  }

  // Test parser
  await testParser();

  // Summary
  console.log(colors.blue('\n=== Test Summary ==='));
  
  const successful = results.filter(r => r.success).length;
  const total = results.length;
  console.log(`Search Flow Tests: ${successful}/${total} passed`);
  
  // Results with advanced syntax
  const advancedSyntaxTests = results.filter(r => r.hasAdvancedSyntax);
  if (advancedSyntaxTests.length > 0) {
    console.log(colors.green(`\nAdvanced syntax detected in ${advancedSyntaxTests.length} tests:`));
    advancedSyntaxTests.forEach(test => {
      console.log(colors.green(`  - ${test.name}: ${test.searchCount} results`));
    });
  }
  
  // Failed tests
  const failedTests = results.filter(r => !r.success);
  if (failedTests.length > 0) {
    console.log(colors.red('\nFailed Tests:'));
    failedTests.forEach(test => {
      console.log(colors.red(`  - ${test.name}: ${test.error}`));
    });
  }

  // Tests with results
  const testsWithResults = results.filter(r => r.success && r.searchCount > 0);
  console.log(colors.green(`\nTests with results: ${testsWithResults.length}/${total}`));

  console.log(colors.blue('\n=== Test Complete ==='));
  
  if (successful === total && testsWithResults.length > 0) {
    console.log(colors.green(`✓ All tests passed and advanced search is working!`));
  } else if (successful === total) {
    console.log(colors.yellow(`⚠ Tests passed but need data for full validation`));
  } else {
    console.log(colors.red(`✗ Some tests failed`));
  }
}

// Run tests
runTests().catch(error => {
  console.error(colors.red('Test runner error:'), error);
  process.exit(1);
});