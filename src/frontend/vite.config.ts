import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // @techstark/opencv-js ships its WASM as a sibling file the package's
    // loader fetches by URL. If Vite pre-bundles the package, that path
    // gets mangled and the WASM never loads → main-thread hang. Excluding
    // it from pre-bundling lets the package's own loader work unaltered.
    // tesseract.js has the same WASM-loader pattern.
    exclude: ['@techstark/opencv-js', 'tesseract.js'],
  },
})
