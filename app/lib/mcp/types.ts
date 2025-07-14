export interface MCPRequest {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: string;
  id: string | number | null;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
}

export interface TranscriptExcerpt {
  text: string;
  relevance_score: number;
  start_position: number;
  end_position: number;
}

export interface TranscriptResult {
  ivod_id: number;
  speaker_name: string | null;
  date: string;
  
  meeting_info: {
    title: string | null;
    meeting_name: string | null;
    committee_names: string[];
    category: string | null;
  };
  
  transcript: {
    source: "ly_transcript" | "ai_transcript";
    excerpts: TranscriptExcerpt[];
    full_length: number;
  };
  
  ivod_url: string;
}

export interface SearchParams {
  query?: string;
  speakers?: string[];
  topics?: string[];
  committees?: string[];
  search_mode?: 'intersection' | 'union';
  scope?: 'all' | 'transcript_only';
  excerpt_length?: number;
  context_sentences?: number;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

export interface FullTranscriptResult {
  ivod_id: number;
  speaker_name: string | null;
  date: string;
  
  meeting_info: {
    title: string | null;
    meeting_name: string | null;
    committee_names: string[];
    category: string | null;
  };
  
  transcript: {
    source: "ly_transcript" | "ai_transcript";
    content: string | null;
    full_length: number;
  };
  
  ivod_url: string;
}