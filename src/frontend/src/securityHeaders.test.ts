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

  // Every https origin written anywhere in the app's source must be allowed by
  // the policy, or be a link the user follows (navigation is not governed by
  // connect-src / frame-src). Scanning every literal, not only fetch() calls,
  // means moving a URL into a constant cannot hide it from this check (gate
  // 2026-09-30d LOW #2).
  const NAVIGATION_ONLY = new Set(['https://www.youtube.com', 'https://youtu.be']);
  const sourceOrigins = new Set([...allSource.matchAll(/https:\/\/[a-zA-Z0-9.-]+/g)].map((m) => originOf(m[0])));

  it('every https origin in the source is allowed by the policy or is a plain link', () => {
    const allowed = new Set([...directive('connect-src'), ...directive('frame-src'), ...NAVIGATION_ONLY]);
    const unlisted = [...sourceOrigins].filter((origin) => !allowed.has(origin));
    expect(unlisted).toEqual([]);
  });

  it('the AI providers are reachable by fetch, the video host by frame', () => {
    expect(directive('connect-src')).toEqual(expect.arrayContaining(['https://api.anthropic.com', 'https://api.deepseek.com']));
    expect(directive('frame-src')).toContain('https://www.youtube-nocookie.com');
  });

  it('the policy allows no origin the app does not use', () => {
    const listed = [...directive('connect-src'), ...directive('frame-src')].filter((entry) => entry.startsWith('https://'));
    expect(listed.filter((origin) => !sourceOrigins.has(origin))).toEqual([]);
  });
});
