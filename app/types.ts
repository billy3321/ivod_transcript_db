export interface IVOD {
  ivod_id: number;
  date: string;
  meeting_name: string;
  committee_names: string[];
  speaker_name: string;
  video_length: string;
}

export interface IVODDetail extends IVOD {
  ai_transcript: string;
  ly_transcript: string;
  ivod_url: string;
  video_url: string;
}