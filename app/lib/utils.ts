/**
 * Utility function to format committee names for display
 * Handles different data formats across database backends:
 * - SQLite: JSON string format
 * - PostgreSQL: Array format  
 * - MySQL: JSON format
 */
export function formatCommitteeNames(committeeNames: string[] | string | null | undefined): string {
  if (!committeeNames) return 'N/A';
  
  if (typeof committeeNames === 'string') {
    try {
      const parsed = JSON.parse(committeeNames);
      return Array.isArray(parsed) ? parsed.join(', ') : committeeNames;
    } catch {
      return committeeNames;
    }
  }
  
  return Array.isArray(committeeNames) ? committeeNames.join(', ') : String(committeeNames);
}

/**
 * Format IVOD title with speaker information according to specified rules
 */
export function formatIVODTitle(title: string | null, meeting_name: string | null, speaker_name: string | null): string {
  const displayTitle = title || meeting_name || '會議記錄';
  
  if (!speaker_name) {
    return displayTitle;
  }
  
  if (speaker_name === '完整會議') {
    return `${displayTitle}（${speaker_name}）`;
  }
  
  return `${displayTitle}（${speaker_name} 發言）`;
}

/**
 * Format video time for display
 */
export function formatVideoTime(timeStr: string | null): string {
  if (!timeStr) return '';
  
  // If it's already in HH:MM:SS format, return as is
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
    return timeStr;
  }
  
  // If it's a timestamp, try to parse it
  try {
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
      return timeStr;
    }
    return date.toLocaleTimeString('zh-TW', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return timeStr;
  }
}

/**
 * Format video type for display
 */
export function formatVideoType(videoType: string | null): string {
  if (!videoType) return '';
  
  const typeMap: { [key: string]: string } = {
    'full': '完整會議',
    'clip': '片段',
    'segment': '片段',
    'meeting': '會議',
    'speech': '發言'
  };
  
  return typeMap[videoType.toLowerCase()] || videoType;
}

/**
 * Get database backend type from environment
 */
export function getDbBackend(): 'sqlite' | 'postgresql' | 'mysql' {
  const backend = process.env.DB_BACKEND?.toLowerCase() || 'sqlite';
  if (['sqlite', 'postgresql', 'mysql'].includes(backend)) {
    return backend as 'sqlite' | 'postgresql' | 'mysql';
  }
  return 'sqlite'; // fallback
}

/**
 * Normalize database timestamp fields to consistent format
 * Handles differences between SQLite (string) and PostgreSQL/MySQL (DateTime)
 */
export function normalizeTimestamp(timestamp: string | Date | null): string | null {
  if (!timestamp) return null;
  
  if (timestamp instanceof Date) {
    return timestamp.toISOString();
  }
  
  if (typeof timestamp === 'string') {
    // Try to parse and normalize the string
    try {
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return timestamp; // Return original if invalid
      }
      return date.toISOString();
    } catch {
      return timestamp; // Return original if parsing fails
    }
  }
  
  return null;
}

/**
 * Format timestamp for display
 */
export function formatTimestamp(timestamp: string | Date | null): string {
  if (!timestamp) return '';
  
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) {
      return timestamp.toString();
    }
    return date.toLocaleString('zh-TW');
  } catch {
    return timestamp?.toString() || '';
  }
}