describe('About Page', () => {
  it('should navigate to about page from home page', () => {
    // Visit home page
    cy.visit('/')
    
    // Click on About link in header
    cy.contains('關於本站').click()
    
    // Check URL
    cy.url().should('include', '/about')
    
    // Check page content
    cy.contains('關於本站').should('be.visible')
    cy.contains('本站為IVOD搜尋網站').should('be.visible')
    cy.contains('關於我們').should('be.visible')
    cy.contains('billy3321、Yutin').should('be.visible')
    cy.contains('ronny wang').should('be.visible')
    
    // Check GitHub link
    cy.get('a[href="https://github.com/billy3321/ivod_transcript_db"]')
      .should('be.visible')
      .should('have.attr', 'target', '_blank')
      .should('have.attr', 'rel', 'noopener noreferrer')
  })

  it('should be accessible via direct URL', () => {
    // Visit about page directly
    cy.visit('/about')
    
    // Check page loads correctly
    cy.contains('關於本站').should('be.visible')
    cy.contains('關於我們').should('be.visible')
  })

  it('should navigate back to home page', () => {
    // Visit about page
    cy.visit('/about')
    
    // Click return to home link
    cy.contains('返回首頁').click()
    
    // Check URL
    cy.url().should('eq', Cypress.config().baseUrl + '/')
    
    // Check we're back on home page
    cy.contains('IVOD 逐字稿檢索系統').should('be.visible')
  })

  it('should display all content sections correctly', () => {
    cy.visit('/about')
    
    // Check main sections
    cy.contains('h1', '關於本站').should('be.visible')
    cy.contains('h2', '關於我們').should('be.visible')
    cy.contains('h3', '開發者').should('be.visible')
    cy.contains('h3', '授權條款').should('be.visible')
    cy.contains('h3', '特別感謝').should('be.visible')
    
    // Check specific content
    cy.contains('本站為IVOD搜尋網站').should('be.visible')
    cy.contains('本網站為g0v專案，以MIT License釋出').should('be.visible')
  })
})