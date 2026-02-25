describe('Universal Interaction', () => {
  beforeEach(() => {
    cy.visit('/', {
      onBeforeLoad: (win) => {
        win.localStorage.clear();
      },
    });
  });

  it('opens the canvas context menu on right click', () => {
    cy.get('canvas').should('be.visible');
    cy.get('canvas').rightclick(20, 20, { force: true });
    cy.contains('Add Person').should('be.visible');
  });

  it('opens quick start help', () => {
    cy.contains('button', 'Help').click();
    cy.contains('Quick Start').should('be.visible');
    cy.contains('Canvas & Navigation').should('be.visible');
  });
});
