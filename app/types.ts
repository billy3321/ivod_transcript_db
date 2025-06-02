export interface SearchExcerpt {
  text: string;           // 包含高亮標記的 HTML 字串
  plainText: string;      // 純文字版本（無 HTML 標記）
  hasMatch: boolean;      // 是否找到匹配
  matchPosition: number;  // 匹配位置在原文中的索引
}

export interface IVOD {
  ivod_id: number;
  date: string | Date; // SQLite: string, PostgreSQL/MySQL: Date
  title: string | null;
  meeting_name: string | null;
  committee_names: string[] | string | null; // PostgreSQL: array, SQLite/MySQL: string/JSON
  speaker_name: string | null;
  video_length: string | null;
  video_start: string | null;
  video_end: string | null;
  video_type: string | null;
  category: string | null;
  meeting_code: string | null;
  meeting_code_str: string | null;
  meeting_time: string | Date | null; // SQLite: string, PostgreSQL/MySQL: Date
  excerpt?: SearchExcerpt; // 搜尋摘要（可選）
}

export interface IVODDetail extends IVOD {
  ai_transcript: string | null;
  ly_transcript: string | null;
  ivod_url: string;
  video_url: string | null;
  ai_status: string;
  ly_status: string;
  last_updated: string | Date; // SQLite: string, PostgreSQL/MySQL: Date
}