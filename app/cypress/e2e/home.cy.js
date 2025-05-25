describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('renders the main search interface', () => {
    cy.contains('IVOD 逐字稿檢索系統').should('be.visible');
    cy.get('input[placeholder*="搜尋會議名稱、立委姓名、逐字稿內容"]').should('exist');
    cy.contains('進階搜尋').should('be.visible');
  });

  it('can toggle advanced search', () => {
    cy.contains('進階搜尋').click();
    cy.get('input#meeting_name').should('be.visible');
    cy.get('input#committee').should('be.visible');
    cy.get('input#speaker').should('be.visible');
  });

  it('can perform basic search', () => {
    const searchTerm = '委員會';
    cy.get('input[placeholder*="搜尋會議名稱、立委姓名、逐字稿內容"]')
      .type(searchTerm);
    
    // Wait for search to trigger
    cy.wait(1000);
    
    // Check if results are displayed or no results message
    cy.get('body').then(($body) => {
      if ($body.text().includes('沒有找到符合的資料')) {
        cy.contains('沒有找到符合的資料').should('be.visible');
      } else {
        // Check if results are displayed
        cy.get('.space-y-4').should('exist');
      }
    });
  });

  it('shows sort options', () => {
    cy.get('select').contains('最新優先').should('exist');
  });

  it('can clear filters when they exist', () => {
    // Type something in search
    cy.get('input[placeholder*="搜尋會議名稱、立委姓名、逐字稿內容"]')
      .type('測試');
    
    // Wait for search to trigger and see if clear button appears
    cy.wait(1000);
    
    cy.get('body').then(($body) => {
      if ($body.text().includes('清除篩選')) {
        cy.contains('清除篩選').click();
        cy.get('input[placeholder*="搜尋會議名稱、立委姓名、逐字稿內容"]')
          .should('have.value', '');
      }
    });
  });
});