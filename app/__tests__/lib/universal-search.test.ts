/**
 * Tests for universal-search.ts
 * 驗證跨後端（SQLite / PostgreSQL / MySQL）SQL 生成正確
 */

// Mock prisma 前必須先設定，避免引入時就觸發
const mockQueryRaw = jest.fn();

jest.mock('@/lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRaw: (...args: any[]) => mockQueryRaw(...args),
  },
}));

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    logDatabaseError: jest.fn(),
  },
}));

// getDbBackend 透過 mock 切換後端做測試
let currentBackend: 'sqlite' | 'postgresql' | 'mysql' = 'sqlite';
jest.mock('@/lib/utils', () => ({
  ...jest.requireActual('@/lib/utils'),
  getDbBackend: () => currentBackend,
  convertToDate: (s: string) => (s ? new Date(s) : null),
}));

import { universalSearch, shouldUseUniversalSearch } from '@/lib/universal-search';

function setupQueryRawMock(rows: any[], count: number | bigint) {
  mockQueryRaw.mockReset();
  // 第一次呼叫回傳 data，第二次回傳 count
  mockQueryRaw
    .mockResolvedValueOnce(rows)
    .mockResolvedValueOnce([{ count }]);
}

/**
 * 從 mockQueryRaw 的呼叫紀錄取出 SQL 文字（已合併 placeholder 與參數的可讀版）
 * Prisma.sql 物件有 .strings (TemplateStringsArray) 與 .values (參數)
 */
function getCapturedSql(callIndex: number): { text: string; values: any[] } {
  const call = mockQueryRaw.mock.calls[callIndex];
  expect(call).toBeDefined();
  const sqlObj = call[0];
  // Prisma.Sql 的 inspect 屬性
  return {
    text: typeof sqlObj.text === 'string' ? sqlObj.text : sqlObj.sql || '',
    values: Array.isArray(sqlObj.values) ? sqlObj.values : [],
  };
}

describe('universal-search', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  describe('shouldUseUniversalSearch', () => {
    it('returns true when meeting_name is provided', () => {
      expect(shouldUseUniversalSearch({ meeting_name: 'foo' })).toBe(true);
    });
    it('returns true when speaker is provided', () => {
      expect(shouldUseUniversalSearch({ speaker: 'bar' })).toBe(true);
    });
    it('returns true when committee is provided', () => {
      expect(shouldUseUniversalSearch({ committee: 'baz' })).toBe(true);
    });
    it('returns false when only q is provided', () => {
      expect(shouldUseUniversalSearch({ q: 'foo' })).toBe(false);
    });
    it('returns false when no filters', () => {
      expect(shouldUseUniversalSearch({})).toBe(false);
    });
  });

  describe('SQLite backend', () => {
    beforeAll(() => {
      currentBackend = 'sqlite';
    });

    it('builds LIKE query for committee with %value% pattern', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ committee: '經濟', page: 1, pageSize: 20 });

      const data = getCapturedSql(0);
      expect(data.text).toContain('FROM ivod_transcripts');
      // SQLite 使用 LIKE
      expect(data.text).toContain('committee_names LIKE');
      // 不使用 ILIKE / array_to_string / JSON_SEARCH
      expect(data.text).not.toContain('ILIKE');
      expect(data.text).not.toContain('array_to_string');
      expect(data.text).not.toContain('JSON_SEARCH');
      // %經濟% pattern 應有
      expect(data.values).toContain('%經濟%');
    });

    it('uses LIKE for all general-text fields', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ speaker: '王', meeting_name: '會議' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/speaker_name\s+LIKE/);
      expect(data.text).toMatch(/meeting_name\s+LIKE/);
    });
  });

  describe('PostgreSQL backend', () => {
    beforeAll(() => {
      currentBackend = 'postgresql';
    });

    it('builds ILIKE + array_to_string for committee_names (String[] field)', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ committee: '經濟' });

      const data = getCapturedSql(0);
      expect(data.text).toContain("array_to_string(committee_names, ',')");
      expect(data.text).toContain('ILIKE');
      // 不使用 LIKE for general fields
      expect(data.text).not.toMatch(/committee_names\s+LIKE/);
      expect(data.values).toContain('%經濟%');
    });

    it('uses ILIKE for general-text fields', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ speaker: '王', meeting_name: '會議' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/speaker_name\s+ILIKE/);
      expect(data.text).toMatch(/meeting_name\s+ILIKE/);
      expect(data.text).not.toContain(' LIKE ');
    });
  });

  describe('MySQL backend', () => {
    beforeAll(() => {
      currentBackend = 'mysql';
    });

    it('builds JSON_SEARCH for committee_names (JSON field)', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ committee: '經濟' });

      const data = getCapturedSql(0);
      expect(data.text).toContain('JSON_SEARCH(committee_names');
      expect(data.text).not.toContain('ILIKE');
      expect(data.text).not.toContain('array_to_string');
      expect(data.values).toContain('%經濟%');
    });

    it('uses LIKE (case insensitive via collation) for general fields', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ speaker: '王' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/speaker_name\s+LIKE/);
      expect(data.text).not.toContain('ILIKE');
    });
  });

  describe('IDs filter (cross-backend)', () => {
    beforeAll(() => {
      currentBackend = 'sqlite';
    });

    it('uses parameterized IN clause for ivod_id', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ ids: '1,2,3', meeting_name: 'foo' });

      const data = getCapturedSql(0);
      expect(data.text).toContain('ivod_id IN');
      // 1, 2, 3 應該都是 parameter values
      expect(data.values).toContain(1);
      expect(data.values).toContain(2);
      expect(data.values).toContain(3);
    });

    it('filters out non-numeric and non-positive ids', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ ids: '1,abc,-5,0,4', meeting_name: 'foo' });

      const data = getCapturedSql(0);
      // 只有 1 和 4 是有效正整數，應該都在 values 中
      expect(data.values).toContain(1);
      expect(data.values).toContain(4);
      // -5 不該出現（無法用 "不該包含 0" 來驗證，因為 OFFSET 也會帶 0）
      expect(data.values).not.toContain(-5);
      // SQL text 應該只有兩個 IN placeholder
      // 用 regex 抓出 "ivod_id IN (...)" 之後的 placeholder 數量
      const inMatch = data.text.match(/ivod_id IN \(([^)]+)\)/);
      expect(inMatch).toBeTruthy();
      if (inMatch) {
        const placeholders = inMatch[1].split(',');
        expect(placeholders.length).toBe(2);
      }
    });

    it('skips IN clause entirely when no valid ids', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ ids: 'abc,xyz', meeting_name: 'foo' });

      const data = getCapturedSql(0);
      expect(data.text).not.toContain('ivod_id IN');
    });
  });

  describe('Date range filter', () => {
    beforeAll(() => {
      currentBackend = 'sqlite';
    });

    it('applies date >= for date_from', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ date_from: '2025-01-01', meeting_name: 'foo' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/date\s*>=/);
    });

    it('applies date <= for date_to', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ date_to: '2025-12-31', meeting_name: 'foo' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/date\s*<=/);
    });
  });

  describe('Pagination & sorting', () => {
    beforeAll(() => {
      currentBackend = 'sqlite';
    });

    it('uses ORDER BY date DESC by default', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ meeting_name: 'foo' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/ORDER BY date DESC/i);
    });

    it('uses ORDER BY date ASC when sort=date_asc', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ meeting_name: 'foo', sort: 'date_asc' });

      const data = getCapturedSql(0);
      expect(data.text).toMatch(/ORDER BY date ASC/i);
    });

    it('applies LIMIT and OFFSET based on page/pageSize', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({ meeting_name: 'foo', page: 3, pageSize: 10 });

      const data = getCapturedSql(0);
      expect(data.text).toContain('LIMIT');
      expect(data.text).toContain('OFFSET');
      expect(data.values).toContain(10); // pageSize
      expect(data.values).toContain(20); // skip = (3-1) * 10
    });
  });

  describe('Empty filter (Prisma.empty branch)', () => {
    beforeAll(() => {
      currentBackend = 'sqlite';
    });

    it('runs SELECT without WHERE when no filters provided', async () => {
      setupQueryRawMock([], 0);
      // 不帶任何 filter，但 universalSearch 仍會被 ivods.ts shouldUseUniversalSearch 排除；
      // 這裡直接呼叫測試底層 SQL 生成
      await universalSearch({});

      const data = getCapturedSql(0);
      // WHERE 子句不應該存在
      expect(data.text).not.toMatch(/\bWHERE\b/);
      expect(data.text).toContain('SELECT');
      expect(data.text).toContain('FROM ivod_transcripts');
      expect(data.text).toContain('ORDER BY date DESC');
      expect(data.text).toContain('LIMIT');
      expect(data.text).toContain('OFFSET');
    });

    it('count query also runs without WHERE', async () => {
      setupQueryRawMock([], 0);
      await universalSearch({});

      const count = getCapturedSql(1);
      expect(count.text).toContain('COUNT(*)');
      expect(count.text).not.toMatch(/\bWHERE\b/);
    });
  });

  describe('Result format', () => {
    beforeAll(() => {
      currentBackend = 'sqlite';
    });

    it('returns data + total', async () => {
      const rows = [{ ivod_id: 1, title: 'a' }];
      setupQueryRawMock(rows, 42);

      const result = await universalSearch({ meeting_name: 'foo' });

      expect(result.data).toEqual(rows);
      expect(result.total).toBe(42);
    });

    it('handles BigInt count correctly', async () => {
      setupQueryRawMock([], BigInt(123));

      const result = await universalSearch({ meeting_name: 'foo' });

      expect(result.total).toBe(123);
    });

    it('returns empty array when query returns nothing', async () => {
      setupQueryRawMock([], 0);

      const result = await universalSearch({ meeting_name: 'nonexistent' });

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });
});
