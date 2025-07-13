// MCP Prompts - 為 AI 提供可重用的提示模板
import { logger } from '@/lib/logger';

export interface MCPPrompt {
  name: string;
  description: string;
  arguments?: MCPPromptArgument[];
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

// 定義可用的提示模板
export const AVAILABLE_PROMPTS: MCPPrompt[] = [
  {
    name: "analyze-legislator-performance",
    description: "分析特定立委的表現和關注議題",
    arguments: [
      {
        name: "legislator_name",
        description: "立委姓名，例如：黃國昌",
        required: true
      },
      {
        name: "time_period",
        description: "分析時間範圍，例如：2024年第3會期",
        required: false
      }
    ]
  },
  {
    name: "track-policy-development",
    description: "追蹤特定政策或法案的發展過程",
    arguments: [
      {
        name: "policy_topic",
        description: "政策主題，例如：數位中介服務法",
        required: true
      },
      {
        name: "committee",
        description: "相關委員會，例如：交通委員會",
        required: false
      }
    ]
  },
  {
    name: "committee-activity-summary",
    description: "總結特定委員會的活動和討論重點",
    arguments: [
      {
        name: "committee_name",
        description: "委員會名稱，例如：交通委員會",
        required: true
      },
      {
        name: "focus_area",
        description: "關注領域，例如：數位發展、交通建設",
        required: false
      }
    ]
  },
  {
    name: "debate-analysis",
    description: "分析特定議題的立法院辯論情況",
    arguments: [
      {
        name: "debate_topic",
        description: "辯論主題，例如：AI監管、數位權利",
        required: true
      },
      {
        name: "perspective",
        description: "分析角度，例如：支持方觀點、反對方觀點、中性分析",
        required: false
      }
    ]
  },
  {
    name: "legislative-timeline",
    description: "建立特定法案或政策的時間軸",
    arguments: [
      {
        name: "legislation_name",
        description: "法案名稱，例如：電信管理法修正案",
        required: true
      }
    ]
  },
  {
    name: "cross-party-comparison",
    description: "比較不同政黨或立委對特定議題的立場",
    arguments: [
      {
        name: "issue_topic",
        description: "議題主題，例如：能源轉型、數位轉型",
        required: true
      },
      {
        name: "legislators",
        description: "要比較的立委，例如：黃國昌,王鴻薇,陳俊宇",
        required: false
      }
    ]
  },
  {
    name: "policy-impact-assessment",
    description: "評估政策提案的潛在影響和爭議點",
    arguments: [
      {
        name: "policy_proposal",
        description: "政策提案，例如：數位身分證推動計畫",
        required: true
      }
    ]
  },
  {
    name: "quick-topic-overview",
    description: "快速瞭解特定主題在立法院的討論概況",
    arguments: [
      {
        name: "topic",
        description: "主題關鍵字，例如：人工智慧、氣候變遷",
        required: true
      },
      {
        name: "depth",
        description: "分析深度：簡要概述、詳細分析",
        required: false
      }
    ]
  }
];

// 獲取提示列表
export async function listPrompts(): Promise<MCPPrompt[]> {
  logger.info('MCP prompts list requested');
  return AVAILABLE_PROMPTS;
}

// 獲取特定提示內容
export async function getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
  logger.info('MCP prompt requested', { metadata: { name, args } });

  switch (name) {
    case "analyze-legislator-performance":
      return generateLegislatorAnalysisPrompt(args);

    case "track-policy-development":
      return generatePolicyTrackingPrompt(args);

    case "committee-activity-summary":
      return generateCommitteeActivityPrompt(args);

    case "debate-analysis":
      return generateDebateAnalysisPrompt(args);

    case "legislative-timeline":
      return generateLegislativeTimelinePrompt(args);

    case "cross-party-comparison":
      return generateCrossPartyComparisonPrompt(args);

    case "policy-impact-assessment":
      return generatePolicyImpactPrompt(args);

    case "quick-topic-overview":
      return generateQuickOverviewPrompt(args);

    default:
      throw new Error(`Unknown prompt: ${name}`);
  }
}

// 生成立委表現分析提示
function generateLegislatorAnalysisPrompt(args?: Record<string, string>): GetPromptResult {
  const legislatorName = args?.legislator_name || "[立委姓名]";
  const timePeriod = args?.time_period || "最近一年";

  return {
    description: `分析${legislatorName}在${timePeriod}的立法院表現`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請幫我分析立委${legislatorName}在${timePeriod}的表現，包括：

1. 主要關注議題和專業領域
2. 參與的重要法案或政策討論
3. 在委員會的活躍度和貢獻
4. 質詢風格和重點方向
5. 具體的政策立場和主張

請先搜尋${legislatorName}的相關發言記錄，然後進行全面分析。分析時請：
- 引用具體的發言內容作為佐證
- 統計參與的會議數量和頻率
- 識別其關注的核心議題
- 評估其專業表現和影響力
- 提供客觀、平衡的評估

如果找不到足夠的資料，請說明可能的原因並建議其他搜尋方向。`
        }
      }
    ]
  };
}

// 生成政策追蹤提示
function generatePolicyTrackingPrompt(args?: Record<string, string>): GetPromptResult {
  const policyTopic = args?.policy_topic || "[政策主題]";
  const committee = args?.committee || "";

  const committeeContext = committee ? `特別關注在${committee}的相關討論。` : "";

  return {
    description: `追蹤${policyTopic}的政策發展過程`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請幫我追蹤「${policyTopic}」在立法院的發展過程，${committeeContext}

請按以下結構進行分析：

1. **政策背景**
   - 提出的原因和背景
   - 要解決的主要問題

2. **發展時間軸**
   - 重要的討論節點
   - 關鍵的會議和決議

3. **主要參與者**
   - 推動的立委和政黨
   - 反對或關切的聲音

4. **爭議焦點**
   - 主要的分歧點
   - 不同立場的論點

5. **目前狀態**
   - 最新的發展情況
   - 預期的後續進程

請先搜尋相關的會議記錄和發言，然後整理出完整的政策發展脈絡。請確保資訊的時序性和準確性。`
        }
      }
    ]
  };
}

// 生成委員會活動總結提示
function generateCommitteeActivityPrompt(args?: Record<string, string>): GetPromptResult {
  const committeeName = args?.committee_name || "[委員會名稱]";
  const focusArea = args?.focus_area || "";

  const focusContext = focusArea ? `特別關注${focusArea}相關的討論。` : "";

  return {
    description: `總結${committeeName}的活動和討論重點`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請為我總結${committeeName}最近的活動和討論重點。${focusContext}

分析內容包括：

1. **主要議程**
   - 近期討論的重要議題
   - 審查的法案或預算

2. **活躍立委**
   - 發言頻率較高的委員
   - 各立委的關注重點

3. **重要決議**
   - 通過的重要決議
   - 有爭議的表決結果

4. **討論熱點**
   - 引起較多討論的議題
   - 跨黨派關注的問題

5. **委員會特色**
   - 該委員會的專業領域
   - 討論風格和特點

請先搜尋該委員會的相關會議記錄，然後提供結構化的總結。請注重客觀性和全面性。`
        }
      }
    ]
  };
}

// 生成辯論分析提示
function generateDebateAnalysisPrompt(args?: Record<string, string>): GetPromptResult {
  const debateTopic = args?.debate_topic || "[辯論主題]";
  const perspective = args?.perspective || "中性分析";

  return {
    description: `分析${debateTopic}的立法院辯論情況`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請分析「${debateTopic}」在立法院的辯論情況，採用${perspective}的角度。

分析架構：

1. **議題概述**
   - 辯論的核心爭點
   - 涉及的法規或政策

2. **支持方觀點**
   - 主要支持者和論點
   - 提出的證據和理由

3. **反對方觀點**
   - 主要反對者和論點
   - 關切的風險和問題

4. **中間立場**
   - 提出修正意見的立委
   - 折衷方案或建議

5. **辯論品質**
   - 論述的深度和專業性
   - 是否有建設性對話

6. **可能結果**
   - 各方立場的力量對比
   - 可能的妥協方向

請先搜尋相關的發言記錄，特別注意不同立委的具體論點。請保持客觀公正，呈現各方觀點。`
        }
      }
    ]
  };
}

// 生成立法時間軸提示
function generateLegislativeTimelinePrompt(args?: Record<string, string>): GetPromptResult {
  const legislationName = args?.legislation_name || "[法案名稱]";

  return {
    description: `建立${legislationName}的立法時間軸`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請為「${legislationName}」建立詳細的立法時間軸，包括：

**時間軸要素：**

1. **提案階段**
   - 首次提出時間
   - 提案者和連署者
   - 提案理由

2. **委員會審查**
   - 相關委員會的審查過程
   - 重要的質詢和討論
   - 修正提案

3. **院會程序**
   - 一讀、二讀、三讀時程
   - 表決結果

4. **重要事件**
   - 公聽會或說明會
   - 爭議事件或轉折點

5. **目前狀態**
   - 法案進度
   - 預期時程

**格式要求：**
- 按時間順序排列
- 標明具體日期（如有）
- 註明參與的立委和發言重點
- 標示重要的轉折點

請先搜尋相關的會議記錄和發言，確保時間軸的準確性和完整性。`
        }
      }
    ]
  };
}

// 生成跨黨派比較提示
function generateCrossPartyComparisonPrompt(args?: Record<string, string>): GetPromptResult {
  const issueTopic = args?.issue_topic || "[議題主題]";
  const legislators = args?.legislators || "";

  const legislatorContext = legislators 
    ? `重點比較以下立委的立場：${legislators.split(',').join('、')}` 
    : "比較不同政黨立委的立場";

  return {
    description: `比較不同立委對${issueTopic}的立場`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請比較不同立委對「${issueTopic}」的立場差異。${legislatorContext}

比較維度：

1. **基本立場**
   - 支持/反對/中性
   - 核心論點

2. **政策主張**
   - 具體的政策建議
   - 實施方式的偏好

3. **關切重點**
   - 各自關注的面向
   - 強調的利益考量

4. **論述風格**
   - 論證方式
   - 溝通策略

5. **政黨色彩**
   - 是否反映政黨立場
   - 跨黨派合作可能性

6. **立場演變**
   - 立場是否有變化
   - 影響因素

**分析方法：**
- 引用具體發言作為證據
- 客觀比較不同觀點
- 識別共識和分歧點
- 評估各立場的說服力

請先搜尋相關立委的發言記錄，然後進行系統性比較。`
        }
      }
    ]
  };
}

// 生成政策影響評估提示
function generatePolicyImpactPrompt(args?: Record<string, string>): GetPromptResult {
  const policyProposal = args?.policy_proposal || "[政策提案]";

  return {
    description: `評估${policyProposal}的潛在影響`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請評估「${policyProposal}」的潛在影響和爭議點：

**影響評估架構：**

1. **直接影響**
   - 立即的政策效果
   - 受影響的對象和範圍

2. **間接影響**
   - 長期的社會經濟效應
   - 可能的連鎖反應

3. **利害關係人**
   - 受益者和其支持理由
   - 受損者和其反對理由

4. **實施挑戰**
   - 執行上的困難
   - 所需資源和成本

5. **爭議焦點**
   - 主要的反對聲音
   - 爭議的核心問題

6. **風險評估**
   - 潛在的負面後果
   - 不確定性因素

**分析依據：**
- 搜尋立法院相關討論
- 參考立委的質疑和建議
- 整理支持和反對的論點

請提供平衡、客觀的評估，同時考慮多方觀點。`
        }
      }
    ]
  };
}

// 生成快速主題概覽提示
function generateQuickOverviewPrompt(args?: Record<string, string>): GetPromptResult {
  const topic = args?.topic || "[主題]";
  const depth = args?.depth || "簡要概述";

  const depthInstruction = depth === "詳細分析" 
    ? "請提供深入的分析，包含具體案例和詳細論證。"
    : "請提供簡潔的概述，突出重點和關鍵資訊。";

  return {
    description: `${depth}${topic}在立法院的討論概況`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `請為我提供「${topic}」在立法院討論的概況。${depthInstruction}

**概覽內容：**

1. **討論頻率**
   - 最近的討論熱度
   - 主要討論場合

2. **關鍵立委**
   - 最關注此議題的立委
   - 各自的立場傾向

3. **主要觀點**
   - 支持方的主要論點
   - 反對方的主要關切

4. **政策方向**
   - 可能的政策發展
   - 立法進展

5. **公眾關注**
   - 社會討論的熱點
   - 媒體關注重點

**搜尋策略：**
- 先搜尋主題的直接關鍵字
- 再搜尋相關的政策名稱
- 關注最近的會議討論

請根據搜尋結果提供準確、及時的概況分析。`
        }
      }
    ]
  };
}