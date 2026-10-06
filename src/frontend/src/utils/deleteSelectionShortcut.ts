/**
 * Purpose: CMD-X (Ctrl-X off the Mac) deletes the selected people.
 * Tests:   src/frontend/src/utils/deleteSelectionShortcut.test.ts
 *
 * The app has no clipboard, so X with the command key is free; there is no
 * undo, so the delete asks first and names who goes.
 */

/** True when the keystroke is aimed at a text field, where CMD-X means "cut text". */
export const isEditableTarget = (target: EventTarget | null): boolean => {
  const el = target as HTMLElement | null;
  const tagName = el?.tagName?.toLowerCase();
  return tagName === 'input' || tagName === 'textarea' || tagName === 'select' || Boolean(el?.isContentEditable);
};

type ShortcutKeyEvent = Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'shiftKey' | 'altKey' | 'target'>;

/**
 * CMD-X, or Ctrl-X, with no Shift or Option/Alt, outside a text field.
 * Matched by `key`, so it follows the keyboard layout's X.
 */
export const isDeleteSelectionShortcut = (event: ShortcutKeyEvent): boolean =>
  (event.metaKey || event.ctrlKey) &&
  !event.shiftKey &&
  !event.altKey &&
  event.key.toLowerCase() === 'x' &&
  !isEditableTarget(event.target);

/** Names listed in the confirm message before "and N more". */
const MAX_NAMES_LISTED = 10;

/** The confirm text for deleting `names` (one per selected person, in selection order). */
export const deletePeopleConfirmMessage = (names: string[]): string => {
  const shown = names.slice(0, MAX_NAMES_LISTED).map((name) => name.trim() || '(unnamed)');
  const more = names.length - shown.length;
  const list = shown.join(', ') + (more > 0 ? `, and ${more} more` : '');
  const who = names.length === 1 ? '1 person' : `${names.length} people`;
  return (
    `Delete ${who}: ${list}?\n\n` +
    'Their partnerships, emotional lines and triangles are deleted too. This cannot be undone.'
  );
};
