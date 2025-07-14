export interface MCPRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: any;
}

export interface MCPResponse {
  jsonrpc: '2.0';
  id: string | number | null;
  result?: any;
  error?: MCPError;
  nextCursor?: string;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

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

export interface MCPResourceTemplate {
  uriTemplate: string;
  name: string;
  description: string;
  mimeType?: string;
}

export interface TranscriptResult {
  ivod_id: number;
  speaker_name: string;
  date: string;
  meeting_info: {
    title: string;
    meeting_name: string;
    committee_names: string[];
    category: string;
  };
  transcript: {
    source: 'ly_transcript' | 'ai_transcript';
    excerpts: any[];
    full_length: number;
  };
  ivod_url: string;
}

export interface FullTranscriptResult {
  ivod_id: number;
  speaker_name: string;
  date: string;
  meeting_info: {
    title: string;
    meeting_name: string;
    committee_names: string[];
    category: string;
  };
  transcript: {
    source: 'ly_transcript' | 'ai_transcript';
    content: string | null;
    full_length: number;
  };
  ivod_url: string;
}

export interface SearchParams {
  query?: string;
  speakers?: string[];
  committees?: string[];
  meeting_name?: string;
  mode?: 'keyword_all_fields' | 'keyword_transcript_only' | 'semantic_search' | 'hybrid_search';
  transcription_source?: 'all' | 'ly_only';
  max_excerpt_length?: number;
  max_context_sentences?: number;
  date_from?: string;
  date_to?: string;
  max_results?: number;
  cursor?: string;
}
