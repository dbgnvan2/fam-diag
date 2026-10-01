import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BackupRestoreDialog from './BackupRestoreDialog';

describe('BackupRestoreDialog (review 2026-09-30 settings-06)', () => {
  it('names V1 as the version before the last save and shows when each was replaced', () => {
    const replaced = '2026-09-30T10:00:00.000Z';
    render(
      <BackupRestoreDialog
        open
        versions={{ latest: '{}', v1: '{"a":1}', replacedAt1: replaced, v2: '{"a":0}', v3: null }}
        onClose={vi.fn()}
        onRestoreVersion={vi.fn()}
      />
    );
    const buttons = screen.getAllByRole('button').filter((b) => /^V\d/.test(b.textContent ?? ''));
    expect(buttons.map((b) => b.textContent)).toEqual([
      `V1 (before the last save, replaced ${new Date(replaced).toLocaleString()})`,
      'V2 (earlier backup)',
      'V3 (oldest backup)',
    ]);
    expect((buttons[2] as HTMLButtonElement).disabled).toBe(true);
  });
});
