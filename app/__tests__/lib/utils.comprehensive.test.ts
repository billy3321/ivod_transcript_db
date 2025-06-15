import {
  formatCommitteeNames,
  formatIVODTitle,
  formatVideoTime,
  formatVideoType,
  getDbBackend,
  normalizeTimestamp,
  formatTimestamp,
  createContainsCondition,
  convertToDate
} from '@/lib/utils';

describe('Utils Library Comprehensive Tests', () => {
  describe('formatCommitteeNames', () => {
    it('returns N/A for null/undefined input', () => {
      expect(formatCommitteeNames(null)).toBe('N/A');
      expect(formatCommitteeNames(undefined)).toBe('N/A');
    });

    it('handles array input', () => {
      expect(formatCommitteeNames(['委員會A', '委員會B'])).toBe('委員會A, 委員會B');
      expect(formatCommitteeNames([])).toBe('');
    });

    it('handles JSON string input (SQLite format)', () => {
      expect(formatCommitteeNames('["委員會A", "委員會B"]')).toBe('委員會A, 委員會B');
      expect(formatCommitteeNames('[]')).toBe('');
    });

    it('handles invalid JSON string input', () => {
      expect(formatCommitteeNames('invalid json')).toBe('invalid json');
      expect(formatCommitteeNames('委員會A, 委員會B')).toBe('委員會A, 委員會B');
    });

    it('handles non-array JSON string', () => {
      expect(formatCommitteeNames('"single committee"')).toBe('"single committee"');
      expect(formatCommitteeNames('{"key": "value"}')).toBe('{"key": "value"}');
    });

    it('handles non-string, non-array input', () => {
      expect(formatCommitteeNames(123 as any)).toBe('123');
      expect(formatCommitteeNames(true as any)).toBe('true');
    });
  });

  describe('formatIVODTitle', () => {
    it('formats title with regular speaker', () => {
      expect(formatIVODTitle('會議標題', '會議名稱', '王委員'))
        .toBe('會議標題（王委員 發言）');
    });

    it('handles complete meeting speaker', () => {
      expect(formatIVODTitle('會議標題', '會議名稱', '完整會議'))
        .toBe('會議標題（完整會議）');
    });

    it('uses meeting_name when title is null', () => {
      expect(formatIVODTitle(null, '會議名稱', '王委員'))
        .toBe('會議名稱（王委員 發言）');
    });

    it('uses default title when both title and meeting_name are null', () => {
      expect(formatIVODTitle(null, null, '王委員'))
        .toBe('會議記錄（王委員 發言）');
    });

    it('handles null speaker_name', () => {
      expect(formatIVODTitle('會議標題', '會議名稱', null))
        .toBe('會議標題');
    });

    it('handles all null inputs', () => {
      expect(formatIVODTitle(null, null, null))
        .toBe('會議記錄');
    });
  });

  describe('formatVideoTime', () => {
    it('returns empty string for null input', () => {
      expect(formatVideoTime(null)).toBe('');
    });

    it('returns time string unchanged if already in HH:MM:SS format', () => {
      expect(formatVideoTime('10:30:45')).toBe('10:30:45');
      expect(formatVideoTime('1:30:45')).toBe('1:30:45');
    });

    it('returns time string unchanged if in HH:MM format', () => {
      expect(formatVideoTime('10:30')).toBe('10:30');
      expect(formatVideoTime('1:30')).toBe('1:30');
    });

    it('formats valid timestamp strings', () => {
      const result = formatVideoTime('2024-01-01T10:30:45.000Z');
      expect(result).toMatch(/\d{2}:\d{2}:\d{2}/);
    });

    it('returns original string for invalid timestamps', () => {
      expect(formatVideoTime('invalid-date')).toBe('invalid-date');
      expect(formatVideoTime('not a timestamp')).toBe('not a timestamp');
    });

    it('handles malformed time strings', () => {
      expect(formatVideoTime('25:70:80')).toBe('25:70:80');
    });
  });

  describe('formatVideoType', () => {
    it('returns empty string for null input', () => {
      expect(formatVideoType(null)).toBe('');
    });

    it('maps known video types', () => {
      expect(formatVideoType('full')).toBe('完整會議');
      expect(formatVideoType('clip')).toBe('片段');
      expect(formatVideoType('segment')).toBe('片段');
      expect(formatVideoType('meeting')).toBe('會議');
      expect(formatVideoType('speech')).toBe('發言');
    });

    it('handles case insensitive mapping', () => {
      expect(formatVideoType('FULL')).toBe('完整會議');
      expect(formatVideoType('Full')).toBe('完整會議');
      expect(formatVideoType('SPEECH')).toBe('發言');
    });

    it('returns original string for unknown types', () => {
      expect(formatVideoType('unknown')).toBe('unknown');
      expect(formatVideoType('custom-type')).toBe('custom-type');
    });
  });

  describe('getDbBackend', () => {
    const originalEnv = process.env.DB_BACKEND;

    afterEach(() => {
      process.env.DB_BACKEND = originalEnv;
    });

    it('returns sqlite as default when no env var set', () => {
      delete process.env.DB_BACKEND;
      expect(getDbBackend()).toBe('sqlite');
    });

    it('returns valid backend types', () => {
      process.env.DB_BACKEND = 'postgresql';
      expect(getDbBackend()).toBe('postgresql');

      process.env.DB_BACKEND = 'mysql';
      expect(getDbBackend()).toBe('mysql');

      process.env.DB_BACKEND = 'sqlite';
      expect(getDbBackend()).toBe('sqlite');
    });

    it('handles case insensitive env var', () => {
      process.env.DB_BACKEND = 'POSTGRESQL';
      expect(getDbBackend()).toBe('postgresql');

      process.env.DB_BACKEND = 'MySQL';
      expect(getDbBackend()).toBe('mysql');
    });

    it('returns sqlite for invalid backend types', () => {
      process.env.DB_BACKEND = 'invalid';
      expect(getDbBackend()).toBe('sqlite');

      process.env.DB_BACKEND = 'oracle';
      expect(getDbBackend()).toBe('sqlite');
    });
  });

  describe('normalizeTimestamp', () => {
    it('returns null for null/undefined input', () => {
      expect(normalizeTimestamp(null)).toBeNull();
      expect(normalizeTimestamp(undefined as any)).toBeNull();
    });

    it('normalizes Date objects to ISO string', () => {
      const date = new Date('2024-01-01T10:30:45.000Z');
      expect(normalizeTimestamp(date)).toBe('2024-01-01T10:30:45.000Z');
    });

    it('normalizes valid date strings to ISO string', () => {
      expect(normalizeTimestamp('2024-01-01')).toBe('2024-01-01T00:00:00.000Z');
      // Note: Time may be adjusted based on timezone
      const result = normalizeTimestamp('2024-01-01T10:30:45');
      expect(result).toMatch(/2024-01-01T\d{2}:30:45\.000Z/);
    });

    it('returns original string for invalid date strings', () => {
      expect(normalizeTimestamp('invalid-date')).toBe('invalid-date');
      expect(normalizeTimestamp('not a date')).toBe('not a date');
    });

    it('handles edge cases', () => {
      expect(normalizeTimestamp('')).toBeNull();
      // '0' parses as epoch time but may be adjusted for timezone
      const result = normalizeTimestamp('0');
      expect(result).toMatch(/19\d{2}-\d{2}-\d{2}T\d{2}:00:00\.000Z/);
    });
  });

  describe('formatTimestamp', () => {
    it('returns empty string for null/undefined input', () => {
      expect(formatTimestamp(null)).toBe('');
      expect(formatTimestamp(undefined as any)).toBe('');
    });

    it('formats Date objects', () => {
      const date = new Date('2024-01-01T10:30:45.000Z');
      const result = formatTimestamp(date);
      expect(result).toMatch(/2024\/01\/01 \d{2}:\d{2}:\d{2}/);
    });

    it('formats valid date strings', () => {
      const result = formatTimestamp('2024-01-01T10:30:45.000Z');
      expect(result).toMatch(/2024\/01\/01 \d{2}:\d{2}:\d{2}/);
    });

    it('returns original string for invalid dates', () => {
      expect(formatTimestamp('invalid-date')).toBe('invalid-date');
      expect(formatTimestamp('not a date')).toBe('not a date');
    });

    it('handles numeric input', () => {
      const timestamp = 1704096645000; // 2024-01-01T10:30:45.000Z
      const result = formatTimestamp(new Date(timestamp));
      expect(result).toMatch(/2024\/01\/01 \d{2}:\d{2}:\d{2}/);
    });
  });

  describe('createContainsCondition', () => {
    describe('regular fields', () => {
      it('creates basic contains condition for SQLite', () => {
        expect(createContainsCondition('title', 'test', 'sqlite'))
          .toEqual({ title: { contains: 'test' } });
      });

      it('creates case-insensitive condition for PostgreSQL', () => {
        expect(createContainsCondition('title', 'test', 'postgresql'))
          .toEqual({ title: { contains: 'test', mode: 'insensitive' } });
      });

      it('creates basic condition for MySQL (no case insensitive)', () => {
        expect(createContainsCondition('title', 'test', 'mysql'))
          .toEqual({ title: { contains: 'test' } });
      });

      it('defaults to SQLite behavior when no backend specified', () => {
        expect(createContainsCondition('title', 'test'))
          .toEqual({ title: { contains: 'test' } });
      });
    });

    describe('committee_names field', () => {
      it('uses has operator for PostgreSQL array field', () => {
        expect(createContainsCondition('committee_names', 'test', 'postgresql'))
          .toEqual({ committee_names: { has: 'test' } });
      });

      it('uses string_contains for MySQL JSON field', () => {
        expect(createContainsCondition('committee_names', 'test', 'mysql'))
          .toEqual({ committee_names: { string_contains: 'test' } });
      });

      it('uses regular contains for SQLite string field', () => {
        expect(createContainsCondition('committee_names', 'test', 'sqlite'))
          .toEqual({ committee_names: { contains: 'test' } });
      });
    });
  });

  describe('convertToDate', () => {
    it('returns null for empty string', () => {
      expect(convertToDate('')).toBeNull();
      expect(convertToDate(null as any)).toBeNull();
      expect(convertToDate(undefined as any)).toBeNull();
    });

    it('converts valid date strings', () => {
      const result = convertToDate('2024-01-01');
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2024);
      expect(result?.getMonth()).toBe(0); // January is 0
      expect(result?.getDate()).toBe(1);
    });

    it('converts ISO date strings', () => {
      const result = convertToDate('2024-01-01T10:30:45.000Z');
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe('2024-01-01T10:30:45.000Z');
    });

    it('returns null for invalid date strings', () => {
      expect(convertToDate('invalid-date')).toBeNull();
      expect(convertToDate('not a date')).toBeNull();
      expect(convertToDate('2024-13-45')).toBeNull(); // Invalid month/day
    });

    it('handles various valid date formats', () => {
      expect(convertToDate('2024/01/01')).toBeInstanceOf(Date);
      expect(convertToDate('Jan 1, 2024')).toBeInstanceOf(Date);
      expect(convertToDate('1/1/2024')).toBeInstanceOf(Date);
    });

    it('handles edge cases', () => {
      expect(convertToDate('0')).toBeInstanceOf(Date); // Epoch
      // Large numeric string is invalid date
      expect(convertToDate('1704067200000')).toBeNull();
    });
  });
});