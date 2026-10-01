/**
 * A download save backs up the version it replaced, not what it just wrote
 * (review 2026-09-30 settings-06). The rotation rule itself is tested in
 * utils/storage.test.ts (nextBackupVersions); this checks the save path hands
 * it the right inputs.
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { rotateDiagramBackups } from '../utils/storage';

vi.mock('../utils/storage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../utils/storage')>();
  return { ...actual, rotateDiagramBackups: vi.fn(async () => null) };
});

import DiagramEditor from './DiagramEditor';

describe('DiagramEditor — browser backups on the download save path', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.mocked(rotateDiagramBackups).mockClear();
  });

  it('passes the saved JSON and no previous content, so the last saved version is what gets backed up', async () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation(() => 'blob:test');
    const revokeUrl = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      render(<DiagramEditor />);
      const saveButton = screen.getAllByRole('button').find((b) => b.textContent?.trim() === 'Save')!;
      fireEvent.click(saveButton);
      await waitFor(() => expect(rotateDiagramBackups).toHaveBeenCalledTimes(1));
      const [key, savedJson, previousJson] = vi.mocked(rotateDiagramBackups).mock.calls[0];
      expect(typeof key).toBe('string');
      expect(JSON.parse(savedJson as string)).toHaveProperty('people');
      expect(previousJson).toBeNull();
    } finally {
      createUrl.mockRestore();
      revokeUrl.mockRestore();
      anchorClick.mockRestore();
    }
  });
});
