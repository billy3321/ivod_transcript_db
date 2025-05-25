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