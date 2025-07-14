import { logger } from '@/lib/logger';
import { listResourceTemplates, parseTemplateUri, generateTemplateContent } from './resource-templates';

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text: string;
}

// 可用資源列表
export const AVAILABLE_RESOURCES: MCPResource[] = [
  {
    uri: "ivod://usage-guide",
    name: "IVOD 搜尋使用指南",
    description: "詳細說明如何使用 IVOD 逐字稿搜尋功能的完整指南",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://search-examples",
    name: "搜尋範例集",
    description: "常用的搜尋查詢範例，包含立委、委員會、話題搜尋等",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://api-reference",
    name: "API 參考文檔",
    description: "search_transcripts 和 get_meeting_transcript 工具的詳細參數說明",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://data-structure",
    name: "資料結構說明",
    description: "IVOD 資料庫結構和逐字稿格式的詳細說明",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://best-practices", 
    name: "搜尋最佳實踐",
    description: "如何優化搜尋查詢、提高搜尋效果的建議和技巧",
    mimeType: "text/markdown"
  }
];

// 列出所有可用資源
export async function listResources(): Promise<MCPResource[]> {
  logger.info('MCP resources list requested');
  return AVAILABLE_RESOURCES;
}

// 讀取特定資源內容
export async function readResource(uri: string): Promise<ResourceContent> {
  logger.info('MCP resource read requested', { metadata: { uri } });

  // 首先檢查是否為模板 URI
  const templates = await listResourceTemplates();
  for (const template of templates) {
    const params = parseTemplateUri(uri, template.uriTemplate);
    if (params) {
      // 這是一個模板 URI，生成動態內容
      logger.info('Generating template content', { metadata: { uri, template: template.uriTemplate, params } });
      const text = await generateTemplateContent(template.uriTemplate, params);
      return {
        uri,
        mimeType: template.mimeType || 'text/markdown',
        text
      };
    }
  }

  // 檢查靜態資源是否存在
  const resource = AVAILABLE_RESOURCES.find(r => r.uri === uri);
  if (!resource) {
    throw new Error(`Resource not found: ${uri}`);
  }

  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    
    // 映射 URI 到檔案名
    const fileMap: Record<string, string> = {
      'ivod://usage-guide': 'usage-guide.md',
      'ivod://search-examples': 'search-examples.md',
      'ivod://api-reference': 'api-reference.md',
      'ivod://data-structure': 'data-structure.md',
      'ivod://best-practices': 'best-practices.md'
    };

    const filename = fileMap[uri];
    if (!filename) {
      throw new Error(`No file mapping for URI: ${uri}`);
    }

    const filePath = path.join(process.cwd(), 'lib', 'mcp', 'resource-content', filename);
    const text = await fs.readFile(filePath, 'utf-8');

    return {
      uri,
      mimeType: resource.mimeType,
      text
    };
  } catch (error: any) {
    logger.error('Failed to read resource file', { 
      metadata: { uri, error: error.message } 
    });
    
    throw new Error(`Resource content unavailable: ${uri} - ${error.message}`);
  }
}