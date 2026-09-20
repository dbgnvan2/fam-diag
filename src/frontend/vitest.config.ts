/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    // jsdom needs a real (non-opaque) origin for window.localStorage.
    environmentOptions: { jsdom: { url: 'http://localhost/' } },
    setupFiles: './src/setupTests.ts',
  },
});
