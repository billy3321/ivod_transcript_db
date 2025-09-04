describe('MCP Guide Page', () => {
  beforeEach(() => {
    cy.visit('/mcp-guide');
  });

  describe('Page Structure', () => {
    it('should display the main title and description', () => {
      cy.get('h1').should('contain', 'IVOD MCP 服務設定指南');
      cy.contains('在 AI 助理中使用台灣立法院逐字稿搜尋服務').should('be.visible');
    });

    it('should show the service overview section', () => {
      cy.contains('服務概述').should('be.visible');
      cy.contains('MCP 服務端點').should('be.visible');
      cy.contains('支援的功能').should('be.visible');
    });

    it('should display all client setup sections', () => {
      cy.contains('Claude Desktop').should('be.visible');
      cy.contains('ChatGPT (GPTs)').should('be.visible');
      cy.contains('Google Gemini').should('be.visible');
    });

    it('should show testing and documentation sections', () => {
      cy.contains('測試 MCP 連接').should('be.visible');
      cy.contains('MCP 函數說明').should('be.visible');
      cy.contains('注意事項與最佳實務').should('be.visible');
    });
  });

  describe('Navigation', () => {
    it('should have working navigation links in header', () => {
      cy.get('header').within(() => {
        cy.contains('首頁').should('have.attr', 'href', '/');
        cy.contains('MCP 設定指南').should('have.attr', 'href', '/mcp-guide');
        cy.contains('關於我們').should('have.attr', 'href', '/about');
      });
    });

    it('should navigate to home page when clicking home link', () => {
      cy.contains('首頁').click();
      cy.url().should('eq', Cypress.config().baseUrl + '/');
    });
  });

  describe('Configuration Display', () => {
    it('should display server URL in service overview', () => {
      cy.contains('/api/mcp').should('be.visible');
    });

    it('should show configuration examples for each client', () => {
      // Claude Desktop config
      cy.contains('mcpServers').should('be.visible');
      cy.contains('@modelcontextprotocol/server-fetch').should('be.visible');

      // ChatGPT config
      cy.contains('schema_version').should('be.visible');
      cy.contains('台灣立法院逐字稿搜尋').should('be.visible');

      // Gemini config
      cy.contains('MCPClient').should('be.visible');
      cy.contains('import').should('be.visible');
    });

    it('should display correct file paths for different OS', () => {
      cy.contains('~/Library/Application Support/Claude').should('be.visible');
      cy.contains('%APPDATA%\\Claude').should('be.visible');
    });
  });

  describe('Copy Functionality', () => {
    it('should show copy buttons for configuration sections', () => {
      cy.contains('複製').should('be.visible');
      cy.get('button').contains('複製').should('have.length.at.least', 3);
    });

    it('should change button text when clicked', () => {
      cy.get('button').contains('複製').first().click();
      cy.contains('已複製!').should('be.visible');
    });

    it('should reset button text after delay', () => {
      cy.get('button').contains('複製').first().click();
      cy.contains('已複製!').should('be.visible');
      
      // Wait for reset (2 seconds)
      cy.wait(2100);
      cy.get('button').contains('複製').should('be.visible');
    });

    it('should copy different content for different sections', () => {
      // Mock clipboard API for testing
      cy.window().then((win) => {
        cy.stub(win.navigator.clipboard, 'writeText').as('writeText');
      });

      // Click Claude config copy button
      cy.contains('Claude Desktop').parent().within(() => {
        cy.get('button').contains('複製').click();
      });
      
      cy.get('@writeText').should('have.been.calledOnce');
      cy.get('@writeText').should('have.been.calledWithMatch', /mcpServers/);
    });
  });

  describe('Testing Section', () => {
    it('should display cURL testing example', () => {
      cy.contains('使用 cURL 測試').should('be.visible');
      cy.contains('curl -X POST').should('be.visible');
      cy.contains('tools/list').should('be.visible');
    });

    it('should show MCP Inspector testing option', () => {
      cy.contains('MCP Inspector 測試').should('be.visible');
      cy.contains('npx @modelcontextprotocol/inspector').should('be.visible');
    });

    it('should include copy button for cURL command', () => {
      cy.contains('使用 cURL 測試').parent().within(() => {
        cy.get('button').contains('複製').should('exist');
      });
    });
  });

  describe('Documentation Sections', () => {
    it('should display function documentation', () => {
      cy.contains('search_transcripts').should('be.visible');
      cy.contains('get_meeting_transcript').should('be.visible');
    });

    it('should show parameter descriptions', () => {
      cy.contains('query:').should('be.visible');
      cy.contains('speakers:').should('be.visible');
      cy.contains('ivod_id:').should('be.visible');
    });

    it('should display usage examples', () => {
      cy.contains('使用範例').should('be.visible');
      cy.contains('搜尋立委發言:').should('be.visible');
      cy.contains('委員會會議:').should('be.visible');
    });

    it('should show best practices section', () => {
      cy.contains('效能建議').should('be.visible');
      cy.contains('資料特性').should('be.visible');
      cy.contains('限制說明').should('be.visible');
    });
  });

  describe('Responsive Design', () => {
    it('should be responsive on mobile', () => {
      cy.viewport(375, 667); // iPhone SE size
      
      cy.get('h1').should('be.visible');
      cy.contains('服務概述').should('be.visible');
      
      // Check that content is still readable
      cy.get('body').should('have.css', 'font-size');
    });

    it('should work on tablet', () => {
      cy.viewport(768, 1024); // iPad size
      
      cy.get('h1').should('be.visible');
      cy.contains('Claude Desktop').should('be.visible');
      
      // Grid layout should adjust
      cy.get('.grid').should('exist');
    });

    it('should display properly on desktop', () => {
      cy.viewport(1200, 800);
      
      cy.get('h1').should('be.visible');
      cy.get('.max-w-4xl').should('exist');
      
      // Should show side-by-side layout in documentation sections
      cy.get('.md\\:grid-cols-2').should('exist');
    });
  });

  describe('Accessibility', () => {
    it('should have proper heading hierarchy', () => {
      cy.get('h1').should('have.length', 1);
      cy.get('h2').should('have.length.at.least', 3);
      cy.get('h3').should('have.length.at.least', 5);
    });

    it('should have accessible buttons', () => {
      cy.get('button').each(($button) => {
        cy.wrap($button).should('have.attr', 'class');
        cy.wrap($button).should('contain.text', '複製').or('contain.text', '已複製!');
      });
    });

    it('should have proper color contrast', () => {
      // Check that text has sufficient contrast
      cy.get('h1').should('have.css', 'color').and('not.equal', 'rgba(0, 0, 0, 0)');
      cy.get('p').should('have.css', 'color').and('not.equal', 'rgba(0, 0, 0, 0)');
    });

    it('should be keyboard navigable', () => {
      cy.get('body').tab();
      cy.focused().should('be.visible');
      
      // Tab through copy buttons
      cy.get('button').first().focus();
      cy.focused().should('contain', '複製');
    });
  });

  describe('Performance', () => {
    it('should load within reasonable time', () => {
      const startTime = Date.now();
      
      cy.visit('/mcp-guide');
      cy.get('h1').should('be.visible').then(() => {
        const loadTime = Date.now() - startTime;
        expect(loadTime).to.be.lessThan(5000); // Should load within 5 seconds
      });
    });

    it('should not have javascript errors', () => {
      cy.window().then((win) => {
        cy.stub(win.console, 'error').as('consoleError');
      });
      
      cy.visit('/mcp-guide');
      cy.get('h1').should('be.visible');
      
      cy.get('@consoleError').should('not.have.been.called');
    });
  });

  describe('Content Validation', () => {
    it('should contain all required sections', () => {
      const requiredSections = [
        '服務概述',
        'Claude Desktop',
        'ChatGPT (GPTs)',
        'Google Gemini', 
        '測試 MCP 連接',
        'MCP 函數說明',
        '注意事項與最佳實務'
      ];

      requiredSections.forEach(section => {
        cy.contains(section).should('be.visible');
      });
    });

    it('should have valid configuration examples', () => {
      // Check that JSON configurations are properly formatted
      cy.contains('"mcpServers"').should('be.visible');
      cy.contains('"schema_version": "v1"').should('be.visible');
      
      // Check that code examples use proper syntax
      cy.contains('import { MCPClient }').should('be.visible');
    });

    it('should display current server URL in all relevant places', () => {
      cy.get('[data-testid="server-url"], .bg-gray-100, code').should('contain', '/api/mcp');
    });
  });
});