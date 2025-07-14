#!/usr/bin/env node

/**
 * MCP 連接測試和除錯工具
 * 幫助診斷 Claude Desktop 與 MCP 服務器之間的連接問題
 */

const https = require('https');
const http = require('http');

// 測試目標
const TARGETS = [
  {
    name: 'Local Development',
    url: 'http://localhost:3000/mcp',
    client: http
  },
  {
    name: 'Production Server', 
    url: 'https://ivod.billy3321.tw/mcp',
    client: https
  }
];

// 測試序列
const TEST_REQUESTS = [
  {
    name: 'Initialize',
    data: {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test-client', version: '1.0.0' }
      }
    }
  },
  {
    name: 'Tools List',
    data: {
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list'
    }
  },
  {
    name: 'Resources List',
    data: {
      jsonrpc: '2.0',
      id: 3,
      method: 'resources/list'
    }
  },
  {
    name: 'Search Test',
    data: {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'search_transcripts',
        arguments: {
          query: '預算',
          limit: 2
        }
      }
    }
  }
];

// 測試函數
async function testMCP(target, request) {
  return new Promise((resolve, reject) => {
    const url = new URL(target.url);
    const postData = JSON.stringify(request.data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'MCP-Test-Client/1.0'
      },
      timeout: 10000
    };

    const req = target.client.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonResponse = JSON.parse(responseData);
          resolve({
            success: true,
            status: res.statusCode,
            response: jsonResponse,
            rawResponse: responseData
          });
        } catch (error) {
          resolve({
            success: false,
            status: res.statusCode,
            error: 'Invalid JSON response',
            rawResponse: responseData
          });
        }
      });
    });

    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        code: error.code
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({
        success: false,
        error: 'Request timeout'
      });
    });

    req.write(postData);
    req.end();
  });
}

// 主要測試流程
async function runTests() {
  console.log('🧪 MCP Connection Diagnostic Tool');
  console.log('=====================================\n');

  for (const target of TARGETS) {
    console.log(`🎯 Testing: ${target.name}`);
    console.log(`📍 URL: ${target.url}`);
    console.log('─'.repeat(50));

    for (const request of TEST_REQUESTS) {
      process.stdout.write(`  ${request.name}... `);
      
      const result = await testMCP(target, request);
      
      if (result.success) {
        if (result.response.error) {
          console.log(`❌ RPC Error: ${result.response.error.message}`);
          console.log(`     Code: ${result.response.error.code}`);
        } else {
          console.log(`✅ Success`);
          if (request.name === 'Tools List' && result.response.result) {
            console.log(`     Found ${result.response.result.tools?.length || 0} tools`);
          }
          if (request.name === 'Search Test' && result.response.result) {
            const content = result.response.result.content?.[0]?.text;
            if (content) {
              const parsed = JSON.parse(content);
              console.log(`     Found ${parsed.results?.length || 0} search results`);
            }
          }
        }
      } else {
        console.log(`❌ Failed: ${result.error}`);
        if (result.code) {
          console.log(`     Error Code: ${result.code}`);
        }
        if (result.status) {
          console.log(`     HTTP Status: ${result.status}`);
        }
      }
    }
    
    console.log('');
  }

  console.log('🔧 Troubleshooting Tips:');
  console.log('─'.repeat(50));
  console.log('• If local tests fail: Make sure "npm run dev" is running');
  console.log('• If "Connection refused": Check if port 3000 is accessible');
  console.log('• If "Invalid JSON": Check server logs for errors');
  console.log('• If production fails: Check firewall and SSL certificate');
  console.log('• For Claude Desktop: Try different configuration options');
  console.log('');
  
  console.log('📝 Claude Desktop Configuration:');
  console.log('Copy one of these to your claude_desktop_config.json:');
  console.log('');
  console.log('Option 1 (Local):', JSON.stringify({
    mcpServers: {
      "ivod-transcript": {
        command: "curl",
        args: ["-X", "POST", "-H", "Content-Type: application/json", "-d", "@-", "http://localhost:3000/mcp"]
      }
    }
  }, null, 2));
  console.log('');
  console.log('Option 2 (Production):', JSON.stringify({
    mcpServers: {
      "ivod-transcript": {
        command: "curl", 
        args: ["-X", "POST", "-H", "Content-Type: application/json", "-d", "@-", "https://ivod.billy3321.tw/mcp"]
      }
    }
  }, null, 2));
}

// 運行測試
if (require.main === module) {
  runTests().catch(console.error);
}

module.exports = { testMCP, runTests };