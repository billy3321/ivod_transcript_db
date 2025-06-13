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
 * Automatically converts to user's local timezone for display
 */
export function formatTimestamp(timestamp: string | Date | null): string {
  if (!timestamp) return '';
  
  try {
    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    if (isNaN(date.getTime())) {
      return timestamp.toString();
    }
    
    // 顯示時間並自動根據用戶所在時區調整
    return date.toLocaleString('zh-TW', {
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  } catch {
    return timestamp?.toString() || '';
  }
}

/**
 * Create database-specific contains condition for search queries
 * Handles different field types and database backends properly
 */
export function createContainsCondition(field: string, value: string, dbBackend: 'sqlite' | 'postgresql' | 'mysql' = 'sqlite') {
  // Special handling for committee_names field based on database backend
  if (field === 'committee_names') {
    if (dbBackend === 'postgresql') {
      // PostgreSQL array field - use 'has' for array contains operation
      return { [field]: { has: value } };
    } else if (dbBackend === 'mysql') {
      // MySQL JSON field - use string_contains (even though it doesn't work for partial matching)
      // The calling code should handle this differently for partial matching
      return { [field]: { string_contains: value } };
    } else {
      // SQLite string field - use regular contains
      return { [field]: { contains: value } };
    }
  }
  
  // For MySQL, case insensitive mode is not supported on string fields
  if (dbBackend === 'mysql') {
    return { [field]: { contains: value } };
  }
  
  // For other databases, use case-insensitive search when supported
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  return isInsensitiveSupported
    ? { [field]: { contains: value, mode: 'insensitive' as const } }
    : { [field]: { contains: value } };
}

/**
 * Convert date string to proper Date object for database queries
 */
export function convertToDate(dateString: string): Date | null {
  if (!dateString) return null;
  
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return null;
    }
    return date;
  } catch {
    return null;
  }
}