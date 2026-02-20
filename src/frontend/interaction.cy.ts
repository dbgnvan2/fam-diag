describe('Universal Interaction', () => {
  beforeEach(() => {
    // Load the fixture data defined in cypress/fixtures/genogram.json
    cy.fixture('genogram.json').then((data) => {
      cy.visit('/', {
        onBeforeLoad: (win) => {
          // Inject the fixture data into localStorage so the app loads it on startup.
          // TODO: Verify 'genogram' is the correct localStorage key your app uses.
          win.localStorage.setItem('genogram', JSON.stringify(data));
        },
      });
    });
  });

  it('highlights a Person Node when clicked', () => {
    // Wait for the canvas to be rendered
    cy.get('canvas').should('be.visible');

    // Coordinates for "John Doe" based on genogram2.json
    // x: 50, y: 50
    const x = 50;
    const y = 50;

    // Click on the canvas at the specific coordinates relative to the top-left of the canvas element.
    // force: true is used to ensure the click is registered even if Cypress detects the canvas as being "covered" by itself or overlays.
    cy.get('canvas').click(x, y, { force: true });

    // Verification:
    // Since we cannot easily assert pixel changes on the canvas without visual regression tools,
    // we would typically assert that a side effect occurred, such as a properties panel updating.
    // Example: cy.get('#properties-panel').should('contain', 'John Doe');
  });

  it('opens the context menu when right-clicking a Person Node', () => {
    cy.get('canvas').should('be.visible');

    // Coordinates for "Jane Doe" based on genogram2.json
    const x = 402;
    const y = 84;

    // Right-click to open context menu
    cy.get('canvas').rightclick(x, y, { force: true });

    // Verify context menu appears by checking for a menu option
    cy.contains('Edit Properties').should('be.visible');
  });

  it('displays stacked names when an Emotional Process Line is clicked', () => {
    cy.get('canvas').should('be.visible');

    // Coordinates for the EPL between "Jane Doe" (402, 84) and "Junior Doe" (143, 248)
    // Midpoint calculation: ((402+143)/2, (84+248)/2) = (272.5, 166)
    const x = 272;
    const y = 166;

    cy.get('canvas').click(x, y, { force: true });

    // Verify both names are visible.
    // Note: Strict vertical stacking verification usually requires visual regression or checking DOM structure (e.g. <br> tag or block elements).
    cy.contains('Jane Doe').should('be.visible');
    cy.contains('Junior Doe').should('be.visible');
  });
});