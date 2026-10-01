import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The production security headers live in the repo root's vercel.json. `vite
// preview` serves the built app with the same headers, so a policy that would
// break the deployed app shows up locally first.
type VercelHeaders = { headers?: Array<{ headers: Array<{ key: string; value: string }> }> }
const vercel = JSON.parse(readFileSync(new URL('../../vercel.json', import.meta.url), 'utf8')) as VercelHeaders
const productionHeaders = Object.fromEntries(
  (vercel.headers ?? []).flatMap((rule) => rule.headers.map(({ key, value }) => [key, value]))
)

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  preview: { headers: productionHeaders },
})
