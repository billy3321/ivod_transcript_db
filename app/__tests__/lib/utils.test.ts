import { formatCommitteeNames, formatIVODTitle, formatVideoTime, formatVideoType, formatTimestamp, normalizeTimestamp } from '@/lib/utils';

describe('Utils', () => {
  describe('formatCommitteeNames', () => {
    it('handles array input', () => {
      expect(formatCommitteeNames(['委員會A', '委員會B'])).toBe('委員會A, 委員會B');
    });

    it('handles JSON string input', () => {
      expect(formatCommitteeNames('["委員會C", "委員會D"]')).toBe('委員會C, 委員會D');
    });

    it('handles plain string input', () => {
      expect(formatCommitteeNames('委員會E')).toBe('委員會E');
    });

    it('handles null input', () => {
      expect(formatCommitteeNames(null)).toBe('N/A');
    });

    it('handles undefined input', () => {
      expect(formatCommitteeNames(undefined)).toBe('N/A');
    });
  });

  describe('formatIVODTitle', () => {
    it('formats title with regular speaker', () => {
      expect(formatIVODTitle('測試標題', '測試會議', '王委員')).toBe('測試標題（王委員 發言）');
    });

    it('formats title with "完整會議" speaker', () => {
      expect(formatIVODTitle('測試標題', '測試會議', '完整會議')).toBe('測試標題（完整會議）');
    });

    it('uses meeting_name when title is null', () => {
      expect(formatIVODTitle(null, '測試會議', '王委員')).toBe('測試會議（王委員 發言）');
    });

    it('handles no speaker', () => {
      expect(formatIVODTitle('測試標題', '測試會議', null)).toBe('測試標題');
    });

    it('handles all null values', () => {
      expect(formatIVODTitle(null, null, null)).toBe('會議記錄');
    });

    it('handles empty speaker string', () => {
      expect(formatIVODTitle('測試標題', '測試會議', '')).toBe('測試標題');
    });
  });

  describe('formatVideoTime', () => {
    it('returns time string as is when already formatted', () => {
      expect(formatVideoTime('14:30:45')).toBe('14:30:45');
      expect(formatVideoTime('9:15')).toBe('9:15');
    });

    it('formats Date object to time string', () => {
      const dateStr = '2023-01-01T14:30:45.000Z';
      const result = formatVideoTime(dateStr);
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('handles null input', () => {
      expect(formatVideoTime(null)).toBe('');
    });

    it('handles invalid time string', () => {
      expect(formatVideoTime('invalid')).toBe('invalid');
    });
  });

  describe('formatVideoType', () => {
    it('formats known video types', () => {
      expect(formatVideoType('full')).toBe('完整會議');
      expect(formatVideoType('clip')).toBe('片段');
      expect(formatVideoType('segment')).toBe('片段');
      expect(formatVideoType('meeting')).toBe('會議');
      expect(formatVideoType('speech')).toBe('發言');
    });

    it('handles case insensitive input', () => {
      expect(formatVideoType('FULL')).toBe('完整會議');
      expect(formatVideoType('Clip')).toBe('片段');
    });

    it('returns original string for unknown types', () => {
      expect(formatVideoType('unknown')).toBe('unknown');
    });

    it('handles null input', () => {
      expect(formatVideoType(null)).toBe('');
    });
  });

  describe('formatTimestamp', () => {
    it('formats Date object', () => {
      const date = new Date('2023-01-01T10:00:00Z');
      const result = formatTimestamp(date);
      expect(result).toMatch(/2023/);
    });

    it('formats date string', () => {
      const result = formatTimestamp('2023-01-01 10:00:00+08:00');
      expect(result).toMatch(/2023/);
    });

    it('handles invalid date string', () => {
      expect(formatTimestamp('invalid')).toBe('invalid');
    });

    it('handles null input', () => {
      expect(formatTimestamp(null)).toBe('');
    });
  });

  describe('normalizeTimestamp', () => {
    it('normalizes Date object to ISO string', () => {
      const date = new Date('2023-01-01T10:00:00Z');
      expect(normalizeTimestamp(date)).toBe('2023-01-01T10:00:00.000Z');
    });

    it('normalizes valid date string to ISO string', () => {
      const result = normalizeTimestamp('2023-01-01 10:00:00+08:00');
      expect(result).toMatch(/2023-01-01T\d{2}:00:00\.000Z/);
    });

    it('returns original for invalid date string', () => {
      expect(normalizeTimestamp('invalid')).toBe('invalid');
    });

    it('handles null input', () => {
      expect(normalizeTimestamp(null)).toBe(null);
    });
  });
});