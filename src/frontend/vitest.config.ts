/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  // The editor imports the repo README (`README.md?raw`, the in-app Help
  // Docs). It sits outside this package, and the vite inside vitest refuses
  // files outside its root unless the repo root is allowed (needed since the
  // dependency audit fix of 2026-09-30).
  server: {
    fs: {
      allow: [fileURLToPath(new URL('../..', import.meta.url))],
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    // jsdom needs a real (non-opaque) origin for window.localStorage.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: './src/setupTests.ts',
  },
});
