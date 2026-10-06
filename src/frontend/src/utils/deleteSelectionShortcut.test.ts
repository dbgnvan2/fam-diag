import { describe, it, expect } from 'vitest';
import { deletePeopleConfirmMessage, isDeleteSelectionShortcut, isEditableTarget } from './deleteSelectionShortcut';

const key = (overrides: Partial<Parameters<typeof isDeleteSelectionShortcut>[0]> = {}) => ({
  key: 'x',
  metaKey: true,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  target: document.body,
  ...overrides,
});

describe('isDeleteSelectionShortcut', () => {
  it('matches CMD-X and Ctrl-X, either case', () => {
    expect(isDeleteSelectionShortcut(key())).toBe(true);
    expect(isDeleteSelectionShortcut(key({ metaKey: false, ctrlKey: true }))).toBe(true);
    expect(isDeleteSelectionShortcut(key({ key: 'X' }))).toBe(true);
  });

  it('ignores plain X, other letters, and X with Shift or Option/Alt', () => {
    expect(isDeleteSelectionShortcut(key({ metaKey: false }))).toBe(false);
    expect(isDeleteSelectionShortcut(key({ key: 'c' }))).toBe(false);
    expect(isDeleteSelectionShortcut(key({ shiftKey: true }))).toBe(false);
    expect(isDeleteSelectionShortcut(key({ altKey: true }))).toBe(false);
  });

  it('ignores CMD-X in a text field, where it cuts text', () => {
    for (const tag of ['input', 'textarea', 'select']) {
      expect(isDeleteSelectionShortcut(key({ target: document.createElement(tag) }))).toBe(false);
    }
  });
});

describe('isEditableTarget', () => {
  it('is true for a contenteditable element and false for a plain one', () => {
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { value: true });
    expect(isEditableTarget(editable)).toBe(true);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});

describe('deletePeopleConfirmMessage', () => {
  it('names everyone and says what else goes and that there is no undo', () => {
    expect(deletePeopleConfirmMessage(['Ann', 'Sam'])).toBe(
      'Delete 2 people: Ann, Sam?\n\nTheir partnerships, emotional lines and triangles are deleted too. This cannot be undone.'
    );
  });

  it('uses the singular for one person and marks a blank name', () => {
    expect(deletePeopleConfirmMessage(['  '])).toMatch(/^Delete 1 person: \(unnamed\)\?/);
  });

  it('lists ten names, then counts the rest', () => {
    const names = Array.from({ length: 13 }, (_, i) => `P${i + 1}`);
    const message = deletePeopleConfirmMessage(names);
    expect(message).toMatch(/^Delete 13 people: P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, and 3 more\?/);
    expect(message).not.toContain('P11');
  });
});
