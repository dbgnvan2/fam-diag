import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { HINT_Z_INDEX, RIBBON_Z_INDEX, Z_INDEX } from './zIndex';

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

  it('no component sets a z-index with a bare number (TODO 2026-08-24)', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      readdirSync(dir).forEach((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return walk(path);
        if (!/\.tsx?$/.test(name) || /\.test\./.test(name)) return;
        readFileSync(path, 'utf8')
          .split('\n')
          .forEach((line, index) => {
            if (/zIndex:\s*\d/.test(line)) offenders.push(`${path}:${index + 1}`);
          });
      });
    };
    walk(join(__dirname, '../components'));
    expect(offenders).toEqual([]);
  });
});
