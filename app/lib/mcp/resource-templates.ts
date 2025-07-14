import { logger } from '@/lib/logger';

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType?: string;
}

// 專注於立法院逐字稿查詢的資源模板
const RESOURCE_TEMPLATES: MCPResourceTemplate[] = [
  {
    uriTemplate: "ivod://search/topic/{query}",
    name: "議題逐字稿查詢",
    description: "根據特定議題關鍵字查詢立法院相關討論逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://search/legislator/{name}",
    name: "立委發言查詢",
    description: "查詢特定立委的發言紀錄和逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://search/meeting/{meeting_name}",
    name: "會議逐字稿查詢",
    description: "根據會議名稱或類型查詢相關會議逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://search/committee/{committee}",
    name: "委員會逐字稿查詢", 
    description: "查詢特定委員會的會議討論逐字稿",
    mimeType: "text/markdown"
  },
  {
    uriTemplate: "ivod://transcript/full/{ivod_id}",
    name: "完整會議逐字稿",
    description: "取得特定 IVOD ID 的完整會議逐字稿內容",
    mimeType: "text/markdown"
  }
];

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
  const paramPattern = /\{([^}]+)\}/g;
  const paramNames: string[] = [];
  
  // 提取參數名稱
  let match;
  while ((match = paramPattern.exec(uriTemplate)) !== null) {
    paramNames.push(match[1]);
  }
  
  // 構建匹配正則表達式
  const regexPattern = uriTemplate.replace(paramPattern, '([^/]+)');
  const regex = new RegExp(`^${regexPattern}$`);
  
  // 匹配實際 URI
  const uriMatch = uri.match(regex);
  if (!uriMatch) {
    return null;
  }
  
  // 構建參數對象
  const params: Record<string, string> = {};
  paramNames.forEach((name, index) => {
    params[name] = decodeURIComponent(uriMatch[index + 1]);
  });
  
  return params;
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
  return `# "${topic}" 相關立法院討論查詢

使用以下工具查詢「${topic}」在立法院的相關討論：

\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "${topic}",
    "transcription_source": "ly_only",
    "mode": "keyword_all_fields"
  }
}
\`\`\`

## 進階查詢選項

### 限定特定委員會討論
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "${topic}",
    "committees": ["相關委員會名稱"],
    "transcription_source": "ly_only"
  }
}
\`\`\`

### 限定時間範圍
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "query": "${topic}",
    "date_from": "2025-04-01",
    "date_to": "2025-06-30",
    "transcription_source": "ly_only"
  }
}
\`\`\`

**說明**: 此查詢將返回立法院中所有與「${topic}」相關的發言和討論逐字稿，讓 AI 能基於實際的立法院記錄回答問題。`;
}

async function generateLegislatorSearch(name: string): Promise<string> {
  return `# ${name} 立委發言紀錄查詢

使用以下工具查詢 ${name} 立委的發言紀錄：

\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "speakers": ["${name}"],
    "transcription_source": "ly_only"
  }
}
\`\`\`

## 特定議題發言查詢

### 查詢特定議題的發言
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "speakers": ["${name}"],
    "query": "議題關鍵字",
    "transcription_source": "ly_only"
  }
}
\`\`\`

### 查詢特定時期發言
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "speakers": ["${name}"],
    "date_from": "2025-04-01",
    "date_to": "2025-06-30",
    "transcription_source": "ly_only"
  }
}
\`\`\`

**說明**: 此查詢將返回 ${name} 立委在立法院的所有發言逐字稿，讓 AI 能基於實際發言記錄回答關於該立委的問題。`;
}

async function generateMeetingSearch(meetingName: string): Promise<string> {
  return `# "${meetingName}" 會議逐字稿查詢

使用以下工具查詢「${meetingName}」相關的會議逐字稿：

\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "meeting_name": "${meetingName}",
    "transcription_source": "ly_only"
  }
}
\`\`\`

## 結合其他條件查詢

### 特定議題的會議討論
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "meeting_name": "${meetingName}",
    "query": "議題關鍵字",
    "transcription_source": "ly_only"
  }
}
\`\`\`

### 特定時間範圍的會議
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "meeting_name": "${meetingName}",
    "date_from": "2025-04-01",
    "date_to": "2025-06-30",
    "transcription_source": "ly_only"
  }
}
\`\`\`

**說明**: 此查詢將返回所有「${meetingName}」類型會議的逐字稿，讓 AI 能基於實際會議記錄回答相關問題。`;
}

async function generateCommitteeSearch(committee: string): Promise<string> {
  return `# ${committee} 會議逐字稿查詢

使用以下工具查詢 ${committee} 的會議討論逐字稿：

\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "committees": ["${committee}"],
    "transcription_source": "ly_only"
  }
}
\`\`\`

## 特定議題查詢

### 查詢委員會對特定議題的討論
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "committees": ["${committee}"],
    "query": "議題關鍵字",
    "transcription_source": "ly_only"
  }
}
\`\`\`

### 查詢特定立委在委員會的發言
\`\`\`json
{
  "tool": "search_transcripts",
  "arguments": {
    "committees": ["${committee}"],
    "speakers": ["立委姓名"],
    "transcription_source": "ly_only"
  }
}
\`\`\`

**說明**: 此查詢將返回 ${committee} 所有會議的逐字稿，讓 AI 能基於實際委員會討論記錄回答問題。`;
}

async function generateFullTranscript(ivodId: string): Promise<string> {
  return `# 完整會議逐字稿 (IVOD ID: ${ivodId})

使用以下工具取得完整的會議逐字稿：

\`\`\`json
{
  "tool": "get_meeting_transcript",
  "arguments": {
    "ivod_id": ${ivodId},
    "transcript_type": "ly_only"
  }
}
\`\`\`

## 其他版本選項

### 自動選擇最佳版本 (優先立法院版)
\`\`\`json
{
  "tool": "get_meeting_transcript",
  "arguments": {
    "ivod_id": ${ivodId},
    "transcript_type": "auto"
  }
}
\`\`\`

### 僅取得AI處理版本
\`\`\`json
{
  "tool": "get_meeting_transcript",
  "arguments": {
    "ivod_id": ${ivodId},
    "transcript_type": "ai_only"
  }
}
\`\`\`

**說明**: 此工具將返回完整的會議逐字稿內容，包含所有發言人的完整發言記錄，讓 AI 能基於完整的會議內容回答詳細問題。

**建議**: 使用 \`ly_only\` 可取得最精確的立法院官方逐字稿。`;
}