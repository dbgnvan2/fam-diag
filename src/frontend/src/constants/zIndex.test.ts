import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';
import ts from 'typescript';
import { HINT_Z_INDEX, RIBBON_Z_INDEX, Z_INDEX } from './zIndex';

const srcRoot = join(__dirname, '..');

/** Lines (1-based) where a `zIndex` property or JSX prop is given a bare number. */
const bareZIndexLines = (fileName: string, text: string): number[] => {
  const file = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
  // A bare number, or a name that is not the scale (a local `MODAL_Z = 12000`
  // hid three dialogs from the number-only check — review struct-09).
  const SCALE_NAMES = new Set(['Z_INDEX', 'HINT_Z_INDEX', 'RIBBON_Z_INDEX']);
  const rootName = (node: ts.Node): string =>
    ts.isIdentifier(node) ? node.text : ts.isPropertyAccessExpression(node) ? rootName(node.expression) : '';
  const isBareNumber = (node: ts.Node | undefined): boolean => {
    if (!node) return false;
    if (ts.isNumericLiteral(node)) return true;
    if (ts.isIdentifier(node)) return !SCALE_NAMES.has(node.text) && node.text !== 'zIndex';
    if (ts.isPropertyAccessExpression(node)) return !SCALE_NAMES.has(rootName(node));
    if (ts.isPrefixUnaryExpression(node)) return isBareNumber(node.operand);
    if (ts.isParenthesizedExpression(node) || ts.isJsxExpression(node)) return isBareNumber(node.expression);
    if (ts.isConditionalExpression(node)) return isBareNumber(node.whenTrue) || isBareNumber(node.whenFalse);
    return false;
  };
  const nameOf = (name: ts.Node) => (ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : '');
  const lines: number[] = [];
  const visit = (node: ts.Node) => {
    const flagged =
      (ts.isPropertyAssignment(node) && nameOf(node.name) === 'zIndex' && isBareNumber(node.initializer)) ||
      (ts.isJsxAttribute(node) && nameOf(node.name) === 'zIndex' && isBareNumber(node.initializer));
    if (flagged) lines.push(file.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    ts.forEachChild(node, visit);
  };
  visit(file);
  return lines;
};


describe('z-index scale', () => {
  it('keeps the orderings the app depends on', () => {
    expect(HINT_Z_INDEX).toBeLessThan(RIBBON_Z_INDEX);
    expect(RIBBON_Z_INDEX).toBeLessThan(Z_INDEX.RIBBON_DROPDOWN);
    expect(Z_INDEX.CONTEXT_MENU).toBeLessThan(Z_INDEX.CONTEXT_SUBMENU);
    expect(Z_INDEX.EVENT_MODAL_BACKDROP).toBeLessThan(Z_INDEX.EVENT_MODAL);
    // An event dialog opened from the Timeline sits above the board.
    expect(Z_INDEX.TIMELINE_BOARD).toBeLessThan(Z_INDEX.NESTED_EVENT_DIALOG);
    // The build demo walks over the help it was started from.
    expect(Z_INDEX.HELP_DIALOG).toBeLessThan(Z_INDEX.BUILD_DEMO);
  });

  // This rule is about the source itself (every z-index comes from the scale),
  // so it reads the source — with the TypeScript parser, not a line regex: a
  // comment is never flagged, and `zIndex={5}` or a number split over lines is
  // not missed (the regex missed three `zIndex={2000}`-style props). Scans
  // everything under src/, not only components/.
  it('nothing sets a z-index with a bare number (TODO 2026-08-24)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      readdirSync(dir).forEach((entry) => {
        const path = join(dir, entry);
        if (statSync(path).isDirectory()) return walk(path);
        if (!/\.tsx?$/.test(entry) || /\.test\./.test(entry)) return;
        const rel = relative(srcRoot, path);
        if (rel === join('constants', 'zIndex.ts')) return; // the scale itself
        bareZIndexLines(path, readFileSync(path, 'utf8')).forEach((line) => offenders.push(`${rel}:${line}`));
      });
    };
    walk(srcRoot);
    expect(offenders).toEqual([]);
  });

  it('the scan finds every bare number or non-scale name, and ignores comments and the scale', () => {
    const sample = [
      'const a = { zIndex: 5 };',
      'const b = <div style={{ zIndex: -1 }} />;',
      'const c = <Layer zIndex={7} />;',
      'const d = { zIndex: open ? 3 : Z_INDEX.HINT };',
      '// zIndex: 9 in a comment',
      'const e = { zIndex: Z_INDEX.HINT };',
      'const MODAL_Z = 12000; const f = { zIndex: MODAL_Z };',
      'const g = { zIndex };',
    ].join('\n');
    expect(bareZIndexLines('sample.tsx', sample)).toEqual([1, 2, 3, 4, 7]);
  });
});
