import { logger } from '@/lib/logger';
import { MCPResource, ResourceContent, MCPResourceTemplate } from './types';

// 專注於立法院逐字稿查詢的資源模板
const RESOURCE_TEMPLATES: MCPResourceTemplate[] = [
  {
    uriTemplate: "ivod://search/topic/{query}",
    name: "議題逐字稿查詢",
    title: "議題逐字稿查詢",
    description: "根據特定議題關鍵字查詢立法院相關討論逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://search/legislator/{name}",
    name: "立委發言查詢",
    title: "立委發言查詢",
    description: "查詢特定立委的發言紀錄和逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://search/meeting/{meeting_name}",
    name: "會議逐字稿查詢",
    title: "會議逐字稿查詢",
    description: "根據會議名稱或類型查詢相關會議逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://search/committee/{committee}",
    name: "委員會逐字稿查詢",
    title: "委員會逐字稿查詢", 
    description: "查詢特定委員會的會議討論逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://transcript/full/{ivod_id}",
    name: "完整會議逐字稿",
    title: "完整會議逐字稿",
    description: "取得特定 IVOD ID 的完整會議逐字稿內容",
    mimeType: "text/markdown"
  }
];

// 可用資源列表
export const AVAILABLE_RESOURCES: MCPResource[] = [
  {
    uri: "ivod://usage-guide",
    name: "IVOD 搜尋使用指南",
    title: "IVOD 搜尋使用指南",
    description: "詳細說明如何使用 IVOD 逐字稿搜尋功能的完整指南",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://search-examples",
    name: "搜尋範例集",
    title: "搜尋範例集",
    description: "常用的搜尋查詢範例，包含立委、委員會、話題搜尋等",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://api-reference",
    name: "API 參考文檔",
    title: "API 參考文檔",
    description: "search_transcripts 和 get_meeting_transcript 工具的詳細參數說明",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://data-structure",
    name: "資料結構說明",
    title: "資料結構說明",
    description: "IVOD 資料庫結構和逐字稿格式的詳細說明",
    mimeType: "text/markdown"
  },
  {
    uri: "ivod://best-practices", 
    name: "搜尋最佳實踐",
    title: "搜尋最佳實踐",
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
        name: template.name,
        title: template.title,
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
      name: resource.name,
      title: resource.title,
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

// 檢查資源是否存在
export async function checkResourceExists(uri: string): Promise<boolean> {
  logger.info('Checking if resource exists', { metadata: { uri } });
  
  // 檢查靜態資源
  if (AVAILABLE_RESOURCES.some(r => r.uri === uri)) {
    return true;
  }
  
  // 檢查模板 URI
  const templates = await listResourceTemplates();
  for (const template of templates) {
    if (parseTemplateUri(uri, template.uriTemplate)) {
      return true;
    }
  }
  
  return false;
}

export async function listResourceTemplates(): Promise<MCPResourceTemplate[]> {
  logger.info('MCP resource templates list requested');
  return RESOURCE_TEMPLATES;
}

export async function getResourceTemplate(uriTemplate: string): Promise<MCPResourceTemplate | null> {
  logger.info('MCP resource template requested', { metadata: { uriTemplate } });
  
  const template = RESOURCE_TEMPLATES.find(t => t.uriTemplate === uriTemplate);
  return template || null;
}

// 解析 URI 模板中的參數
export function parseTemplateUri(uri: string, uriTemplate: string): Record<string, string> | null {
  // 將 URI template 轉換為正則表達式
  // 為了避免 template 中其他字元被當成 regex metacharacter，先 escape，再把 \{name\} 替換成 capture group
  const paramPattern = /\{([^}]+)\}/g;
  const paramNames: string[] = [];

  // 提取參數名稱
  let match;
  while ((match = paramPattern.exec(uriTemplate)) !== null) {
    paramNames.push(match[1]);
  }

  // 1) 先把整個 template escape 成 regex literal
  const escapedTemplate = uriTemplate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 2) 把 escape 後的 \{name\} 還原成 capture group
  const regexPattern = escapedTemplate.replace(/\\\{[^}]+\\\}/g, '([^/]+)');
  const regex = new RegExp(`^${regexPattern}$`);

  // 匹配實際 URI
  const uriMatch = uri.match(regex);
  if (!uriMatch) {
    return null;
  }

  // 構建參數對象
  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    try {
      params[name] = decodeURIComponent(uriMatch[index + 1]);
    } catch {
      // decodeURIComponent 失敗時（malformed URI），保留 raw 值
      params[name] = uriMatch[index + 1];
    }
  });

  return params;
}

// 將任意字串安全嵌入 markdown 中（剝除可能破壞輸出結構的字元）
function sanitizeForMarkdown(value: string): string {
  return String(value)
    // 移除反引號避免跳出 code block
    .replace(/`/g, '')
    // 移除控制字元
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    // 防止把 markdown header / 區塊破壞掉
    .replace(/\n+/g, ' ')
    .trim()
    .slice(0, 200);
}

// 將字串安全嵌入 JSON 字串字面值內（去掉外層引號）
function sanitizeForJsonString(value: string): string {
  const safe = sanitizeForMarkdown(value);
  // 用 JSON.stringify 處理特殊字元（引號、反斜線等），再去掉外層 ""
  return JSON.stringify(safe).slice(1, -1);
}

// 根據模板和參數生成內容
export async function generateTemplateContent(
  uriTemplate: string, 
  params: Record<string, string>
): Promise<string> {
  const template = await getResourceTemplate(uriTemplate);
  if (!template) {
    throw new Error(`Resource template not found: ${uriTemplate}`);
  }
  
  switch (uriTemplate) {
    case "ivod://search/topic/{query}":
      return generateTopicSearch(params.query);
      
    case "ivod://search/legislator/{name}":
      return generateLegislatorSearch(params.name);
      
    case "ivod://search/meeting/{meeting_name}":
      return generateMeetingSearch(params.meeting_name);
      
    case "ivod://search/committee/{committee}":
      return generateCommitteeSearch(params.committee);
      
    case "ivod://transcript/full/{ivod_id}":
      return generateFullTranscript(params.ivod_id);
      
    default:
      throw new Error(`Template content generation not implemented: ${uriTemplate}`);
  }
}

// 專注於立法院逐字稿查詢的內容生成函數
async function generateTopicSearch(topic: string): Promise<string> {
  const md = sanitizeForMarkdown(topic);
  const js = sanitizeForJsonString(topic);
  return `# "${md}" 相關立法院討論查詢\n\n使用以下工具查詢「${md}」在立法院的相關討論：\n\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "query": "${js}",\n    "transcription_source": "ly_only",\n    "mode": "keyword_all_fields"\n  }\n}\n\`\`\`\n\n## 進階查詢選項\n\n### 限定特定委員會討論\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "query": "${js}",\n    "committees": ["相關委員會名稱"],\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n### 限定時間範圍\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "query": "${js}",\n    "date_from": "2025-04-01",\n    "date_to": "2025-06-30",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n**說明**: 此查詢將返回立法院中所有與「${md}」相關的發言和討論逐字稿，讓 AI 能基於實際的立法院記錄回答問題。`;
}

async function generateLegislatorSearch(name: string): Promise<string> {
  const md = sanitizeForMarkdown(name);
  const js = sanitizeForJsonString(name);
  return `# ${md} 立委發言紀錄查詢\n\n使用以下工具查詢 ${md} 立委的發言紀錄：\n\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "speakers": ["${js}"],\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n## 特定議題發言查詢\n\n### 查詢特定議題的發言\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "speakers": ["${js}"],\n    "query": "議題關鍵字",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n### 查詢特定時期發言\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "speakers": ["${js}"],\n    "date_from": "2025-04-01",\n    "date_to": "2025-06-30",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n**說明**: 此查詢將返回 ${md} 立委在立法院的所有發言逐字稿，讓 AI 能基於實際發言記錄回答關於該立委的問題。`;
}

async function generateMeetingSearch(meetingName: string): Promise<string> {
  const md = sanitizeForMarkdown(meetingName);
  const js = sanitizeForJsonString(meetingName);
  return `# "${md}" 會議逐字稿查詢\n\n使用以下工具查詢「${md}」相關的會議逐字稿：\n\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "meeting_name": "${js}",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n## 結合其他條件查詢\n\n### 特定議題的會議討論\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "meeting_name": "${js}",\n    "query": "議題關鍵字",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n### 特定時間範圍的會議\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "meeting_name": "${js}",\n    "date_from": "2025-04-01",\n    "date_to": "2025-06-30",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n**說明**: 此查詢將返回所有「${md}」類型會議的逐字稿，讓 AI 能基於實際會議記錄回答相關問題。`;
}

async function generateCommitteeSearch(committee: string): Promise<string> {
  const md = sanitizeForMarkdown(committee);
  const js = sanitizeForJsonString(committee);
  return `# ${md} 會議逐字稿查詢\n\n使用以下工具查詢 ${md} 的會議討論逐字稿：\n\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "committees": ["${js}"],\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n## 特定議題查詢\n\n### 查詢委員會對特定議題的討論\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "committees": ["${js}"],\n    "query": "議題關鍵字",\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n### 查詢特定立委在委員會的發言\n\`\`\`json\n{\n  "tool": "search_transcripts",\n  "arguments": {\n    "committees": ["${js}"],\n    "speakers": ["立委姓名"],\n    "transcription_source": "ly_only"\n  }\n}\n\`\`\`\n\n**說明**: 此查詢將返回 ${md} 所有會議的逐字稿，讓 AI 能基於實際委員會討論記錄回答問題。`;
}

async function generateFullTranscript(ivodId: string): Promise<string> {
  // ivod_id 必須是正整數，否則拒絕（避免把任意字串內插進 JSON）
  const parsed = parseInt(String(ivodId), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || String(parsed) !== String(ivodId).trim()) {
    throw new Error(`Invalid ivod_id: must be a positive integer, got "${ivodId}"`);
  }
  const safeId = parsed;
  return `# 完整會議逐字稿 (IVOD ID: ${safeId})\n\n使用以下工具取得完整的會議逐字稿：\n\n\`\`\`json\n{\n  "tool": "get_meeting_transcript",\n  "arguments": {\n    "ivod_id": ${safeId},\n    "transcript_type": "ly_only"\n  }\n}\n\`\`\`\n\n## 其他版本選項\n\n### 自動選擇最佳版本 (優先立法院版)\n\`\`\`json\n{\n  "tool": "get_meeting_transcript",\n  "arguments": {\n    "ivod_id": ${safeId},\n    "transcript_type": "auto"\n  }\n}\n\`\`\`\n\n### 僅取得AI處理版本\n\`\`\`json\n{\n  "tool": "get_meeting_transcript",\n  "arguments": {\n    "ivod_id": ${safeId},\n    "transcript_type": "ai_only"\n  }\n}\n\`\`\`\n\n**說明**: 此工具將返回完整的會議逐字稿內容，包含所有發言人的完整發言記錄，讓 AI 能基於完整的會議內容回答詳細問題。\n\n**建議**: 使用 \`ly_only\` 可取得最精確的立法院官方逐字稿。`;
}
