/**
 * Tests for lib/search/where-builder.ts
 */
import { buildIVODWhere, parseIvodIds } from '@/lib/search/where-builder';

describe('parseIvodIds', () => {
  it('parses comma-separated positive integers', () => {
    expect(parseIvodIds('1,2,3')).toEqual([1, 2, 3]);
  });
  it('trims whitespace', () => {
    expect(parseIvodIds('1, 2,  3 ')).toEqual([1, 2, 3]);
  });
  it('filters non-numeric', () => {
    expect(parseIvodIds('1,abc,3')).toEqual([1, 3]);
  });
  it('filters non-positive', () => {
    expect(parseIvodIds('-1,0,2')).toEqual([2]);
  });
  it('returns empty for undefined / empty', () => {
    expect(parseIvodIds(undefined)).toEqual([]);
    expect(parseIvodIds('')).toEqual([]);
  });
});

describe('buildIVODWhere', () => {
  describe('with no filters', () => {
    it('returns empty object', () => {
      expect(buildIVODWhere({ dbBackend: 'sqlite' })).toEqual({});
    });
  });

  describe('query (keyword)', () => {
    it('builds OR across multiple fields with queryScope=all', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        query: 'foo',
        queryScope: 'all',
      });
      expect(w.AND).toBeDefined();
      const orCond = w.AND.find((c: any) => c.OR);
      expect(orCond).toBeDefined();
      // 含 title / meeting_name / speaker_name / committee_names + 2 個 transcript 欄位
      const fields = orCond.OR.map((c: any) => Object.keys(c)[0]);
      expect(fields).toEqual(
        expect.arrayContaining([
          'title',
          'meeting_name',
          'speaker_name',
          'committee_names',
          'ai_transcript',
          'ly_transcript',
        ])
      );
      expect(fields).not.toContain('meeting_code_str');
    });

    it('includes meeting_code_str when includeMeetingCode=true', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        query: 'foo',
        includeMeetingCode: true,
      });
      const orCond = w.AND.find((c: any) => c.OR);
      const fields = orCond.OR.map((c: any) => Object.keys(c)[0]);
      expect(fields).toContain('meeting_code_str');
    });

    it('queryScope=transcript_only searches only transcripts', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        query: 'foo',
        queryScope: 'transcript_only',
      });
      const orCond = w.AND.find((c: any) => c.OR);
      const fields = orCond.OR.map((c: any) => Object.keys(c)[0]);
      // 只有 transcript 欄位
      expect(fields).toEqual(expect.arrayContaining(['ai_transcript', 'ly_transcript']));
      expect(fields).not.toContain('title');
      expect(fields).not.toContain('meeting_name');
    });

    it('transcriptionSource=ly_only only searches ly_transcript', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        query: 'foo',
        queryScope: 'transcript_only',
        transcriptionSource: 'ly_only',
      });
      const orCond = w.AND.find((c: any) => c.OR);
      const fields = orCond.OR.map((c: any) => Object.keys(c)[0]);
      expect(fields).toEqual(['ly_transcript']);
    });
  });

  describe('single-value filters', () => {
    it('meetingName adds standalone condition', () => {
      const w: any = buildIVODWhere({ dbBackend: 'sqlite', meetingName: 'foo' });
      expect(w.AND[0]).toEqual({ meeting_name: { contains: 'foo' } });
    });

    it('speaker adds standalone condition', () => {
      const w: any = buildIVODWhere({ dbBackend: 'sqlite', speaker: 'someone' });
      expect(w.AND[0]).toEqual({ speaker_name: { contains: 'someone' } });
    });

    it('committee adds standalone condition', () => {
      const w: any = buildIVODWhere({ dbBackend: 'sqlite', committee: 'foo' });
      expect(w.AND[0]).toEqual({ committee_names: { contains: 'foo' } });
    });
  });

  describe('array filters (MCP-style)', () => {
    it('speakers array → OR group', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        speakers: ['a', 'b'],
      });
      expect(w.AND[0]).toEqual({
        OR: [
          { speaker_name: { contains: 'a' } },
          { speaker_name: { contains: 'b' } },
        ],
      });
    });

    it('committees array → OR group', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        committees: ['a', 'b'],
      });
      expect(w.AND[0]).toEqual({
        OR: [
          { committee_names: { contains: 'a' } },
          { committee_names: { contains: 'b' } },
        ],
      });
    });

    it('empty arrays add no condition', () => {
      expect(buildIVODWhere({ dbBackend: 'sqlite', speakers: [] })).toEqual({});
    });
  });

  describe('date range', () => {
    it('only date_from', () => {
      const w: any = buildIVODWhere({ dbBackend: 'sqlite', dateFrom: '2025-01-01' });
      const dc = w.AND[0];
      expect(dc.date.gte).toBeInstanceOf(Date);
      expect(dc.date.lte).toBeUndefined();
    });

    it('only date_to', () => {
      const w: any = buildIVODWhere({ dbBackend: 'sqlite', dateTo: '2025-12-31' });
      const dc = w.AND[0];
      expect(dc.date.lte).toBeInstanceOf(Date);
      expect(dc.date.gte).toBeUndefined();
    });

    it('both range → single date condition with gte+lte', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        dateFrom: '2025-01-01',
        dateTo: '2025-12-31',
      });
      // 單一 date 條件
      const dateConds = w.AND.filter((c: any) => c.date);
      expect(dateConds.length).toBe(1);
      expect(dateConds[0].date.gte).toBeInstanceOf(Date);
      expect(dateConds[0].date.lte).toBeInstanceOf(Date);
    });

    it('invalid date string ignored', () => {
      expect(buildIVODWhere({ dbBackend: 'sqlite', dateFrom: 'not-a-date' })).toEqual({});
    });
  });

  describe('ivodIds', () => {
    it('builds IN clause for non-empty array', () => {
      const w: any = buildIVODWhere({ dbBackend: 'sqlite', ivodIds: [1, 2, 3] });
      expect(w.AND[0]).toEqual({ ivod_id: { in: [1, 2, 3] } });
    });

    it('empty array adds no condition', () => {
      expect(buildIVODWhere({ dbBackend: 'sqlite', ivodIds: [] })).toEqual({});
    });
  });

  describe('requireTranscript', () => {
    it('requires either transcript when source=all', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        requireTranscript: true,
        transcriptionSource: 'all',
      });
      expect(w.AND[0]).toEqual({
        OR: [
          { ly_transcript: { not: null } },
          { ai_transcript: { not: null } },
        ],
      });
    });

    it('requires only ly_transcript when source=ly_only', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        requireTranscript: true,
        transcriptionSource: 'ly_only',
      });
      expect(w.AND[0]).toEqual({ ly_transcript: { not: null } });
    });

    it('skipped when requireTranscript=false', () => {
      expect(buildIVODWhere({ dbBackend: 'sqlite', requireTranscript: false })).toEqual({});
    });
  });

  describe('combination', () => {
    it('combines query + single filter + date + ids', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'sqlite',
        query: 'foo',
        speaker: 'someone',
        dateFrom: '2025-01-01',
        ivodIds: [10, 20],
      });
      expect(w.AND).toBeDefined();
      // 預期 4 個 AND 條件：q OR group、speaker、date、ids
      expect(w.AND.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('PostgreSQL backend differences', () => {
    it('uses mode=insensitive for general fields', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'postgresql',
        speaker: 'foo',
      });
      expect(w.AND[0]).toEqual({
        speaker_name: { contains: 'foo', mode: 'insensitive' },
      });
    });

    it('uses array has for committee_names', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'postgresql',
        committee: 'foo',
      });
      expect(w.AND[0]).toEqual({ committee_names: { has: 'foo' } });
    });
  });

  describe('MySQL backend differences', () => {
    it('uses contains (no mode) for general fields', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'mysql',
        speaker: 'foo',
      });
      expect(w.AND[0]).toEqual({ speaker_name: { contains: 'foo' } });
    });

    it('uses string_contains for committee_names JSON field', () => {
      const w: any = buildIVODWhere({
        dbBackend: 'mysql',
        committee: 'foo',
      });
      expect(w.AND[0]).toEqual({ committee_names: { string_contains: 'foo' } });
    });
  });
});
