/**
 * Advanced search query parser for IVOD transcript search
 * Supports quotes, AND/OR operators, parentheses, and field-specific searches
 */

// @ts-ignore - search-query-parser doesn't have TypeScript definitions
import * as searchQueryParser from 'search-query-parser';
import { logger } from './logger';

export interface SearchOptions {
  keywords?: string[];
  ranges?: string[];
  alwaysArray?: boolean;
  offsets?: boolean;
  exclude?: boolean;
}

export interface ParsedQuery {
  text?: string | string[];
  exclude?: {
    text?: string | string[];
    [key: string]: any;
  };
  [key: string]: any;
}

export interface AdvancedSearchQuery {
  // Main search terms
  generalTerms: string[];
  quotedPhrases: string[];
  
  // Field-specific searches
  title?: string[];
  speaker?: string[];
  meeting?: string[];
  committee?: string[];
  
  // Excluded terms
  excludedTerms: string[];
  excludedPhrases: string[];
  
  // Field-specific exclusions
  exclude?: {
    title?: string[];
    speaker?: string[];
    meeting?: string[];
    committee?: string[];
    [key: string]: any;
  };
  
  // Boolean logic structure
  booleanGroups?: BooleanGroup[];
  hasExplicitBooleans: boolean;
  
  // Original query for logging
  originalQuery: string;
  
  // Parse metadata
  hasAdvancedSyntax: boolean;
  parseSuccess: boolean;
}

export interface BooleanGroup {
  operator: 'AND' | 'OR';
  terms: BooleanTerm[];
}

export interface BooleanTerm {
  type: 'term' | 'phrase' | 'field' | 'exclude';
  value: string;
  field?: string;
  isExcluded?: boolean;
}

/**
 * Parse advanced search query with support for:
 * - Quoted phrases: "exact phrase"
 * - Field searches: title:"meeting title", speaker:"name"
 * - Exclusion: -term, -"phrase"
 * - Boolean operators: term1 AND term2, term1 OR term2
 * - Grouping: (term1 OR term2) AND term3
 */
export function parseAdvancedSearchQuery(query: string): AdvancedSearchQuery {
  const result: AdvancedSearchQuery = {
    generalTerms: [],
    quotedPhrases: [],
    excludedTerms: [],
    excludedPhrases: [],
    hasExplicitBooleans: false,
    originalQuery: query,
    hasAdvancedSyntax: false,
    parseSuccess: false
  };

  if (!query || typeof query !== 'string') {
    return result;
  }

  try {
    // Check if query contains explicit AND/OR operators
    result.hasExplicitBooleans = hasExplicitBooleans(query);
    
    // If query has explicit booleans, use custom boolean parser
    if (result.hasExplicitBooleans) {
      const booleanResult = parseBooleanQuery(query);
      Object.assign(result, booleanResult);
      result.hasAdvancedSyntax = true;
      result.parseSuccess = true;
      return result;
    }

    // Define search options for the parser
    const options: SearchOptions = {
      keywords: ['title', 'speaker', 'meeting', 'committee'],
      alwaysArray: true,
      offsets: false,
      exclude: true  // Enable exclusion parsing for -term syntax
    };

    // Check if query contains advanced syntax
    result.hasAdvancedSyntax = hasAdvancedSyntax(query);

    // Parse the query
    const parsed = searchQueryParser.parse(query, options);
    result.parseSuccess = true;

    // Extract quoted phrases from original query first
    const originalQuotedPhrases = extractQuotedPhrasesFromOriginal(query);
    
    // Handle case where parser returns a string (no keywords found)
    if (typeof parsed === 'string') {
      // Simple text search - split and process
      const terms = splitPreservingQuotes(parsed);
      terms.forEach(term => {
        const trimmed = term.trim();
        if (!trimmed || isBoolean(trimmed)) {
          return;
        }
        
        // Handle exclusions (terms starting with -)
        if (trimmed.startsWith('-')) {
          const excludedTerm = trimmed.substring(1);
          if (isQuotedPhrase(excludedTerm)) {
            result.excludedPhrases.push(removeQuotes(excludedTerm));
          } else {
            result.excludedTerms.push(excludedTerm);
          }
        } else if (isQuotedPhrase(trimmed)) {
          result.quotedPhrases.push(removeQuotes(trimmed));
        } else {
          result.generalTerms.push(trimmed);
        }
      });
    } else {
      // Object returned with parsed keywords
      // Extract general text terms if any
      if (parsed.text) {
        const textArray = Array.isArray(parsed.text) ? parsed.text : [parsed.text];
        textArray.forEach(term => {
          if (typeof term === 'string') {
            // Split on spaces to get individual terms
            const terms = term.split(/\s+/).filter(t => t.trim());
            terms.forEach(t => {
              const trimmed = t.trim();
              if (!trimmed || isBoolean(trimmed)) {
                return;
              }
              
              // Check if this term was originally quoted in the input query
              if (originalQuotedPhrases.includes(trimmed)) {
                result.quotedPhrases.push(trimmed);
              } else {
                result.generalTerms.push(trimmed);
              }
            });
          }
        });
      }
    }

    // Extract field-specific searches (only if parsed is an object)
    if (typeof parsed === 'object' && parsed !== null) {
      if (parsed.title) {
        result.title = Array.isArray(parsed.title) ? parsed.title : [parsed.title];
      }
      if (parsed.speaker) {
        result.speaker = Array.isArray(parsed.speaker) ? parsed.speaker : [parsed.speaker];
      }
      if (parsed.meeting) {
        result.meeting = Array.isArray(parsed.meeting) ? parsed.meeting : [parsed.meeting];
      }
      if (parsed.committee) {
        result.committee = Array.isArray(parsed.committee) ? parsed.committee : [parsed.committee];
      }

      // Extract excluded terms
      if (parsed.exclude) {
        if (parsed.exclude.text) {
          const excludedArray = Array.isArray(parsed.exclude.text) ? parsed.exclude.text : [parsed.exclude.text];
          excludedArray.forEach(term => {
            if (typeof term === 'string') {
              // Check if this excluded term was originally quoted in the input query
              if (originalQuotedPhrases.includes(term.trim())) {
                result.excludedPhrases.push(term.trim());
              } else {
                result.excludedTerms.push(term.trim());
              }
            }
          });
        }
        
        // Handle field-specific exclusions
        ['title', 'speaker', 'meeting', 'committee'].forEach(field => {
          if (parsed.exclude?.[field]) {
            const fieldExclusions = Array.isArray(parsed.exclude[field]) 
              ? parsed.exclude[field] 
              : [parsed.exclude[field]];
            
            if (!result.exclude) result.exclude = {};
            result.exclude[field] = fieldExclusions;
          }
        });
      }
    }

    logger.debug('Advanced search query parsed successfully', {
      metadata: {
        originalQuery: query,
        parsedResult: result,
        hasAdvancedSyntax: result.hasAdvancedSyntax
      }
    });

  } catch (error) {
    logger.warn('Failed to parse advanced search query, falling back to simple search', {
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        query
      }
    });

    // Fallback: treat entire query as general search terms
    result.generalTerms = [query];
    result.parseSuccess = false;
  }

  return result;
}

/**
 * Check if query contains explicit AND/OR operators
 */
function hasExplicitBooleans(query: string): boolean {
  return /\b(AND|OR)\b/i.test(query);
}

/**
 * Check if query contains advanced syntax
 */
function hasAdvancedSyntax(query: string): boolean {
  const advancedPatterns = [
    /"[^"]*"/, // Quoted phrases
    /\b(AND|OR)\b/i, // Boolean operators
    /[()]/, // Parentheses
    /(title|speaker|meeting|committee):/i, // Field searches
    /-\w/, // Exclusion
  ];

  return advancedPatterns.some(pattern => pattern.test(query));
}

/**
 * Check if a term is a quoted phrase
 */
function isQuotedPhrase(term: string): boolean {
  return (term.startsWith('"') && term.endsWith('"')) ||
         (term.startsWith("'") && term.endsWith("'"));
}

/**
 * Remove quotes from a phrase
 */
function removeQuotes(phrase: string): string {
  return phrase.replace(/^["']|["']$/g, '');
}

/**
 * Check if a term is a boolean operator
 */
function isBoolean(term: string): boolean {
  return /^(AND|OR)$/i.test(term.trim());
}

/**
 * Split text while preserving quoted phrases
 */
function splitPreservingQuotes(text: string): string[] {
  const terms: string[] = [];
  let current = '';
  let inQuotes = false;
  let quoteChar = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    
    if ((char === '"' || char === "'") && !inQuotes) {
      inQuotes = true;
      quoteChar = char;
      current += char;
    } else if (char === quoteChar && inQuotes) {
      inQuotes = false;
      current += char;
      quoteChar = '';
    } else if (char === ' ' && !inQuotes) {
      if (current.trim()) {
        terms.push(current.trim());
        current = '';
      }
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    terms.push(current.trim());
  }

  return terms;
}

/**
 * Extract quoted phrases from the original query string
 * This helps identify which terms should be treated as phrases even after parser processing
 */
function extractQuotedPhrasesFromOriginal(query: string): string[] {
  const phrases: string[] = [];
  const quotedRegex = /"([^"]+)"|'([^']+)'/g;
  let match;
  
  while ((match = quotedRegex.exec(query)) !== null) {
    const phrase = match[1] || match[2]; // Get content from either double or single quotes
    if (phrase && phrase.trim()) {
      phrases.push(phrase.trim());
    }
  }
  
  return phrases;
}

/**
 * Build Elasticsearch query from parsed search terms
 */
export function buildElasticsearchQuery(parsedQuery: AdvancedSearchQuery) {
  const mustClauses: any[] = [];
  const mustNotClauses: any[] = [];

  // Handle explicit boolean groups if present
  if (parsedQuery.hasExplicitBooleans && parsedQuery.booleanGroups) {
    return buildBooleanElasticsearchQuery(parsedQuery.booleanGroups);
  }

  // Add general terms with OR logic
  if (parsedQuery.generalTerms.length > 0) {
    mustClauses.push({
      multi_match: {
        query: parsedQuery.generalTerms.join(' '),
        fields: ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'],
        type: 'best_fields',
        operator: 'or'
      }
    });
  }

  // Add quoted phrases as exact matches
  parsedQuery.quotedPhrases.forEach(phrase => {
    mustClauses.push({
      multi_match: {
        query: phrase,
        fields: ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'],
        type: 'phrase'
      }
    });
  });

  // Add field-specific searches
  if (parsedQuery.title?.length) {
    mustClauses.push({
      multi_match: {
        query: parsedQuery.title.join(' '),
        fields: ['title'],
        type: 'best_fields'
      }
    });
  }

  if (parsedQuery.speaker?.length) {
    mustClauses.push({
      multi_match: {
        query: parsedQuery.speaker.join(' '),
        fields: ['speaker_name'],
        type: 'best_fields'
      }
    });
  }

  if (parsedQuery.meeting?.length) {
    mustClauses.push({
      multi_match: {
        query: parsedQuery.meeting.join(' '),
        fields: ['meeting_name'],
        type: 'best_fields'
      }
    });
  }

  if (parsedQuery.committee?.length) {
    mustClauses.push({
      multi_match: {
        query: parsedQuery.committee.join(' '),
        fields: ['committee_names'],
        type: 'best_fields'
      }
    });
  }

  // Add excluded terms
  parsedQuery.excludedTerms.forEach(term => {
    mustNotClauses.push({
      multi_match: {
        query: term,
        fields: ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'],
        type: 'best_fields'
      }
    });
  });

  // Add excluded phrases
  parsedQuery.excludedPhrases.forEach(phrase => {
    mustNotClauses.push({
      multi_match: {
        query: phrase,
        fields: ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'],
        type: 'phrase'
      }
    });
  });

  // Build the complete query
  const boolQuery: any = {};
  
  if (mustClauses.length > 0) {
    boolQuery.must = mustClauses;
  }
  
  if (mustNotClauses.length > 0) {
    boolQuery.must_not = mustNotClauses;
  }

  // If no clauses, return a match_all query
  if (mustClauses.length === 0 && mustNotClauses.length === 0) {
    return { match_all: {} };
  }

  return { bool: boolQuery };
}

/**
 * Build database WHERE conditions from parsed search terms
 */
export function buildDatabaseQuery(parsedQuery: AdvancedSearchQuery, dbBackend: string) {
  // Handle explicit boolean groups if present
  if (parsedQuery.hasExplicitBooleans && parsedQuery.booleanGroups) {
    return buildBooleanDatabaseQuery(parsedQuery.booleanGroups, dbBackend);
  }

  const conditions: any[] = [];
  const isInsensitiveSupported = dbBackend !== 'sqlite';

  // Helper function to create contains condition
  const createContainsCondition = (field: string, value: string) => {
    // Special handling for committee_names field based on database backend
    if (field === 'committee_names') {
      if (dbBackend === 'postgresql') {
        // PostgreSQL array field - use 'has' for array contains operation
        return { [field]: { has: value } };
      } else if (dbBackend === 'mysql') {
        // MySQL JSON field - use string_contains for JSON search
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
    
    return isInsensitiveSupported
      ? { [field]: { contains: value, mode: 'insensitive' as const } }
      : { [field]: { contains: value } };
  };

  // Add general terms (each term creates its own OR condition across fields)
  parsedQuery.generalTerms.forEach(term => {
    const termConditions: any[] = [];
    ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'].forEach(field => {
      termConditions.push(createContainsCondition(field, term));
    });
    
    if (termConditions.length > 0) {
      conditions.push({ OR: termConditions });
    }
  });

  // Add quoted phrases
  parsedQuery.quotedPhrases.forEach(phrase => {
    const phraseConditions: any[] = [];
    
    ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'].forEach(field => {
      phraseConditions.push(createContainsCondition(field, phrase));
    });

    if (phraseConditions.length > 0) {
      conditions.push({ OR: phraseConditions });
    }
  });

  // Add field-specific searches
  if (parsedQuery.title?.length) {
    conditions.push({ OR: parsedQuery.title.map(term => createContainsCondition('title', term)) });
  }

  if (parsedQuery.speaker?.length) {
    conditions.push({ OR: parsedQuery.speaker.map(term => createContainsCondition('speaker_name', term)) });
  }

  if (parsedQuery.meeting?.length) {
    conditions.push({ OR: parsedQuery.meeting.map(term => createContainsCondition('meeting_name', term)) });
  }

  if (parsedQuery.committee?.length) {
    conditions.push({ OR: parsedQuery.committee.map(term => createContainsCondition('committee_names', term)) });
  }

  // For excluded terms, we need to use NOT conditions
  const excludeConditions: any[] = [];

  parsedQuery.excludedTerms.forEach(term => {
    ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'].forEach(field => {
      excludeConditions.push({
        NOT: createContainsCondition(field, term)
      });
    });
  });

  parsedQuery.excludedPhrases.forEach(phrase => {
    ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'].forEach(field => {
      excludeConditions.push({
        NOT: createContainsCondition(field, phrase)
      });
    });
  });

  // Combine all conditions
  const allConditions = [...conditions, ...excludeConditions];

  if (allConditions.length === 0) {
    return {};
  }

  if (allConditions.length === 1) {
    return allConditions[0];
  }

  return { AND: allConditions };
}

/**
 * Parse query with explicit AND/OR boolean operators and parentheses
 */
function parseBooleanQuery(query: string): Partial<AdvancedSearchQuery> {
  const result: Partial<AdvancedSearchQuery> = {
    generalTerms: [],
    quotedPhrases: [],
    excludedTerms: [],
    excludedPhrases: [],
    booleanGroups: [],
    hasExplicitBooleans: true
  };

  // First, extract quoted phrases and preserve their positions
  const quotedPhrases = extractQuotedPhrasesFromOriginal(query);
  const quotePlaceholders: string[] = [];
  let processedQuery = query;
  
  // Replace quoted phrases with placeholders to avoid splitting them
  quotedPhrases.forEach((phrase, index) => {
    const placeholder = `__QUOTE_${index}__`;
    quotePlaceholders.push(phrase);
    processedQuery = processedQuery.replace(`"${phrase}"`, placeholder);
    processedQuery = processedQuery.replace(`-"${phrase}"`, `-${placeholder}`);
  });

  // Handle parentheses by recursive parsing
  const booleanGroups = parseExpressionWithParentheses(processedQuery, quotePlaceholders);
  result.booleanGroups = booleanGroups;
  
  // Also populate legacy fields for backward compatibility
  result.booleanGroups?.forEach(group => {
    group.terms.forEach(term => {
      if (term.isExcluded) {
        if (term.type === 'phrase') {
          result.excludedPhrases!.push(term.value);
        } else {
          result.excludedTerms!.push(term.value);
        }
      } else {
        if (term.type === 'phrase') {
          result.quotedPhrases!.push(term.value);
        } else if (term.type === 'field') {
          // Handle field-specific terms
          const fieldKey = term.field as keyof AdvancedSearchQuery;
          if (!result[fieldKey]) {
            (result as any)[fieldKey] = [];
          }
          (result as any)[fieldKey].push(term.value);
        } else {
          result.generalTerms!.push(term.value);
        }
      }
    });
  });

  return result;
}

/**
 * Parse an individual term, handling field syntax, exclusions, and quotes
 */
function parseIndividualTerm(term: string, quotePlaceholders: string[]): BooleanTerm {
  let processedTerm = term.trim();
  let isExcluded = false;
  let field: string | undefined;
  
  // Handle exclusion
  if (processedTerm.startsWith('-')) {
    isExcluded = true;
    processedTerm = processedTerm.substring(1);
  }
  
  // Handle field syntax
  const fieldMatch = processedTerm.match(/^(title|speaker|meeting|committee):(.+)$/i);
  if (fieldMatch) {
    field = fieldMatch[1].toLowerCase();
    processedTerm = fieldMatch[2];
  }
  
  // Restore quoted phrases
  if (processedTerm.startsWith('__QUOTE_')) {
    const index = parseInt(processedTerm.replace('__QUOTE_', '').replace('__', ''));
    if (!isNaN(index) && quotePlaceholders[index]) {
      return {
        type: field ? 'field' : 'phrase',
        value: quotePlaceholders[index],
        field,
        isExcluded
      };
    }
  }
  
  // Handle quoted phrases that weren't replaced
  if (isQuotedPhrase(processedTerm)) {
    return {
      type: field ? 'field' : 'phrase',
      value: removeQuotes(processedTerm),
      field,
      isExcluded
    };
  }
  
  // Regular term
  return {
    type: field ? 'field' : 'term',
    value: processedTerm,
    field,
    isExcluded
  };
}

/**
 * Build Elasticsearch query for boolean groups (AND/OR logic)
 */
function buildBooleanElasticsearchQuery(booleanGroups: BooleanGroup[]) {
  if (booleanGroups.length === 0) {
    return { match_all: {} };
  }

  if (booleanGroups.length === 1) {
    return buildGroupQuery(booleanGroups[0]);
  }

  // Multiple groups - combine with AND logic
  const mustClauses = booleanGroups.map(group => buildGroupQuery(group));
  return {
    bool: {
      must: mustClauses
    }
  };
}

/**
 * Build query for a single boolean group
 */
function buildGroupQuery(group: BooleanGroup) {
  const includedTerms: any[] = [];
  const excludedTerms: any[] = [];

  group.terms.forEach(term => {
    const query = buildTermQuery(term);
    
    if (term.isExcluded) {
      excludedTerms.push(query);
    } else {
      includedTerms.push(query);
    }
  });

  const boolQuery: any = {};

  if (includedTerms.length > 0) {
    if (group.operator === 'OR') {
      boolQuery.should = includedTerms;
      boolQuery.minimum_should_match = 1;
    } else {
      boolQuery.must = includedTerms;
    }
  }

  if (excludedTerms.length > 0) {
    boolQuery.must_not = excludedTerms;
  }

  return includedTerms.length > 0 || excludedTerms.length > 0 
    ? { bool: boolQuery }
    : { match_all: {} };
}

/**
 * Build query for a single term
 */
function buildTermQuery(term: BooleanTerm) {
  const fields = ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'];
  
  if (term.field) {
    // Field-specific search
    const fieldMapping: Record<string, string> = {
      title: 'title',
      speaker: 'speaker_name',
      meeting: 'meeting_name',
      committee: 'committee_names'
    };
    
    const targetField = fieldMapping[term.field];
    if (targetField) {
      return {
        multi_match: {
          query: term.value,
          fields: [targetField],
          type: term.type === 'phrase' ? 'phrase' : 'best_fields'
        }
      };
    }
  }

  // General search across all fields
  return {
    multi_match: {
      query: term.value,
      fields,
      type: term.type === 'phrase' ? 'phrase' : 'best_fields'
    }
  };
}

/**
 * Parse expression with parentheses support
 */
function parseExpressionWithParentheses(expression: string, quotePlaceholders: string[]): BooleanGroup[] {
  // Handle parentheses by finding balanced pairs and parsing recursively
  const tokens = tokenizeExpression(expression);
  return parseTokenSequence(tokens, quotePlaceholders);
}

/**
 * Tokenize expression into terms, operators, and parentheses
 */
function tokenizeExpression(expression: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let i = 0;
  
  while (i < expression.length) {
    const char = expression[i];
    
    if (char === '(' || char === ')') {
      // Push current token if any
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      // Push parenthesis
      tokens.push(char);
      i++;
    } else if (char === ' ') {
      // Check for AND/OR operators
      if (current.trim()) {
        tokens.push(current.trim());
        current = '';
      }
      
      // Skip whitespace
      while (i < expression.length && expression[i] === ' ') {
        i++;
      }
      
      // Check if next word is AND or OR
      if (i < expression.length) {
        const remaining = expression.slice(i);
        const andMatch = remaining.match(/^AND\b/i);
        const orMatch = remaining.match(/^OR\b/i);
        
        if (andMatch) {
          tokens.push('AND');
          i += 3;
        } else if (orMatch) {
          tokens.push('OR');
          i += 2;
        }
        // Continue with the loop for other characters
      }
    } else {
      current += char;
      i++;
    }
  }
  
  // Push final token
  if (current.trim()) {
    tokens.push(current.trim());
  }
  
  return tokens.filter(token => token.length > 0);
}

/**
 * Parse a sequence of tokens into boolean groups
 */
function parseTokenSequence(tokens: string[], quotePlaceholders: string[]): BooleanGroup[] {
  const groups: BooleanGroup[] = [];
  let i = 0;
  
  while (i < tokens.length) {
    const result = parseGroup(tokens, i, quotePlaceholders);
    if (result.group) {
      groups.push(result.group);
    }
    i = result.nextIndex;
  }
  
  return groups;
}

/**
 * Parse a group starting from the given index
 */
function parseGroup(tokens: string[], startIndex: number, quotePlaceholders: string[]): { group: BooleanGroup | null, nextIndex: number } {
  let i = startIndex;
  let currentOperator: 'AND' | 'OR' = 'AND';
  const terms: BooleanTerm[] = [];
  
  while (i < tokens.length) {
    const token = tokens[i];
    
    if (token === '(') {
      // Handle parentheses group
      const { group: subGroup, nextIndex } = parseParenthesesGroup(tokens, i + 1, quotePlaceholders);
      if (subGroup) {
        // Convert subgroup to terms
        subGroup.terms.forEach(term => terms.push(term));
      }
      i = nextIndex;
    } else if (token === ')') {
      // End of current group
      break;
    } else if (/^(AND|OR)$/i.test(token)) {
      currentOperator = token.toUpperCase() as 'AND' | 'OR';
      i++;
    } else {
      // Regular term
      const term = parseIndividualTerm(token, quotePlaceholders);
      terms.push(term);
      i++;
    }
  }
  
  const group = terms.length > 0 ? { operator: currentOperator, terms } : null;
  return { group, nextIndex: i };
}

/**
 * Parse content within parentheses
 */
function parseParenthesesGroup(tokens: string[], startIndex: number, quotePlaceholders: string[]): { group: BooleanGroup | null, nextIndex: number } {
  let depth = 1;
  let i = startIndex;
  const groupTokens: string[] = [];
  
  while (i < tokens.length && depth > 0) {
    const token = tokens[i];
    
    if (token === '(') {
      depth++;
      groupTokens.push(token);
    } else if (token === ')') {
      depth--;
      if (depth > 0) {
        groupTokens.push(token);
      }
    } else {
      groupTokens.push(token);
    }
    
    i++;
  }
  
  // Parse the group tokens
  const subGroups = parseTokenSequence(groupTokens, quotePlaceholders);
  
  // Flatten multiple groups into one if they share the same operator
  if (subGroups.length === 1) {
    return { group: subGroups[0], nextIndex: i };
  } else if (subGroups.length > 1) {
    // Combine multiple groups
    const allTerms: BooleanTerm[] = [];
    let commonOperator: 'AND' | 'OR' = 'AND';
    
    subGroups.forEach((group, index) => {
      if (index === 0) {
        commonOperator = group.operator;
      }
      allTerms.push(...group.terms);
    });
    
    return { 
      group: { operator: commonOperator, terms: allTerms }, 
      nextIndex: i 
    };
  }
  
  return { group: null, nextIndex: i };
}

/**
 * Build database query for boolean groups
 */
function buildBooleanDatabaseQuery(booleanGroups: BooleanGroup[], dbBackend: string) {
  const isInsensitiveSupported = dbBackend !== 'sqlite';
  
  const createContainsCondition = (field: string, value: string) => {
    // Special handling for committee_names field based on database backend
    if (field === 'committee_names') {
      if (dbBackend === 'postgresql') {
        // PostgreSQL array field - use 'has' for array contains operation
        return { [field]: { has: value } };
      } else if (dbBackend === 'mysql') {
        // MySQL JSON field - use string_contains for JSON search
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
    
    return isInsensitiveSupported
      ? { [field]: { contains: value, mode: 'insensitive' as const } }
      : { [field]: { contains: value } };
  };
  
  if (booleanGroups.length === 0) {
    return {};
  }
  
  if (booleanGroups.length === 1) {
    return buildDatabaseGroupQuery(booleanGroups[0], createContainsCondition);
  }
  
  // Multiple groups - combine with AND logic
  const conditions = booleanGroups.map(group => 
    buildDatabaseGroupQuery(group, createContainsCondition)
  );
  
  return { AND: conditions };
}

/**
 * Build database query for a single boolean group
 */
function buildDatabaseGroupQuery(group: BooleanGroup, createContainsCondition: (field: string, value: string) => any) {
  const includedConditions: any[] = [];
  const excludedConditions: any[] = [];
  
  group.terms.forEach(term => {
    const conditions = buildDatabaseTermConditions(term, createContainsCondition);
    
    if (term.isExcluded) {
      excludedConditions.push(...conditions.map(cond => ({ NOT: cond })));
    } else {
      includedConditions.push(conditions.length === 1 ? conditions[0] : { OR: conditions });
    }
  });
  
  const allConditions = [...includedConditions, ...excludedConditions];
  
  if (allConditions.length === 0) {
    return {};
  }
  
  if (allConditions.length === 1) {
    return allConditions[0];
  }
  
  if (group.operator === 'OR') {
    return { OR: includedConditions };
  } else {
    return { AND: allConditions };
  }
}

/**
 * Build database conditions for a single term
 */
function buildDatabaseTermConditions(term: BooleanTerm, createContainsCondition: (field: string, value: string) => any) {
  const fields = ['ai_transcript', 'ly_transcript', 'title', 'meeting_name', 'speaker_name'];
  
  if (term.field) {
    // Field-specific search
    const fieldMapping: Record<string, string> = {
      title: 'title',
      speaker: 'speaker_name',
      meeting: 'meeting_name',
      committee: 'committee_names'
    };
    
    const targetField = fieldMapping[term.field];
    if (targetField) {
      return [createContainsCondition(targetField, term.value)];
    }
  }
  
  // Search across all fields
  return fields.map(field => createContainsCondition(field, term.value));
}