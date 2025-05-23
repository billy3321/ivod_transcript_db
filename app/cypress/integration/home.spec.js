describe('Home Page', () => {
  beforeEach(() => {
    cy.visit('/');
  });

  it('renders the search form and list container', () => {
    cy.get('form').should('exist');
    cy.get('input#meetingName').should('exist');
    cy.get('table').should('exist');
  });
});