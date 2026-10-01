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
const allSource = sourceFiles(srcRoot).map((path) => readFileSync(path, 'utf8')).join('\n');
const originOf = (url: string) => new URL(url).origin;

describe('production security headers', () => {
  it('apply to every path and forbid framing, plugins and foreign scripts', () => {
    expect(vercel.headers?.[0]?.source).toBe('/(.*)');
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
  });

  it('connect-src lists every host the app fetches from', () => {
    const fetched = [...allSource.matchAll(/fetch(?:WithRetry)?\(\s*'(https:\/\/[^']+)'/g)].map((m) => originOf(m[1]));
    expect(fetched.length).toBeGreaterThan(0);
    for (const origin of new Set(fetched)) expect(directive('connect-src')).toContain(origin);
  });

  it('frame-src lists every video embed host', () => {
    const embeds = [...allSource.matchAll(/embedUrl:\s*'(https:\/\/[^']+)'/g)].map((m) => originOf(m[1]));
    expect(embeds.length).toBeGreaterThan(0);
    for (const origin of new Set(embeds)) expect(directive('frame-src')).toContain(origin);
  });
});
