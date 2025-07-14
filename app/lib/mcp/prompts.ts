import { logger } from '@/lib/logger';

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: MCPPromptArgument[];
  uriTemplate?: string;
}

export interface MCPPromptArgument {
  name: string;
  description: string;
  required: boolean;
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text';
    text: string;
  };
}

export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

const BASE_PROMPTS: Omit<MCPPrompt, 'uriTemplate'>[] = [
  {
    name: "search-topic-discussions",
    description: "查詢特定議題在立法院的討論記錄",
    arguments: [
      { name: "query", description: "議題關鍵字，例如：數位發展、交通安全", required: true }
    ],
  },
  {
    name: "search-topic-and-date-range-discussions",
    description: "查詢特定議題在立法院特定時間的討論記錄",
    arguments: [
      { name: "query", description: "議題關鍵字，例如：數位發展、交通安全", required: true },
      { name: "date_from", description: "起始時間，例如：2025-04-01", required: false },
      { name: "date_to", description: "終止時間，例如：2025-07-01", required: false }
    ],
  },
  {
    name: "find-legislator-statements",
    description: "查詢特定立委的發言和立場",
    arguments: [
      { name: "legislator_name", description: "立委姓名，例如：黃國昌", required: true },
      { name: "query", description: "特定議題關鍵字", required: false },
    ],
  },
  {
    name: "analyze-committee-discussions",
    description: "分析特定委員會的會議討論內容",
    arguments: [
      { name: "committee_name", description: "委員會名稱，例如：交通委員會", required: true },
      { name: "query", description: "關注議題，例如：交通建設", required: false },
    ],
  },
  {
    name: "get-meeting-details",
    description: "取得特定會議的完整逐字稿內容",
    arguments: [
      { name: "ivod_id", description: "IVOD會議ID，例如：123456", required: true },
    ],
  },
];

export async function listPrompts(): Promise<MCPPrompt[]> {
  logger.info('MCP prompts list requested');
  return BASE_PROMPTS.map(prompt => {
    const argTemplate = prompt.arguments
      ?.map(arg => `${arg.name}={${arg.name}}`)
      .join('&');
    const uriTemplate = `ivod://prompts/${prompt.name}${argTemplate ? `?${argTemplate}` : ''}`;
    return { ...prompt, uriTemplate };
  });
}

export async function getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
  logger.info('MCP prompt requested', { metadata: { name, args } });
  switch (name) {
    case "search-topic-discussions":
      return generateTopicSearchPrompt(args);
    case "search-topic-and-date-range-discussions":
      return generateTopicAndDateRangeSearchPrompt(args);
    case "find-legislator-statements":
      return generateLegislatorSearchPrompt(args);
    case "analyze-committee-discussions":
      return generateCommitteeAnalysisPrompt(args);
    case "get-meeting-details":
      return generateMeetingDetailsPrompt(args);
    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// --- 專注於立法院逐字稿查詢的 Prompt Generation Functions ---

function generateTopicSearchPrompt(args?: Record<string, string>): GetPromptResult {
  const query = args?.query || "議題關鍵字";

  const text = [
    `請查詢「**${query}**」在立法院的相關討論記錄，並基於實際的逐字稿內容回答相關問題。`,
    "",
    '**步驟1：查詢逐字稿資料**',
    "",
    '使用以下工具查詢相關討論：',
    '```json',
    '{',
    '  "tool": "search_transcripts",',
    '  "arguments": {',
    `    "query": "${query}",`,
    '    "transcription_source": "ly_only",',
    '    "mode": "keyword_all_fields"',
    '  }',
    '}',
    '```',
    "",
    '**步驟2：分析討論內容**',
    "",
    '根據查詢到的逐字稿，請分析：',
    '- 立法院對此議題的主要觀點和立場',
    '- 參與討論的主要立委和其發言重點',
    '- 相關的政策建議或法案內容',
    '- 爭議點和不同意見',
    "",
    '**注意事項**：',
    '- 僅基於實際查詢到的逐字稿內容回答',
    '- 引用具體的發言內容作為依據',
    '- 如果查無相關討論，請明確說明'
  ].join('\n');

  return {
    description: `查詢${query}在立法院的討論記錄`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

function generateTopicAndDateRangeSearchPrompt(args?: Record<string, string>): GetPromptResult {
  const query = args?.query || "議題關鍵字";
  const date_from = args?.date_from || "";
  const date_to = args?.date_to || "";

  const dateFilter = (date_from || date_to) ? `,
    "date_from": "${date_from || '2024-01-01'}",
    "date_to": "${date_to || '2024-12-31'}"` : '';

  const text = [
    `請查詢「**${query}**」在立法院於特定時間區間內的相關討論記錄，並基於實際的逐字稿內容回答相關問題。`,
    "",
    '**步驟1：查詢逐字稿資料**',
    "",
    '使用以下工具查詢相關討論：',
    '```json',
    '{',
    '  "tool": "search_transcripts",',
    '  "arguments": {',
    `    "query": "${query}",`,
    '    "transcription_source": "ly_only",',
    '    "mode": "keyword_all_fields"' + dateFilter,
    '  }',
    '}',
    '```',
    "",
    '**步驟2：分析討論內容**',
    "",
    '根據查詢到的逐字稿，請分析：',
    '- 立法院對此議題的主要觀點和立場',
    '- 參與討論的主要立委和其發言重點',
    '- 相關的政策建議或法案內容',
    '- 爭議點和不同意見',
    "",
    '**注意事項**：',
    '- 僅基於實際查詢到的逐字稿內容回答',
    '- 引用具體的發言內容作為依據',
    '- 如果查無相關討論，請明確說明'
  ].join('\n');

  return {
    description: `查詢${query}在立法院的討論記錄`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

function generateLegislatorSearchPrompt(args?: Record<string, string>): GetPromptResult {
  const legislatorName = args?.legislator_name || "立委姓名";
  const query = args?.query || "";

  const queryFilter = query ? `,
    "query": "${query}"` : '';

  const text = [
    `請查詢立委 **${legislatorName}** 在立法院的發言記錄${query ? `，特別是關於「${query}」的討論` : ''}，並基於實際的逐字稿內容回答相關問題。`,
    "",
    '**步驟1：查詢發言記錄**',
    "",
    '使用以下工具查詢該立委的發言：',
    '```json',
    '{',
    '  "tool": "search_transcripts",',
    '  "arguments": {',
    `    "speakers": ["${legislatorName}"],`,
    '    "transcription_source": "ly_only"' + queryFilter,
    '  }',
    '}',
    '```',
    "",
    '**步驟2：分析發言內容**',
    "",
    '根據查詢到的逐字稿，請分析：',
    '- 該立委的主要關注議題和政策立場',
    '- 具體的發言內容和觀點',
    '- 質詢風格和表現方式',
    '- 與其他立委的互動或辯論',
    "",
    '**注意事項**：',
    '- 僅基於實際查詢到的發言記錄回答',
    '- 直接引用該立委的原始發言',
    '- 如果查無相關發言，請明確說明'
  ].join('\n');

  return {
    description: `查詢${legislatorName}立委的發言記錄`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

function generateCommitteeAnalysisPrompt(args?: Record<string, string>): GetPromptResult {
  const committeeName = args?.committee_name || "委員會名稱";
  const query = args?.query || "";

  const queryFilter = query ? `,
    "query": "${query}"` : '';

  const text = [
    `請分析 **${committeeName}** 的會議討論內容${query ? `，特別是關於「${query}」的討論` : ''}，並基於實際的逐字稿內容提供分析。`,
    "",
    '**步驟1：查詢委員會討論記錄**',
    "",
    '使用以下工具查詢委員會會議：',
    '```json',
    '{',
    '  "tool": "search_transcripts",',
    '  "arguments": {',
    `    "committees": ["${committeeName}"],`,
    '    "transcription_source": "ly_only"' + queryFilter,
    '  }',
    '}',
    '```',
    "",
    '**步驟2：分析會議內容**',
    "",
    '根據查詢到的逐字稿，請分析：',
    '- 委員會討論的主要議題和法案',
    '- 參與討論的立委和其發言重點',
    '- 重要的決議或結論',
    '- 爭議性問題和不同觀點',
    "",
    '**注意事項**：',
    '- 僅基於實際查詢到的會議記錄回答',
    '- 引用具體的討論內容和發言',
    '- 如果查無相關會議記錄，請明確說明'
  ].join('\n');

  return {
    description: `分析${committeeName}的會議討論內容`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}

function generateMeetingDetailsPrompt(args?: Record<string, string>): GetPromptResult {
  const ivodId = args?.ivod_id || "ivod_id";

  const text = [
    `請取得 IVOD ID **${ivodId}** 的完整會議逐字稿，並基於會議內容回答相關問題。`,
    "",
    '**步驟1：取得完整逐字稿**',
    "",
    '使用以下工具取得會議的完整內容：',
    '```json',
    '{',
    '  "tool": "get_meeting_transcript",',
    '  "arguments": {',
    `    "ivod_id": ${ivodId},`,
    '    "transcript_type": "ly_only"',
    '  }',
    '}',
    '```',
    "",
    '**步驟2：分析會議內容**',
    "",
    '根據取得的完整逐字稿，請分析：',
    '- 會議的主要議程和討論重點',
    '- 各發言人的主要觀點和立場',
    '- 重要的決議或結論',
    '- 會議中的爭議或辯論',
    "",
    '**注意事項**：',
    '- 僅基於實際取得的會議逐字稿回答',
    '- 可以引用具體的發言片段',
    '- 如果無法取得逐字稿，請說明原因'
  ].join('\n');

  return {
    description: `取得IVOD ID ${ivodId}的完整會議逐字稿`,
    messages: [{ role: 'user', content: { type: 'text', text } }],
  };
}
