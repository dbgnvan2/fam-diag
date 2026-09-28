import { describe, it, expect, vi } from 'vitest';
import { confirmDiscardUnsavedChanges } from './unsavedChanges';

describe('confirmDiscardUnsavedChanges', () => {
  it('proceeds without asking when nothing is unsaved', () => {
    const confirmFn = vi.fn(() => false);
    expect(confirmDiscardUnsavedChanges(false, 'Open "a.json"', confirmFn)).toBe(true);
    expect(confirmFn).not.toHaveBeenCalled();
  });

  it('asks when dirty and follows the answer', () => {
    const yes = vi.fn(() => true);
    const no = vi.fn(() => false);
    expect(confirmDiscardUnsavedChanges(true, 'Open "a.json"', yes)).toBe(true);
    expect(confirmDiscardUnsavedChanges(true, 'Open "a.json"', no)).toBe(false);
    expect(no).toHaveBeenCalledWith('Open "a.json"? Unsaved changes to the current diagram will be lost.');
  });
});
