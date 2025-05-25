describe('About Page', () => {
  it('should navigate to about page and display content correctly', () => {
    // Visit home page
    cy.visit('/')
    
    // Click on About link in sidebar
    cy.get('[data-cy="sidebar"]').within(() => {
      cy.contains('About').click()
    })
    
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

  it('should highlight About nav item when active', () => {
    cy.visit('/about')
    
    // Check if About nav item has active styling
    cy.get('[data-cy="sidebar"]').within(() => {
      cy.contains('About').parent().should('have.class', 'bg-gray-600')
    })
  })
})