import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    baseUrl: "http://localhost:5173",
    specPattern: "**/*.cy.ts",
    supportFile: "cypress/support/e2e.ts",
    setupNodeEvents(_on, _config) {
      // implement node event listeners here
    },
  },
});
