describe('Family Diagram Application', () => {
  it('should load the canvas', () => {
    cy.visit('/');
    cy.get('canvas').should('be.visible');
  });
});