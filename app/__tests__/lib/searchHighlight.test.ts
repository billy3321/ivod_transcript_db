import { extractSearchExcerpt, isTranscriptSearch } from '@/lib/searchHighlight';

describe('searchHighlight', () => {
  describe('extractSearchExcerpt', () => {
    const sampleText = '這是一個測試逐字稿的內容。立法院在討論預算案的時候，委員們對於社會福利政策有不同的看法。王委員表示支持增加預算，李委員則認為需要更謹慎的評估。這個會議持續了三個小時，最後達成了重要的共識。';

    it('should find complete keyword matches', () => {
      const result = extractSearchExcerpt(sampleText, '預算案');
      
      expect(result.hasMatch).toBe(true);
      expect(result.plainText).toContain('預算案');
      expect(result.text).toContain('<mark class="bg-red-200 text-red-800 px-1 rounded">預算案</mark>');
      expect(result.matchPosition).toBeGreaterThan(-1);
    });

    it('should find partial keyword matches', () => {
      const result = extractSearchExcerpt(sampleText, '預算');
      
      expect(result.hasMatch).toBe(true);
      expect(result.plainText).toContain('預算');
      expect(result.text).toContain('<mark class="bg-red-200 text-red-800 px-1 rounded">預算</mark>');
    });

    it('should handle quoted searches', () => {
      const result = extractSearchExcerpt(sampleText, '"社會福利政策"');
      
      expect(result.hasMatch).toBe(true);
      expect(result.text).toContain('<mark class="bg-red-200 text-red-800 px-1 rounded">社會福利政策</mark>');
    });

    it('should return empty result when no match found', () => {
      const result = extractSearchExcerpt(sampleText, '不存在的關鍵字');
      
      expect(result.hasMatch).toBe(false);
      expect(result.text).toBe('');
      expect(result.plainText).toBe('');
      expect(result.matchPosition).toBe(-1);
    });

    it('should handle empty inputs', () => {
      expect(extractSearchExcerpt('', '測試')).toEqual({
        text: '',
        plainText: '',
        hasMatch: false,
        matchPosition: -1
      });
      
      expect(extractSearchExcerpt(sampleText, '')).toEqual({
        text: '',
        plainText: '',
        hasMatch: false,
        matchPosition: -1
      });
      
      expect(extractSearchExcerpt(null, '測試')).toEqual({
        text: '',
        plainText: '',
        hasMatch: false,
        matchPosition: -1
      });
    });

    it('should properly escape HTML special characters', () => {
      const textWithHtml = '這裡有<script>alert("test")</script>標籤和&符號';
      const result = extractSearchExcerpt(textWithHtml, 'script');
      
      expect(result.hasMatch).toBe(true);
      expect(result.text).toContain('&lt;');
      expect(result.text).toContain('&gt;');
      expect(result.text).toContain('&quot;');
      expect(result.text).not.toContain('<script>');
    });
  });

  describe('isTranscriptSearch', () => {
    it('should identify general searches as transcript searches', () => {
      expect(isTranscriptSearch('預算')).toBe(true);
      expect(isTranscriptSearch('立法院 討論')).toBe(true);
      expect(isTranscriptSearch('"完整詞組"')).toBe(true);
    });

    it('should identify field-specific searches as non-transcript searches', () => {
      expect(isTranscriptSearch('title:會議名稱')).toBe(false);
      expect(isTranscriptSearch('speaker:王委員')).toBe(false);
      expect(isTranscriptSearch('meeting:預算委員會')).toBe(false);
      expect(isTranscriptSearch('committee:社會福利')).toBe(false);
    });

    it('should handle empty searches', () => {
      expect(isTranscriptSearch('')).toBe(false);
      expect(isTranscriptSearch('   ')).toBe(false);
    });

    it('should not generate excerpts for empty queries', () => {
      const sampleText = '這是測試內容，包含關鍵字';
      
      expect(extractSearchExcerpt(sampleText, '')).toEqual({
        text: '',
        plainText: '',
        hasMatch: false,
        matchPosition: -1
      });
      
      expect(extractSearchExcerpt(sampleText, '   ')).toEqual({
        text: '',
        plainText: '',
        hasMatch: false,
        matchPosition: -1
      });
    });
  });
});