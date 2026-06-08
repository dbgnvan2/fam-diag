/// <reference types="vite/client" />

// Vite's `?url` suffix returns the asset URL as a string. The reference
// above covers most cases; this fallback ambient declaration handles
// imports that TypeScript's vite/client doesn't pre-resolve.
declare module '*?url' {
  const src: string;
  export default src;
}
