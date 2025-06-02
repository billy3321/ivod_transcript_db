/**
 * 搜尋高亮和摘要工具函數
 * 用於從逐字稿中提取包含搜尋關鍵字的文字片段並進行高亮處理
 */

export interface SearchExcerpt {
  text: string;           // 包含高亮標記的 HTML 字串
  plainText: string;      // 純文字版本（無 HTML 標記）
  hasMatch: boolean;      // 是否找到匹配
  matchPosition: number;  // 匹配位置在原文中的索引
}

/**
 * 從文字中提取包含搜尋關鍵字的摘要片段
 * @param text 要搜尋的文字內容
 * @param searchQuery 搜尋查詢字串
 * @param contextLength 前後文字的長度（預設50字）
 * @returns SearchExcerpt 物件
 */
export function extractSearchExcerpt(
  text: string | null,
  searchQuery: string,
  contextLength: number = 50
): SearchExcerpt {
  // 預設回傳值
  const defaultResult: SearchExcerpt = {
    text: '',
    plainText: '',
    hasMatch: false,
    matchPosition: -1
  };

  if (!text || !searchQuery || !searchQuery.trim()) {
    return defaultResult;
  }

  // 清理搜尋查詢，移除進階搜尋語法
  const cleanQuery = cleanSearchQuery(searchQuery);
  if (!cleanQuery) {
    return defaultResult;
  }

  // 尋找第一個匹配
  const matchResult = findFirstMatch(text, cleanQuery);
  if (!matchResult.found) {
    return defaultResult;
  }

  // 提取上下文
  const excerpt = extractContext(text, matchResult.position, matchResult.length, contextLength);
  
  // 生成高亮版本
  const highlightedText = highlightMatches(excerpt.text, cleanQuery);

  return {
    text: highlightedText,
    plainText: excerpt.text,
    hasMatch: true,
    matchPosition: matchResult.position
  };
}

/**
 * 清理搜尋查詢，移除進階搜尋語法，提取核心關鍵字
 * @param query 原始搜尋查詢
 * @returns 清理後的關鍵字
 */
function cleanSearchQuery(query: string): string {
  // 移除常見的進階搜尋語法
  let cleaned = query
    // 移除欄位搜尋語法 (title:, speaker: 等)
    .replace(/\b\w+:/g, '')
    // 移除布林運算子
    .replace(/\b(AND|OR|NOT)\b/gi, '')
    // 移除括號
    .replace(/[()]/g, '')
    // 移除排除語法 (-word)
    .replace(/-\S+/g, '')
    // 移除引號但保留內容
    .replace(/["']/g, '')
    // 移除多餘空白
    .replace(/\s+/g, ' ')
    .trim();

  // 如果清理後為空，嘗試提取引號內的內容
  if (!cleaned) {
    const quotedMatch = query.match(/[\"']([^\"']+)[\"']/);
    if (quotedMatch) {
      cleaned = quotedMatch[1];
    }
  }

  return cleaned;
}

/**
 * 在文字中尋找第一個匹配位置
 * @param text 要搜尋的文字
 * @param query 搜尋關鍵字
 * @returns 匹配結果
 */
function findFirstMatch(text: string, query: string): { found: boolean; position: number; length: number } {
  // 嘗試完整匹配
  const exactIndex = text.toLowerCase().indexOf(query.toLowerCase());
  if (exactIndex !== -1) {
    return {
      found: true,
      position: exactIndex,
      length: query.length
    };
  }

  // 如果沒有完整匹配，嘗試匹配查詢中的第一個詞
  const words = query.split(/\s+/).filter(word => word.length > 1);
  for (const word of words) {
    const wordIndex = text.toLowerCase().indexOf(word.toLowerCase());
    if (wordIndex !== -1) {
      return {
        found: true,
        position: wordIndex,
        length: word.length
      };
    }
  }

  return { found: false, position: -1, length: 0 };
}

/**
 * 提取包含匹配文字的上下文
 * @param text 原文
 * @param matchPosition 匹配位置
 * @param matchLength 匹配長度
 * @param contextLength 上下文長度
 * @returns 摘要文字和在摘要中的位置
 */
function extractContext(
  text: string,
  matchPosition: number,
  matchLength: number,
  contextLength: number
): { text: string; relativePosition: number } {
  const start = Math.max(0, matchPosition - contextLength);
  const end = Math.min(text.length, matchPosition + matchLength + contextLength);
  
  let excerpt = text.substring(start, end);
  const relativePosition = matchPosition - start;

  // 如果不是從開頭開始，加上省略號
  if (start > 0) {
    excerpt = '...' + excerpt;
  }

  // 如果不是到結尾，加上省略號
  if (end < text.length) {
    excerpt = excerpt + '...';
  }

  return {
    text: excerpt,
    relativePosition: start > 0 ? relativePosition + 3 : relativePosition // 考慮省略號的長度
  };
}

/**
 * 在文字中高亮所有匹配的關鍵字
 * @param text 要處理的文字
 * @param query 搜尋關鍵字
 * @returns 包含高亮標記的 HTML 字串
 */
function highlightMatches(text: string, query: string): string {
  if (!query) return escapeHtml(text);

  // 逸出 HTML 特殊字元
  let escapedText = escapeHtml(text);

  // 獲取所有要高亮的詞彙
  const wordsToHighlight = getWordsToHighlight(query);

  // 對每個詞彙進行高亮處理
  for (const word of wordsToHighlight) {
    if (word.length > 1) { // 只高亮長度大於1的詞
      const regex = new RegExp(`(${escapeRegExp(word)})`, 'gi');
      escapedText = escapedText.replace(regex, '<mark class="bg-red-200 text-red-800 px-1 rounded">$1</mark>');
    }
  }

  return escapedText;
}

/**
 * 從搜尋查詢中提取要高亮的詞彙
 * @param query 搜尋查詢
 * @returns 詞彙陣列
 */
function getWordsToHighlight(query: string): string[] {
  // 先嘗試完整查詢
  const words = [query];

  // 然後加入個別詞彙
  const individualWords = query.split(/\s+/).filter(word => word.length > 1);
  words.push(...individualWords);

  // 去重並排序（較長的詞優先）
  const uniqueWords = Array.from(new Set(words));
  return uniqueWords.sort((a, b) => b.length - a.length);
}

/**
 * 逸出 HTML 特殊字元
 * @param text 要逸出的文字
 * @returns 逸出後的文字
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 逸出正規表達式特殊字元
 * @param string 要逸出的字串
 * @returns 逸出後的字串
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 判斷搜尋查詢是否可能匹配逐字稿內容
 * @param query 搜尋查詢
 * @returns 是否為逐字稿搜尋
 */
export function isTranscriptSearch(query: string): boolean {
  if (!query || !query.trim()) return false;

  // 檢查是否包含欄位限定語法
  const fieldPrefixes = ['title:', 'speaker:', 'meeting:', 'committee:'];
  const hasFieldPrefix = fieldPrefixes.some(prefix => 
    query.toLowerCase().includes(prefix)
  );

  // 如果有欄位限定且不包含逐字稿相關欄位，則不是逐字稿搜尋
  if (hasFieldPrefix) {
    return false;
  }

  // 否則假設是可能的逐字稿搜尋
  return true;
}