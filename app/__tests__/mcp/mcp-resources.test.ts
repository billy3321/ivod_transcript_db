import { listResources, readResource, AVAILABLE_RESOURCES } from '@/lib/mcp/resources';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock dependencies
jest.mock('fs/promises');
jest.mock('path');
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn()
  }
}));

// Mock the resource template functions that are now part of resources.ts
jest.mock('@/lib/mcp/resources', () => {
  const actualResources = jest.requireActual('@/lib/mcp/resources');
  return {
    ...actualResources,
    listResourceTemplates: jest.fn(),
    parseTemplateUri: jest.fn(),
    generateTemplateContent: jest.fn()
  };
});

describe('MCP Resources Tests', () => {
  const mockFs = fs as jest.Mocked<typeof fs>;
  const mockPath = path as jest.Mocked<typeof path>;
  
  // Import the mocked functions
  const mockResources = require('@/lib/mcp/resources');

  beforeEach(() => {
    jest.clearAllMocks();
    mockPath.join.mockImplementation((...segments) => segments.join('/'));
    
    // Reset template mocks
    mockResources.listResourceTemplates.mockResolvedValue([]);
    mockResources.parseTemplateUri.mockReturnValue(null);
    mockResources.generateTemplateContent.mockResolvedValue('');
  });

  describe('listResources', () => {
    it('should return all available resources', async () => {
      const resources = await listResources();

      expect(resources).toEqual(AVAILABLE_RESOURCES);
      expect(resources).toHaveLength(5);
      
      // Check specific resources
      const usageGuide = resources.find(r => r.uri === 'ivod://usage-guide');
      expect(usageGuide).toBeDefined();
      expect(usageGuide?.name).toBe('IVOD 搜尋使用指南');
      expect(usageGuide?.mimeType).toBe('text/markdown');

      const searchExamples = resources.find(r => r.uri === 'ivod://search-examples');
      expect(searchExamples).toBeDefined();
      expect(searchExamples?.name).toBe('搜尋範例集');
    });

    it('should include all required resource properties', async () => {
      const resources = await listResources();

      resources.forEach(resource => {
        expect(resource).toHaveProperty('uri');
        expect(resource).toHaveProperty('name');
        expect(resource).toHaveProperty('description');
        expect(resource).toHaveProperty('mimeType');
        expect(resource.mimeType).toBe('text/markdown');
      });
    });
  });

  describe('readResource', () => {
    it('should successfully read existing resource file', async () => {
      const mockContent = '# IVOD 搜尋使用指南\n\n這是測試內容...';
      mockFs.readFile.mockResolvedValue(mockContent);

      const result = await readResource('ivod://usage-guide');

      expect(result).toEqual({
        uri: 'ivod://usage-guide',
        name: 'IVOD 搜尋使用指南',
        title: 'IVOD 搜尋使用指南',
        mimeType: 'text/markdown',
        text: mockContent
      });

      expect(mockPath.join).toHaveBeenCalledWith(
        expect.any(String),
        'lib',
        'mcp',
        'resource-content',
        'usage-guide.md'
      );
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('usage-guide.md'),
        'utf-8'
      );
    });

    it('should read all available resource types', async () => {
      const testCases = [
        { uri: 'ivod://usage-guide', filename: 'usage-guide.md' },
        { uri: 'ivod://search-examples', filename: 'search-examples.md' },
        { uri: 'ivod://api-reference', filename: 'api-reference.md' },
        { uri: 'ivod://data-structure', filename: 'data-structure.md' },
        { uri: 'ivod://best-practices', filename: 'best-practices.md' }
      ];

      for (const testCase of testCases) {
        mockFs.readFile.mockResolvedValue(`Content for ${testCase.filename}`);

        const result = await readResource(testCase.uri);

        expect(result.uri).toBe(testCase.uri);
        expect(result.mimeType).toBe('text/markdown');
        expect(result.text).toBe(`Content for ${testCase.filename}`);
        expect(mockPath.join).toHaveBeenCalledWith(
          expect.any(String),
          'lib',
          'mcp',
          'resource-content',
          testCase.filename
        );
      }
    });

    it('should throw error for unknown resource URI', async () => {
      await expect(readResource('ivod://unknown-resource')).rejects.toThrow(
        'Resource not found: ivod://unknown-resource'
      );

      expect(mockFs.readFile).not.toHaveBeenCalled();
    });

    it('should throw error when file reading fails', async () => {
      const fileError = new Error('ENOENT: no such file or directory');
      mockFs.readFile.mockRejectedValue(fileError);

      await expect(readResource('ivod://usage-guide')).rejects.toThrow(
        'Resource content unavailable: ivod://usage-guide - ENOENT: no such file or directory'
      );

      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should handle file permission errors', async () => {
      const permissionError = new Error('EACCES: permission denied');
      mockFs.readFile.mockRejectedValue(permissionError);

      await expect(readResource('ivod://usage-guide')).rejects.toThrow(
        'Resource content unavailable: ivod://usage-guide - EACCES: permission denied'
      );
    });

    it('should handle empty file content', async () => {
      mockFs.readFile.mockResolvedValue('');

      const result = await readResource('ivod://usage-guide');

      expect(result.text).toBe('');
      expect(result.uri).toBe('ivod://usage-guide');
      expect(result.mimeType).toBe('text/markdown');
    });

    it('should handle large file content', async () => {
      const largeContent = 'x'.repeat(100000); // 100KB content
      mockFs.readFile.mockResolvedValue(largeContent);

      const result = await readResource('ivod://usage-guide');

      expect(result.text).toBe(largeContent);
      expect(result.text.length).toBe(100000);
    });

    it('should handle UTF-8 content correctly', async () => {
      const utf8Content = '# 中文標題\n\n這是包含中文的內容 🎯';
      mockFs.readFile.mockResolvedValue(utf8Content);

      const result = await readResource('ivod://usage-guide');

      expect(result.text).toBe(utf8Content);
      expect(mockFs.readFile).toHaveBeenCalledWith(
        expect.any(String),
        'utf-8'
      );
    });
  });

  describe('Resource URI mapping', () => {
    it('should have correct URI to filename mapping', () => {
      const expectedMappings = {
        'ivod://usage-guide': 'usage-guide.md',
        'ivod://search-examples': 'search-examples.md',
        'ivod://api-reference': 'api-reference.md',
        'ivod://data-structure': 'data-structure.md',
        'ivod://best-practices': 'best-practices.md'
      };

      // Test each mapping by attempting to read (with mocked file system)
      Object.entries(expectedMappings).forEach(async ([uri, expectedFilename]) => {
        mockFs.readFile.mockResolvedValue('test content');
        
        await readResource(uri);
        
        expect(mockPath.join).toHaveBeenCalledWith(
          expect.any(String),
          'lib',
          'mcp',
          'resource-content',
          expectedFilename
        );
      });
    });

    it('should reject unmapped URIs', async () => {
      await expect(readResource('ivod://unmapped-resource')).rejects.toThrow(
        'Resource not found'
      );
    });
  });

  describe('AVAILABLE_RESOURCES constant', () => {
    it('should have exactly 5 resources', () => {
      expect(AVAILABLE_RESOURCES).toHaveLength(5);
    });

    it('should have all required URIs', () => {
      const expectedURIs = [
        'ivod://usage-guide',
        'ivod://search-examples',
        'ivod://api-reference',
        'ivod://data-structure',
        'ivod://best-practices'
      ];

      const actualURIs = AVAILABLE_RESOURCES.map(r => r.uri);
      expect(actualURIs).toEqual(expect.arrayContaining(expectedURIs));
    });

    it('should have meaningful descriptions', () => {
      AVAILABLE_RESOURCES.forEach(resource => {
        expect(resource.description.length).toBeGreaterThan(10);
        expect(resource.name.length).toBeGreaterThan(3);
      });
    });
  });

  describe('Template URI support', () => {
    it('should handle template URI for topic search', async () => {
      const actualUri = 'ivod://search/topic/交通';

      const result = await readResource(actualUri);

      expect(result).toMatchObject({
        uri: actualUri,
        name: '議題逐字稿查詢',
        title: '議題逐字稿查詢',
        mimeType: 'text/markdown'
      });
      
      // Check that content contains expected elements
      expect(result.text).toContain('交通');
      expect(result.text).toContain('search_transcripts');
      expect(result.text).toContain('立法院');
    });

    it('should handle URL encoded parameters in template URI', async () => {
      const encodedUri = 'ivod://search/topic/%E4%BA%A4%E9%80%9A'; // 交通 encoded

      const result = await readResource(encodedUri);

      expect(result.uri).toBe(encodedUri);
      expect(result.text).toContain('交通');
      expect(result.text).toContain('search_transcripts');
    });

    it('should handle multiple template types', async () => {
      const legislatorUri = 'ivod://search/legislator/沈伯洋';

      const result = await readResource(legislatorUri);

      expect(result.text).toContain('沈伯洋');
      expect(result.text).toContain('search_transcripts');
      expect(result.text).toContain('立委');
    });

    it('should fall back to static resources when no template matches', async () => {
      const staticUri = 'ivod://usage-guide';
      const mockContent = '# 使用指南\n靜態內容...';

      mockFs.readFile.mockResolvedValue(mockContent);

      const result = await readResource(staticUri);

      expect(result.uri).toBe(staticUri);
      expect(result.text).toBe(mockContent);
      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should handle complex query syntax in topic templates', async () => {
      // Test various complex query syntaxes
      const testCases = [
        {
          uri: 'ivod://search/topic/預算 AND 教育',
          expectedContains: ['預算 AND 教育', 'search_transcripts']
        },
        {
          uri: 'ivod://search/topic/王委員 OR 李委員',
          expectedContains: ['王委員 OR 李委員', 'search_transcripts']
        },
        {
          uri: 'ivod://search/topic/(預算 OR 教育) AND 委員會',
          expectedContains: ['(預算 OR 教育) AND 委員會', 'search_transcripts']
        },
        {
          uri: 'ivod://search/topic/"完整會議"',
          expectedContains: ['"完整會議"', 'search_transcripts']
        },
        {
          uri: 'ivod://search/topic/預算 -國防',
          expectedContains: ['預算 -國防', 'search_transcripts']
        }
      ];

      for (const testCase of testCases) {
        const result = await readResource(testCase.uri);
        
        expect(result.uri).toBe(testCase.uri);
        expect(result.mimeType).toBe('text/markdown');
        
        // Check that all expected content is present
        for (const expectedContent of testCase.expectedContains) {
          expect(result.text).toContain(expectedContent);
        }
        
        // Should contain proper JSON structure for MCP tool calls
        expect(result.text).toContain('```json');
        expect(result.text).toContain('"tool": "search_transcripts"');
        expect(result.text).toContain('"arguments"');
      }
    });
  });
});