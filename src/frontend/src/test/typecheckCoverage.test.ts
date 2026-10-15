/**
 * The type-check gates must cover the test files. Until 2026-10-14 they did
 * not: tsconfig.app.json excludes *.test.ts(x), nothing else included them,
 * and 203 type errors had built up in tests (LEARNINGS L5). These checks fail
 * if the wiring that fixed that is undone.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const frontendRoot = join(__dirname, '..', '..');
const readJson = (name: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(frontendRoot, name), 'utf8'));

describe('type-check gates cover the test files', () => {
  it('tsc -b builds the test project (tsconfig.json references tsconfig.test.json)', () => {
    const references = (readJson('tsconfig.json').references as Array<{ path: string }>) || [];
    expect(references.map((ref) => ref.path)).toContain('./tsconfig.test.json');
  });

  it('the test project includes src and excludes no test files', () => {
    const testConfig = readJson('tsconfig.test.json');
    expect(testConfig.extends).toBe('./tsconfig.app.json');
    expect(testConfig.include).toEqual(['src']);
    const exclude = (testConfig.exclude as string[]) || [];
    expect(exclude.filter((pattern) => pattern.includes('.test.'))).toEqual([]);
  });

  it('npm run typecheck uses the test project, which covers app and test files', () => {
    const scripts = readJson('package.json').scripts as Record<string, string>;
    expect(scripts.typecheck).toBe('tsc --noEmit -p tsconfig.test.json');
  });
});
