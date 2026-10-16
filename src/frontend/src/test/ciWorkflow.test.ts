/**
 * CI must run the same gates as the CLAUDE.md pre-completion checklist, and
 * only by invoking them: an assertion written inline in the workflow cannot
 * fail before a push (global testing rules).
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

const repoRoot = join(__dirname, '..', '..', '..', '..');
const workflowPath = join(repoRoot, '.github', 'workflows', 'tests.yml');

describe('CI workflow runs the checklist gates', () => {
  it('exists', () => {
    expect(existsSync(workflowPath)).toBe(true);
  });

  const workflow = existsSync(workflowPath) ? readFileSync(workflowPath, 'utf8') : '';
  const runLines = workflow
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('run:') || line.startsWith('- run:'))
    .map((line) => line.replace(/^-?\s*run:\s*/, ''));

  it.each([
    ['installs from the lockfile', 'npm ci'],
    ['type-checks app and test files', 'npm run typecheck'],
    ['runs the test suite', 'npx vitest run'],
    ['runs the Vercel build type-check', 'npx tsc -b --force'],
    ['lints', 'npm run lint'],
  ])('%s (%s)', (_label, command) => {
    expect(runLines.some((line) => line.split(' && ').includes(command))).toBe(true);
  });

  it('runs every step in the frontend package', () => {
    expect(workflow).toContain('working-directory: src/frontend');
    expect(workflow).toContain('cache-dependency-path: src/frontend/package-lock.json');
  });
});
