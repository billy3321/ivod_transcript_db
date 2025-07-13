// MCP Resources - 為 AI 提供可讀取的資源和文檔
import { logger } from '@/lib/logger';

export interface MCPResource {
  uri: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface ResourceContent {
  uri: string;
  mimeType: string;
  text?: string;
  blob?: string;
}

// 定義可用的資源
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

// 獲取資源列表
export async function listResources(): Promise<MCPResource[]> {
  logger.info('MCP resources list requested');
  return AVAILABLE_RESOURCES;
}

// 讀取特定資源內容
export async function readResource(uri: string): Promise<ResourceContent> {
  logger.info('MCP resource read requested', { metadata: { uri } });

  switch (uri) {
    case "ivod://usage-guide":
      return {
        uri,
        mimeType: "text/markdown",
        text: await getUsageGuide()
      };

    case "ivod://search-examples":
      return {
        uri,
        mimeType: "text/markdown", 
        text: await getSearchExamples()
      };

    case "ivod://api-reference":
      return {
        uri,
        mimeType: "text/markdown",
        text: await getAPIReference()
      };

    case "ivod://data-structure":
      return {
        uri,
        mimeType: "text/markdown",
        text: await getDataStructure()
      };

    case "ivod://best-practices":
      return {
        uri,
        mimeType: "text/markdown",
        text: await getBestPractices()
      };

    default:
      throw new Error(`Unknown resource URI: ${uri}`);
  }
}

// 生成使用指南
async function getUsageGuide(): Promise<string> {
  return `# IVOD 逐字稿搜尋系統使用指南

## 概述

台灣立法院 IVOD (Internet Video on Demand) 逐字稿搜尋系統讓您能夠：
- 搜尋立委發言記錄
- 查詢特定委員會的會議內容
- 檢索特定話題的討論
- 取得完整會議逐字稿

## 主要功能

### 1. search_transcripts - 統一搜尋工具
支援多種搜尋模式：
- **關鍵字搜尋**: 在逐字稿中搜尋特定詞彙
- **立委搜尋**: 搜尋特定立委的發言
- **委員會搜尋**: 搜尋特定委員會的會議
- **話題搜尋**: 搜尋特定主題的討論
- **複合搜尋**: 組合多種條件進行精確搜尋

### 2. get_meeting_transcript - 完整逐字稿
根據 IVOD ID 取得特定會議的完整內容。

## 資料涵蓋範圍

- **時間範圍**: 2024年至今
- **會議類型**: 委員會會議、院會、公聽會等
- **逐字稿來源**: 立法院官方版本 + AI 輔助版本
- **更新頻率**: 每日增量更新

## 搜尋技巧

1. **使用具體關鍵字**: "數位發展" 比 "科技" 更精確
2. **組合多個條件**: 同時指定立委和委員會可縮小範圍
3. **調整搜尋模式**: union (聯集) vs intersection (交集)
4. **設定適當的結果數量**: 根據需要調整 limit 參數

## 回應格式

每個搜尋結果包含：
- IVOD 會議 ID
- 發言人資訊
- 會議詳細資訊（委員會、日期、主題）
- 相關逐字稿段落
- IVOD 影片連結

使用這些資訊可以快速定位到具體的立法院會議內容。`;
}

// 生成搜尋範例
async function getSearchExamples(): Promise<string> {
  return `# IVOD 搜尋範例集

## 基本搜尋範例

### 1. 關鍵字搜尋
\`\`\`json
{
  "query": "數位發展",
  "limit": 10
}
\`\`\`
搜尋包含 "數位發展" 的所有發言記錄。

### 2. 立委搜尋
\`\`\`json
{
  "speakers": ["黃國昌"],
  "limit": 15
}
\`\`\`
搜尋黃國昌委員的所有發言。

### 3. 委員會搜尋
\`\`\`json
{
  "committees": ["交通委員會"],
  "limit": 20
}
\`\`\`
搜尋交通委員會的所有會議記錄。

## 進階搜尋範例

### 4. 多立委搜尋
\`\`\`json
{
  "speakers": ["黃國昌", "王鴻薇", "陳俊宇"],
  "search_mode": "union",
  "limit": 20
}
\`\`\`
搜尋這三位立委任一人的發言。

### 5. 複合主題搜尋
\`\`\`json
{
  "topics": ["人工智慧", "AI", "數位轉型"],
  "search_mode": "union",
  "limit": 25
}
\`\`\`
搜尋與 AI 或數位轉型相關的討論。

### 6. 精確複合搜尋
\`\`\`json
{
  "speakers": ["黃國昌", "王鴻薇"],
  "committees": ["交通委員會", "數位發展委員會"],
  "topics": ["電信法"],
  "search_mode": "intersection",
  "limit": 10
}
\`\`\`
搜尋指定立委在相關委員會討論電信法的記錄。

## 時間範圍搜尋

### 7. 特定時期搜尋
\`\`\`json
{
  "query": "預算審查",
  "date_from": "2024-10-01",
  "date_to": "2024-12-31",
  "limit": 30
}
\`\`\`
搜尋 2024 年第四季的預算審查討論。

### 8. 近期會議搜尋
\`\`\`json
{
  "speakers": ["黃國昌"],
  "date_from": "2025-05-01",
  "limit": 10
}
\`\`\`
搜尋黃國昌委員 2025 年 5 月以來的發言。

## 自訂輸出格式

### 9. 詳細段落搜尋
\`\`\`json
{
  "query": "AI治理",
  "excerpt_length": 1200,
  "context_sentences": 5,
  "limit": 5
}
\`\`\`
取得較長的逐字稿段落和更多上下文。

### 10. 快速概覽搜尋
\`\`\`json
{
  "speakers": ["黃國昌"],
  "committees": ["交通委員會"],
  "excerpt_length": 400,
  "context_sentences": 2,
  "limit": 15
}
\`\`\`
取得簡潔的搜尋結果概覽。

## 特殊用途範例

### 11. 僅搜尋逐字稿內容
\`\`\`json
{
  "query": "淨零碳排",
  "scope": "transcript_only",
  "limit": 20
}
\`\`\`
只在逐字稿內容中搜尋，不包含會議標題等元資料。

### 12. 取得完整會議逐字稿
\`\`\`json
{
  "ivod_id": 162050,
  "transcript_type": "auto"
}
\`\`\`
取得特定會議的完整逐字稿內容。

## 常用立委名稱

- 黃國昌、王鴻薇、陳俊宇、林月琴、陳培瑜
- 建議使用完整姓名以提高搜尋準確度

## 常用委員會名稱

- 交通委員會、教育及文化委員會、數位發展委員會
- 內政委員會、外交及國防委員會、經濟委員會
- 可使用部分名稱如 "交通"、"教育" 進行模糊搜尋`;
}

// 生成 API 參考
async function getAPIReference(): Promise<string> {
  return `# IVOD MCP API 參考文檔

## search_transcripts 工具

### 參數說明

| 參數名 | 類型 | 必填 | 預設值 | 說明 |
|--------|------|------|--------|------|
| query | string | 否 | - | 關鍵字搜尋，支援基本文字搜尋 |
| speakers | string[] | 否 | - | 立委姓名列表，如 ["黃國昌", "王鴻薇"] |
| topics | string[] | 否 | - | 話題關鍵字列表，如 ["交通", "數位發展"] |
| committees | string[] | 否 | - | 委員會列表，如 ["交通委員會", "教育委員會"] |
| search_mode | enum | 否 | "union" | 搜尋模式：intersection (交集) 或 union (聯集) |
| scope | enum | 否 | "all" | 搜尋範圍：all (全部欄位) 或 transcript_only (僅逐字稿) |
| excerpt_length | number | 否 | 800 | 段落長度，範圍 200-2000 字符 |
| context_sentences | number | 否 | 3 | 上下文句子數量，範圍 1-10 句 |
| date_from | string | 否 | - | 起始日期，格式 YYYY-MM-DD |
| date_to | string | 否 | - | 結束日期，格式 YYYY-MM-DD |
| limit | number | 否 | 20 | 結果數量限制，最大 100 |

### 回應格式

\`\`\`json
{
  "results": [
    {
      "ivod_id": 162050,
      "speaker_name": "黃國昌",
      "date": "2025-05-28",
      "meeting_info": {
        "title": "立法院第11屆第3會期交通委員會第13次全體委員會議",
        "meeting_name": "交通委員會會議",
        "committee_names": ["交通委員會"],
        "category": "委員會會議"
      },
      "transcript": {
        "source": "ly_transcript",
        "excerpts": [
          {
            "text": "相關逐字稿段落內容...",
            "relevance_score": 0.8,
            "start_position": 1250,
            "end_position": 1380
          }
        ],
        "full_length": 15420
      },
      "ivod_url": "https://ivod.ly.gov.tw/Play/VOD/162050"
    }
  ],
  "metadata": {
    "total_found": 15,
    "search_params": { /* 搜尋參數 */ },
    "excerpt_config": {
      "length": 800,
      "context_sentences": 3
    },
    "search_time_ms": 245,
    "success": true
  }
}
\`\`\`

## get_meeting_transcript 工具

### 參數說明

| 參數名 | 類型 | 必填 | 預設值 | 說明 |
|--------|------|------|--------|------|
| ivod_id | number | 是 | - | IVOD 會議唯一識別碼 |
| transcript_type | enum | 否 | "auto" | 逐字稿類型：auto (自動選擇)、ly_only (僅立委版)、ai_only (僅AI版) |

### 回應格式

\`\`\`json
{
  "result": {
    "ivod_id": 162050,
    "speaker_name": "黃國昌",
    "date": "2025-05-28",
    "meeting_info": {
      "title": "完整會議標題",
      "meeting_name": "委員會名稱",
      "committee_names": ["交通委員會"],
      "category": "委員會會議"
    },
    "transcript": {
      "source": "ly_transcript",
      "content": "完整的逐字稿內容...",
      "full_length": 15420
    },
    "ivod_url": "https://ivod.ly.gov.tw/Play/VOD/162050"
  },
  "success": true,
  "metadata": {
    "search_time_ms": 123
  }
}
\`\`\`

## 錯誤處理

所有錯誤都會以以下格式回傳：

\`\`\`json
{
  "error": "錯誤訊息描述",
  "success": false,
  "metadata": {
    "search_time_ms": 50
  }
}
\`\`\`

## 效能考量

- 一般搜尋：< 500ms
- 複雜搜尋：< 2000ms  
- 單筆逐字稿：< 200ms
- 建議 limit 設為 50 以下以保持良好效能`;
}

// 生成資料結構說明
async function getDataStructure(): Promise<string> {
  return `# IVOD 資料結構說明

## 資料庫架構

IVOD 系統使用單一主表儲存所有逐字稿資料：

### IVODTranscript 表結構

| 欄位名 | 類型 | 說明 |
|--------|------|------|
| ivod_id | number | 唯一識別碼，對應立法院 IVOD 系統 |
| title | string | 會議完整標題 |
| speaker_name | string | 主要發言人姓名 |
| meeting_name | string | 會議名稱 |
| committee_names | JSON/string | 委員會列表 |
| date | datetime | 會議日期 |
| category | string | 會議類別 |
| ly_transcript | text | 立法院官方逐字稿 |
| ai_transcript | text | AI 生成逐字稿 |
| ly_status | enum | 官方逐字稿狀態 |
| ai_status | enum | AI 逐字稿狀態 |
| ivod_url | string | IVOD 影片連結 |

## 逐字稿格式

### 官方逐字稿 (ly_transcript)
- 來源：立法院官方公布
- 格式：純文字，包含發言人標記
- 特點：準確度高，但可能有缺漏

### AI 逐字稿 (ai_transcript)  
- 來源：AI 語音轉文字
- 格式：純文字，連續內容
- 特點：覆蓋率高，但可能有識別錯誤

## 委員會資料

### 主要委員會
- 內政委員會
- 外交及國防委員會  
- 經濟委員會
- 教育及文化委員會
- 交通委員會
- 司法及法制委員會
- 社會福利及衛生環境委員會
- 數位發展委員會

### 委員會名稱格式
- 資料庫中存為 JSON 陣列或逗號分隔字串
- 搜尋時支援部分名稱匹配
- 例：搜尋 "交通" 可匹配 "交通委員會"

## 會議類別

- 委員會會議：一般委員會會議
- 聯席會議：跨委員會聯合會議  
- 院會：立法院院會
- 公聽會：公開聽證會
- 協商會議：黨團協商會議

## 資料更新機制

### 更新頻率
- 每日增量更新：抓取最新會議
- 每週完整檢查：補齊遺漏資料
- 即時重試：失敗記錄自動重試

### 狀態追蹤
- pending：等待處理
- success：處理成功  
- failed：處理失敗

## 搜尋索引

### Elasticsearch 索引 (可選)
- 全文搜尋支援
- 中文分詞處理
- 相關性評分
- 如失效自動 fallback 至資料庫

### 資料庫搜尋
- LIKE 查詢支援
- 多欄位組合搜尋
- 跨資料庫相容性 (SQLite/PostgreSQL/MySQL)

## 資料完整性

### 必要欄位
- ivod_id：必須唯一且非空
- date：必須有效日期
- 至少一種逐字稿：ly_transcript 或 ai_transcript

### 資料清理
- 重複記錄去除
- 無效資料過濾
- 格式標準化處理`;
}

// 生成最佳實踐
async function getBestPractices(): Promise<string> {
  return `# IVOD 搜尋最佳實踐

## 搜尋策略

### 1. 關鍵字選擇
- ✅ 使用具體詞彙："數位發展部" 而非 "政府單位"
- ✅ 使用正式名稱："立法院" 而非 "國會"
- ✅ 使用專業術語："預算審查" 而非 "錢的問題"
- ❌ 避免過於簡短：搜尋 "AI" 可能結果過多

### 2. 立委名稱
- ✅ 使用完整姓名："黃國昌" 而非 "黃委員"
- ✅ 注意正確拼字：避免錯別字
- ✅ 可組合多位立委：["黃國昌", "王鴻薇"]
- 💡 常見立委：黃國昌、王鴻薇、陳俊宇、林月琴等

### 3. 委員會搜尋
- ✅ 可使用簡稱："交通" 匹配 "交通委員會"
- ✅ 支援完整名稱："教育及文化委員會"
- ✅ 組合搜尋：["交通委員會", "數位發展委員會"]

## 搜尋模式選擇

### Union (聯集) - 預設推薦
適用場景：
- 廣泛主題探索
- 多立委發言比較
- 跨委員會議題追蹤

範例：
\`\`\`json
{
  "speakers": ["黃國昌", "王鴻薇"],
  "topics": ["數位發展", "AI"],
  "search_mode": "union"
}
\`\`\`

### Intersection (交集) - 精確搜尋
適用場景：
- 特定議題深度分析
- 精確條件匹配
- 減少雜訊結果

範例：
\`\`\`json
{
  "speakers": ["黃國昌"],
  "committees": ["交通委員會"],
  "topics": ["5G"],
  "search_mode": "intersection"
}
\`\`\`

## 結果數量控制

### 建議設定
- **探索性搜尋**: limit: 20-50
- **詳細研究**: limit: 5-15  
- **快速概覽**: limit: 10
- **全面分析**: limit: 50-100

### 效能考量
- limit ≤ 20：最佳效能 (< 300ms)
- limit ≤ 50：良好效能 (< 800ms)
- limit > 50：可能較慢 (1-3s)

## 段落設定優化

### excerpt_length (段落長度)
- **快速掃描**: 300-500 字符
- **詳細閱讀**: 800-1200 字符
- **深度分析**: 1200-2000 字符

### context_sentences (上下文)
- **關鍵重點**: 1-2 句
- **充分理解**: 3-5 句  
- **完整脈絡**: 5-10 句

## 時間範圍搜尋

### 有效策略
- 使用具體日期範圍
- 配合立法院會期：每年 2 月和 9 月開議
- 預算審查期：通常在 10-12 月
- 重大法案：關注特定時期

範例：
\`\`\`json
{
  "query": "預算審查",
  "date_from": "2024-10-01",
  "date_to": "2024-12-31"
}
\`\`\`

## 常見問題解決

### 無搜尋結果
1. 檢查關鍵字拼寫
2. 放寬搜尋條件
3. 改用 union 模式
4. 擴大時間範圍

### 結果過多
1. 增加特定條件
2. 改用 intersection 模式
3. 縮小時間範圍
4. 降低 limit 數量

### 結果不相關
1. 使用更具體的關鍵字
2. 限定委員會範圍
3. 指定發言人
4. 使用 transcript_only 模式

## 高級搜尋技巧

### 1. 議題追蹤
\`\`\`json
{
  "topics": ["數位中介服務法", "NCC"],
  "committees": ["交通委員會"],
  "date_from": "2024-01-01",
  "search_mode": "union",
  "limit": 30
}
\`\`\`

### 2. 立委表現分析
\`\`\`json
{
  "speakers": ["黃國昌"],
  "committees": ["交通委員會", "數位發展委員會"],
  "search_mode": "intersection",
  "limit": 50
}
\`\`\`

### 3. 法案討論追蹤
\`\`\`json
{
  "query": "電信管理法",
  "scope": "transcript_only",
  "excerpt_length": 1000,
  "limit": 25
}
\`\`\`

## 資料解讀建議

### 逐字稿來源判斷
- ly_transcript：立法院官方，準確度高
- ai_transcript：AI 生成，覆蓋度高但可能有錯誤

### 會議資訊理解
- 會議標題包含具體事由
- 委員會名稱反映主管領域
- 日期可判斷政策時程

### IVOD 影片連結
- 直接連結到立法院官方影片
- 可查看完整會議過程
- 提供視覺化的討論脈絡

使用這些最佳實踐可以大幅提升搜尋效率和結果相關性！`;
}
