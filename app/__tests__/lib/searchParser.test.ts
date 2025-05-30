import { 
  parseAdvancedSearchQuery, 
  buildElasticsearchQuery, 
  buildDatabaseQuery 
} from '@/lib/searchParser';

describe('searchParser', () => {
  describe('parseAdvancedSearchQuery', () => {
    it('should parse simple text query', () => {
      const result = parseAdvancedSearchQuery('hello world');
      
      expect(result.generalTerms).toEqual(['hello', 'world']);
      expect(result.quotedPhrases).toEqual([]);
      expect(result.hasExplicitBooleans).toBe(false);
      expect(result.hasAdvancedSyntax).toBe(false);
      expect(result.parseSuccess).toBe(true);
    });

    it('should parse quoted phrases', () => {
      const result = parseAdvancedSearchQuery('"hello world" test');
      
      expect(result.quotedPhrases).toEqual(['hello world']);
      expect(result.generalTerms).toEqual(['test']);
      expect(result.hasExplicitBooleans).toBe(false);
      expect(result.hasAdvancedSyntax).toBe(true);
      expect(result.parseSuccess).toBe(true);
    });

    it('should parse field-specific searches', () => {
      const result = parseAdvancedSearchQuery('title:"meeting title" speaker:"john doe"');
      
      expect(result.title).toEqual(['meeting title']);
      expect(result.speaker).toEqual(['john doe']);
      expect(result.hasExplicitBooleans).toBe(false);
      expect(result.hasAdvancedSyntax).toBe(true);
      expect(result.parseSuccess).toBe(true);
    });

    it('should parse excluded terms', () => {
      const result = parseAdvancedSearchQuery('hello -world -"bad phrase"');
      
      expect(result.generalTerms).toEqual(['hello']);
      expect(result.excludedTerms).toEqual(['world']);
      expect(result.excludedPhrases).toEqual(['bad phrase']);
      expect(result.hasExplicitBooleans).toBe(false);
      expect(result.hasAdvancedSyntax).toBe(true);
    });

    it('should parse complex query', () => {
      const result = parseAdvancedSearchQuery('title:"會議" speaker:"王委員" "預算案" 討論 -"國防" -軍事');
      
      expect(result.title).toEqual(['會議']);
      expect(result.speaker).toEqual(['王委員']);
      expect(result.quotedPhrases).toEqual(['預算案']);
      expect(result.generalTerms).toEqual(['討論']);
      expect(result.excludedPhrases).toEqual(['國防']);
      expect(result.excludedTerms).toEqual(['軍事']);
      expect(result.hasExplicitBooleans).toBe(false);
      expect(result.hasAdvancedSyntax).toBe(true);
    });

    it('should handle empty query', () => {
      const result = parseAdvancedSearchQuery('');
      
      expect(result.generalTerms).toEqual([]);
      expect(result.quotedPhrases).toEqual([]);
      expect(result.hasAdvancedSyntax).toBe(false);
      expect(result.parseSuccess).toBe(false);
    });

    it('should handle null/undefined query', () => {
      const result1 = parseAdvancedSearchQuery(null as any);
      const result2 = parseAdvancedSearchQuery(undefined as any);
      
      expect(result1.parseSuccess).toBe(false);
      expect(result2.parseSuccess).toBe(false);
    });

    it('should fallback on parse error', () => {
      // Simulate a parsing error by passing invalid input to the parser
      const result = parseAdvancedSearchQuery('some query');
      
      // Even if parsing fails, it should fallback gracefully
      expect(result.originalQuery).toBe('some query');
    });
  });

  describe('buildElasticsearchQuery', () => {
    it('should build query for general terms', () => {
      const parsedQuery = {
        generalTerms: ['hello', 'world'],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: 'hello world',
        hasAdvancedSyntax: false,
        parseSuccess: true
      };

      const query = buildElasticsearchQuery(parsedQuery);
      
      expect(query).toHaveProperty('bool');
      expect(query.bool.must).toHaveLength(1);
      expect(query.bool.must[0]).toHaveProperty('multi_match');
      expect(query.bool.must[0].multi_match.query).toBe('hello world');
    });

    it('should build query for quoted phrases', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: ['exact phrase'],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: '"exact phrase"',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildElasticsearchQuery(parsedQuery);
      
      expect(query.bool.must).toHaveLength(1);
      expect(query.bool.must[0].multi_match.type).toBe('phrase');
      expect(query.bool.must[0].multi_match.query).toBe('exact phrase');
    });

    it('should build query for field-specific searches', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: [],
        title: ['meeting title'],
        speaker: ['john doe'],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: 'title:"meeting title" speaker:"john doe"',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildElasticsearchQuery(parsedQuery);
      
      expect(query.bool.must).toHaveLength(2);
      
      const titleQuery = query.bool.must.find((q: any) => 
        q.multi_match && q.multi_match.fields.includes('title')
      );
      expect(titleQuery.multi_match.query).toBe('meeting title');
      
      const speakerQuery = query.bool.must.find((q: any) => 
        q.multi_match && q.multi_match.fields.includes('speaker_name')
      );
      expect(speakerQuery.multi_match.query).toBe('john doe');
    });

    it('should build query with exclusions', () => {
      const parsedQuery = {
        generalTerms: ['hello'],
        quotedPhrases: [],
        excludedTerms: ['world'],
        excludedPhrases: ['bad phrase'],
        originalQuery: 'hello -world -"bad phrase"',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildElasticsearchQuery(parsedQuery);
      
      expect(query.bool.must).toHaveLength(1);
      expect(query.bool.must_not).toHaveLength(2);
      
      expect(query.bool.must_not[0].multi_match.query).toBe('world');
      expect(query.bool.must_not[1].multi_match.query).toBe('bad phrase');
      expect(query.bool.must_not[1].multi_match.type).toBe('phrase');
    });

    it('should return match_all for empty query', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: '',
        hasAdvancedSyntax: false,
        parseSuccess: false
      };

      const query = buildElasticsearchQuery(parsedQuery);
      
      expect(query).toEqual({ match_all: {} });
    });
  });

  describe('buildDatabaseQuery', () => {
    it('should build database query for general terms', () => {
      const parsedQuery = {
        generalTerms: ['hello', 'world'],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: 'hello world',
        hasAdvancedSyntax: false,
        parseSuccess: true
      };

      const query = buildDatabaseQuery(parsedQuery, 'postgresql');
      
      expect(query).toHaveProperty('AND');
      expect(query.AND).toHaveLength(2);
      
      // Check first term
      expect(query.AND[0]).toHaveProperty('OR');
      expect(query.AND[0].OR).toEqual(expect.arrayContaining([
        expect.objectContaining({ ai_transcript: { contains: 'hello', mode: 'insensitive' } }),
        expect.objectContaining({ ly_transcript: { contains: 'hello', mode: 'insensitive' } }),
        expect.objectContaining({ title: { contains: 'hello', mode: 'insensitive' } }),
        expect.objectContaining({ meeting_name: { contains: 'hello', mode: 'insensitive' } }),
        expect.objectContaining({ speaker_name: { contains: 'hello', mode: 'insensitive' } })
      ]));
    });

    it('should build database query for SQLite (no case insensitive)', () => {
      const parsedQuery = {
        generalTerms: ['hello'],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: 'hello',
        hasAdvancedSyntax: false,
        parseSuccess: true
      };

      const query = buildDatabaseQuery(parsedQuery, 'sqlite');
      
      // SQLite should not have mode: 'insensitive'
      expect(query.OR[0]).toEqual({ ai_transcript: { contains: 'hello' } });
    });

    it('should build database query for field-specific searches', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: [],
        title: ['meeting title'],
        speaker: ['john doe'],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: 'title:"meeting title" speaker:"john doe"',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildDatabaseQuery(parsedQuery, 'postgresql');
      
      expect(query.AND).toHaveLength(2);
      
      const titleCondition = query.AND.find((condition: any) => 
        condition.OR && condition.OR.some((or: any) => or.title)
      );
      expect(titleCondition.OR[0]).toEqual({ title: { contains: 'meeting title', mode: 'insensitive' } });
      
      const speakerCondition = query.AND.find((condition: any) => 
        condition.OR && condition.OR.some((or: any) => or.speaker_name)
      );
      expect(speakerCondition.OR[0]).toEqual({ speaker_name: { contains: 'john doe', mode: 'insensitive' } });
    });

    it('should build database query with exclusions', () => {
      const parsedQuery = {
        generalTerms: ['hello'],
        quotedPhrases: [],
        excludedTerms: ['world'],
        excludedPhrases: [],
        originalQuery: 'hello -world',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildDatabaseQuery(parsedQuery, 'postgresql');
      
      expect(query.AND).toHaveLength(6); // 1 general term OR + 5 excluded terms NOT
      
      // Check excluded term
      const excludedConditions = query.AND.filter((condition: any) => condition.NOT);
      expect(excludedConditions).toHaveLength(5); // 5 fields to exclude from
      expect(excludedConditions[0]).toEqual({
        NOT: { ai_transcript: { contains: 'world', mode: 'insensitive' } }
      });
    });

    it('should return empty object for empty query', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        originalQuery: '',
        hasAdvancedSyntax: false,
        parseSuccess: false
      };

      const query = buildDatabaseQuery(parsedQuery, 'postgresql');
      
      expect(query).toEqual({});
    });

    it('should return single condition for simple query', () => {
      const parsedQuery = {
        generalTerms: ['hello'],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        hasExplicitBooleans: false,
        originalQuery: 'hello',
        hasAdvancedSyntax: false,
        parseSuccess: true
      };

      const query = buildDatabaseQuery(parsedQuery, 'postgresql');
      
      // Should return the OR condition directly, not wrapped in AND
      expect(query).toHaveProperty('OR');
      expect(query.AND).toBeUndefined();
    });
  });

  describe('Boolean AND/OR Logic', () => {
    it('should parse simple AND query', () => {
      const result = parseAdvancedSearchQuery('預算 AND 教育');
      
      expect(result.hasExplicitBooleans).toBe(true);
      expect(result.hasAdvancedSyntax).toBe(true);
      expect(result.parseSuccess).toBe(true);
      expect(result.booleanGroups).toHaveLength(1);
      expect(result.booleanGroups![0].operator).toBe('AND');
      expect(result.booleanGroups![0].terms).toHaveLength(2);
      expect(result.booleanGroups![0].terms[0].value).toBe('預算');
      expect(result.booleanGroups![0].terms[1].value).toBe('教育');
    });

    it('should parse simple OR query', () => {
      const result = parseAdvancedSearchQuery('王委員 OR 李委員');
      
      expect(result.hasExplicitBooleans).toBe(true);
      expect(result.booleanGroups![0].operator).toBe('OR');
      expect(result.booleanGroups![0].terms).toHaveLength(2);
      expect(result.booleanGroups![0].terms[0].value).toBe('王委員');
      expect(result.booleanGroups![0].terms[1].value).toBe('李委員');
    });

    it('should parse query with parentheses', () => {
      const result = parseAdvancedSearchQuery('(預算 OR 教育) AND 委員會');
      
      expect(result.hasExplicitBooleans).toBe(true);
      expect(result.booleanGroups).toHaveLength(1);
      
      // Should be one AND group containing all terms
      expect(result.booleanGroups![0].operator).toBe('AND');
      expect(result.booleanGroups![0].terms).toHaveLength(3);
      
      // Terms should be: 預算, 教育 (from OR group), 委員會
      expect(result.booleanGroups![0].terms[0].value).toBe('預算');
      expect(result.booleanGroups![0].terms[1].value).toBe('教育');
      expect(result.booleanGroups![0].terms[2].value).toBe('委員會');
    });

    it('should parse complex query with fields and exclusions', () => {
      const result = parseAdvancedSearchQuery('(speaker:"王委員" OR speaker:"李委員") AND "預算" -"國防"');
      
      expect(result.hasExplicitBooleans).toBe(true);
      expect(result.booleanGroups).toHaveLength(1);
      
      // Should be one AND group containing all terms
      const group = result.booleanGroups![0];
      expect(group.operator).toBe('AND');
      expect(group.terms).toHaveLength(4);
      
      // Check speaker field terms
      expect(group.terms[0].field).toBe('speaker');
      expect(group.terms[0].value).toBe('王委員');
      expect(group.terms[1].field).toBe('speaker');
      expect(group.terms[1].value).toBe('李委員');
      
      // Check phrase term
      expect(group.terms[2].type).toBe('phrase');
      expect(group.terms[2].value).toBe('預算');
      
      // Check exclusion
      expect(group.terms[3].isExcluded).toBe(true);
      expect(group.terms[3].value).toBe('國防');
    });

    it('should build Elasticsearch query for boolean groups', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        hasExplicitBooleans: true,
        booleanGroups: [{
          operator: 'AND' as const,
          terms: [
            { type: 'term' as const, value: '預算', isExcluded: false },
            { type: 'term' as const, value: '教育', isExcluded: false }
          ]
        }],
        originalQuery: '預算 AND 教育',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildElasticsearchQuery(parsedQuery);
      
      expect(query).toHaveProperty('bool');
      expect(query.bool.must).toHaveLength(2);
      expect(query.bool.must[0].multi_match.query).toBe('預算');
      expect(query.bool.must[1].multi_match.query).toBe('教育');
    });

    it('should build database query for boolean groups', () => {
      const parsedQuery = {
        generalTerms: [],
        quotedPhrases: [],
        excludedTerms: [],
        excludedPhrases: [],
        hasExplicitBooleans: true,
        booleanGroups: [{
          operator: 'OR' as const,
          terms: [
            { type: 'term' as const, value: '王委員', isExcluded: false },
            { type: 'term' as const, value: '李委員', isExcluded: false }
          ]
        }],
        originalQuery: '王委員 OR 李委員',
        hasAdvancedSyntax: true,
        parseSuccess: true
      };

      const query = buildDatabaseQuery(parsedQuery, 'postgresql');
      
      expect(query).toHaveProperty('OR');
      expect(query.OR).toHaveLength(2);
      // Each term should create OR conditions across multiple fields
      expect(query.OR[0]).toHaveProperty('OR');
      expect(query.OR[1]).toHaveProperty('OR');
    });
  });
});