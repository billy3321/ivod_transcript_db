import { 
  listResourceTemplates, 
  parseTemplateUri, 
  generateTemplateContent,
  getResourceTemplate
} from '@/lib/mcp/resources';

jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('MCP Resource Templates', () => {
  describe('listResourceTemplates', () => {
    it('should return all available resource templates', async () => {
      const templates = await listResourceTemplates();
      
      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);
      
      // 檢查模板結構
      templates.forEach(template => {
        expect(template).toHaveProperty('uriTemplate');
        expect(template).toHaveProperty('name');
        expect(template).toHaveProperty('description');
        expect(template).toHaveProperty('mimeType');
        expect(template.mimeType).toBe('text/markdown');
      });
    });

    it('should include key template types', async () => {
      const templates = await listResourceTemplates();
      const templateNames = templates.map(t => t.name);
      
      expect(templateNames).toContain('議題逐字稿查詢');
      expect(templateNames).toContain('立委發言查詢');
      expect(templateNames).toContain('會議逐字稿查詢');
      expect(templateNames).toContain('委員會逐字稿查詢');
      expect(templateNames).toContain('完整會議逐字稿');
    });
  });

  describe('getResourceTemplate', () => {
    it('should return specific template by URI', async () => {
      const uriTemplate = "ivod://search/topic/{query}";
      const template = await getResourceTemplate(uriTemplate);
      
      expect(template).not.toBeNull();
      expect(template?.uriTemplate).toBe(uriTemplate);
      expect(template?.name).toBe('議題逐字稿查詢');
    });

    it('should return null for non-existent template', async () => {
      const template = await getResourceTemplate("ivod://non-existent/{param}");
      expect(template).toBeNull();
    });
  });

  describe('parseTemplateUri', () => {
    it('should parse single parameter correctly', () => {
      const uriTemplate = "ivod://search/topic/{query}";
      const uri = "ivod://search/topic/交通安全";
      
      const params = parseTemplateUri(uri, uriTemplate);
      
      expect(params).not.toBeNull();
      expect(params?.query).toBe('交通安全');
    });

    it('should parse transcript ID parameter', () => {
      const uriTemplate = "ivod://transcript/full/{ivod_id}";
      const uri = "ivod://transcript/full/123456";
      
      const params = parseTemplateUri(uri, uriTemplate);
      
      expect(params).not.toBeNull();
      expect(params?.ivod_id).toBe('123456');
    });

    it('should handle URL encoded parameters', () => {
      const uriTemplate = "ivod://search/topic/{query}";
      const uri = "ivod://search/topic/%E4%BA%A4%E9%80%9A%E5%AE%89%E5%85%A8";
      
      const params = parseTemplateUri(uri, uriTemplate);
      
      expect(params).not.toBeNull();
      expect(params?.query).toBe('交通安全');
    });

    it('should return null for non-matching URI', () => {
      const uriTemplate = "ivod://search/topic/{query}";
      const uri = "ivod://different/path/value";
      
      const params = parseTemplateUri(uri, uriTemplate);
      expect(params).toBeNull();
    });
  });

  describe('generateTemplateContent', () => {
    it('should generate topic search content', async () => {
      const uriTemplate = "ivod://search/topic/{query}";
      const params = { query: '交通安全' };
      
      const content = await generateTemplateContent(uriTemplate, params);
      
      expect(content).toContain('"交通安全" 相關立法院討論查詢');
      expect(content).toContain('search_transcripts');
      expect(content).toContain('"query": "交通安全"');
      expect(content).toContain('transcription_source": "ly_only"');
    });

    it('should generate full transcript content', async () => {
      const uriTemplate = "ivod://transcript/full/{ivod_id}";
      const params = { ivod_id: '123456' };
      
      const content = await generateTemplateContent(uriTemplate, params);
      
      expect(content).toContain('完整會議逐字稿 (IVOD ID: 123456)');
      expect(content).toContain('get_meeting_transcript');
      expect(content).toContain('"ivod_id": 123456');
    });

    it('should generate legislator search content', async () => {
      const uriTemplate = "ivod://search/legislator/{name}";
      const params = { name: '沈伯洋' };
      
      const content = await generateTemplateContent(uriTemplate, params);
      
      expect(content).toContain('沈伯洋 立委發言紀錄查詢');
      expect(content).toContain('search_transcripts');
      expect(content).toContain('"speakers": ["沈伯洋"]');
    });

    it('should throw error for non-existent template', async () => {
      const uriTemplate = "ivod://non-existent/{param}";
      const params = { param: 'value' };
      
      await expect(generateTemplateContent(uriTemplate, params))
        .rejects.toThrow('Resource template not found');
    });

    it('should throw error for unimplemented template', async () => {
      // This would happen if we add a template to the list but don't implement content generation
      const uriTemplate = "ivod://unimplemented/{param}";
      const params = { param: 'value' };
      
      await expect(generateTemplateContent(uriTemplate, params))
        .rejects.toThrow('Resource template not found');
    });
  });
});