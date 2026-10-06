import { describe, it, expect } from 'vitest';
import { deleteSelectionConfirmMessage, isDeleteSelectionShortcut, isEditableTarget } from './deleteSelectionShortcut';

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

describe('deleteSelectionConfirmMessage', () => {
  it('names everyone and says what else goes and that there is no undo', () => {
    expect(deleteSelectionConfirmMessage(['Ann', 'Sam'])).toBe(
      'Delete 2 people: Ann, Sam?\n\nTheir partnerships, emotional lines and triangles are deleted too. This cannot be undone.'
    );
  });

  it('uses the singular for one person and marks a blank name', () => {
    expect(deleteSelectionConfirmMessage(['  '])).toMatch(/^Delete 1 person: \(unnamed\)\?/);
  });

  it('lists ten names, then counts the rest', () => {
    const names = Array.from({ length: 13 }, (_, i) => `P${i + 1}`);
    const message = deleteSelectionConfirmMessage(names);
    expect(message).toMatch(/^Delete 13 people: P1, P2, P3, P4, P5, P6, P7, P8, P9, P10, and 3 more\?/);
    expect(message).not.toContain('P11');
  });
});

describe('deleteSelectionConfirmMessage — page notes', () => {
  it('notes only: titles quoted, no partnership sentence', () => {
    expect(deleteSelectionConfirmMessage([], ['Intake', 'Plan'])).toBe(
      'Delete 2 page notes: "Intake", "Plan"?\n\nThis cannot be undone.'
    );
  });

  it('people and notes in one question; the cascade sentence is about the people', () => {
    expect(deleteSelectionConfirmMessage(['Ann'], ['Intake'])).toBe(
      'Delete 1 person: Ann; and 1 page note: "Intake"?\n\n' +
        "The person's partnerships, emotional lines and triangles are deleted too. This cannot be undone."
    );
    expect(deleteSelectionConfirmMessage(['Ann', 'Sam'], ['Intake'])).toContain("The people's partnerships");
  });

  it('a blank title reads "untitled", and notes are capped at ten like people', () => {
    expect(deleteSelectionConfirmMessage([], [' '])).toMatch(/^Delete 1 page note: "untitled"\?/);
    const titles = Array.from({ length: 12 }, (_, i) => `N${i + 1}`);
    expect(deleteSelectionConfirmMessage([], titles)).toMatch(/"N10", and 2 more\?/);
  });
});
