/**
 * The production Content-Security-Policy (vercel.json) must allow every host
 * the app actually talks to, and nothing is loaded from a host it does not
 * list (gap review F-19). A new fetch or embed host that is not added to the
 * policy fails here, before it is blocked in production.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const repoRoot = join(__dirname, '..', '..', '..');
const srcRoot = __dirname;

type VercelConfig = { headers?: Array<{ source: string; headers: Array<{ key: string; value: string }> }> };
const vercel = JSON.parse(readFileSync(join(repoRoot, 'vercel.json'), 'utf8')) as VercelConfig;
const headerValue = (key: string) =>
  vercel.headers?.flatMap((rule) => rule.headers).find((header) => header.key === key)?.value ?? '';

const directive = (name: string): string[] => {
  const entry = headerValue('Content-Security-Policy')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name} `));
  return entry ? entry.split(/\s+/).slice(1) : [];
};

const sourceFiles = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
// Comments are removed first: a URL mentioned in a comment is not one the
// app uses (gate 2026-09-30e LOW #2). The `[^:]` guard keeps "https://" from
// being read as the start of a // comment.
const stripComments = (text: string) =>
  text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
const allSource = sourceFiles(srcRoot)
  .map((path) => stripComments(readFileSync(path, 'utf8')))
  .join('\n');
const originOf = (url: string) => new URL(url).origin;

describe('production security headers', () => {
  it('apply to every path and forbid framing, plugins and foreign scripts', () => {
    expect(vercel.headers?.[0]?.source).toBe('/(.*)');
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
  });

  // How each https origin in the source is used. Video `embedUrl`s are
  // framed; a video's `url` is an "Open in YouTube" link (navigation, which
  // the policy does not govern); every other literal is something the app
  // fetches. Scanning every literal — not only fetch() calls — means moving a
  // URL into a constant cannot hide it from these checks.
  const originsOf = (pattern: RegExp) =>
    new Set([...allSource.matchAll(pattern)].map((match) => originOf(match[1])));
  const framed = originsOf(/embedUrl:\s*'(https:\/\/[^']+)'/g);
  const linked = originsOf(/\burl:\s*'(https:\/\/[^']+)'/g);
  const everyOrigin = originsOf(/(https:\/\/[a-zA-Z0-9.-]+)/g);
  const fetched = new Set([...everyOrigin].filter((origin) => !framed.has(origin) && !linked.has(origin)));
  const httpsEntries = (name: string) => new Set(directive(name).filter((entry) => entry.startsWith('https://')));

  it('connect-src allows exactly the origins the app fetches from', () => {
    expect([...httpsEntries('connect-src')].sort()).toEqual([...fetched].sort());
    expect(fetched).toEqual(new Set(['https://api.anthropic.com', 'https://api.deepseek.com']));
  });

  it('frame-src allows exactly the origins the app frames', () => {
    expect([...httpsEntries('frame-src')].sort()).toEqual([...framed].sort());
    expect(framed).toEqual(new Set(['https://www.youtube-nocookie.com']));
  });
});
