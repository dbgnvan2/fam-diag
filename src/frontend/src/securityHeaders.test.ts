/**
 * The production Content-Security-Policy (vercel.json) must allow every host
 * the app actually talks to, and nothing is loaded from a host it does not
 * list (gap review F-19). A new fetch or embed host that is not added to the
 * policy fails here, before it is blocked in production.
 *
 * URLs are read from the source with the TypeScript parser, so a URL in a
 * comment is never counted and a `//` inside a string never hides one (gate
 * 2026-09-30e / 30f LOW notes). Each https string literal is classified by
 * how the code uses it:
 *   - first argument of fetch() / fetchWithRetry()   → fetched (connect-src)
 *   - value of an `embedUrl` property                → framed (frame-src)
 *   - value of a `url` property (a link to follow)   → linked (not governed)
 * Any other https literal is reported as unclassified, with its file, so a
 * URL moved into a constant cannot slip past these checks.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
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

type Use = 'fetched' | 'framed' | 'linked' | 'unclassified';
type Found = { origin: string; use: Use; where: string };

const FETCHERS = new Set(['fetch', 'fetchWithRetry']);

const classify = (literal: ts.StringLiteralLike): Use => {
  const parent = literal.parent;
  if (ts.isCallExpression(parent) && parent.arguments[0] === literal) {
    const callee = parent.expression;
    const name = ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
    if (FETCHERS.has(name)) return 'fetched';
  }
  if (ts.isPropertyAssignment(parent) && parent.initializer === literal && ts.isIdentifier(parent.name)) {
    if (parent.name.text === 'embedUrl') return 'framed';
    if (parent.name.text === 'url') return 'linked';
  }
  return 'unclassified';
};

const found: Found[] = sourceFiles(srcRoot).flatMap((path) => {
  const file = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true);
  const out: Found[] = [];
  const visit = (node: ts.Node) => {
    if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && /^https:\/\//.test(node.text)) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart());
      out.push({
        origin: new URL(node.text).origin,
        use: classify(node),
        where: `${relative(srcRoot, path)}:${line + 1}`,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return out;
});

const originsUsedAs = (use: Use) => new Set(found.filter((entry) => entry.use === use).map((entry) => entry.origin));
const httpsEntries = (name: string) => new Set(directive(name).filter((entry) => entry.startsWith('https://')));
const sorted = (set: Set<string>) => [...set].sort();

describe('production security headers', () => {
  it('apply to every path and forbid framing, plugins and foreign scripts', () => {
    expect(vercel.headers?.[0]?.source).toBe('/(.*)');
    expect(directive('frame-ancestors')).toEqual(["'none'"]);
    expect(directive('object-src')).toEqual(["'none'"]);
    expect(directive('script-src')).toEqual(["'self'"]);
    expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
  });

  it('every https URL in the source is fetched, framed or linked (classify any new use here)', () => {
    expect(found.filter((entry) => entry.use === 'unclassified').map((entry) => `${entry.where} ${entry.origin}`)).toEqual([]);
  });

  it('connect-src allows exactly the origins the app fetches from', () => {
    expect(sorted(httpsEntries('connect-src'))).toEqual(sorted(originsUsedAs('fetched')));
    expect(sorted(originsUsedAs('fetched'))).toEqual(['https://api.anthropic.com', 'https://api.deepseek.com']);
  });

  it('frame-src allows exactly the origins the app frames', () => {
    expect(sorted(httpsEntries('frame-src'))).toEqual(sorted(originsUsedAs('framed')));
    expect(sorted(originsUsedAs('framed'))).toEqual(['https://www.youtube-nocookie.com']);
  });
});
