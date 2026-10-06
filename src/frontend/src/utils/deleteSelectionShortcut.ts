/**
 * Purpose: CMD-X (Ctrl-X off the Mac) deletes the selected people and page notes.
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

const listNames = (names: string[], blank: string, quote: boolean) => {
  const shown = names
    .slice(0, MAX_NAMES_LISTED)
    .map((name) => name.trim() || blank)
    .map((name) => (quote ? `"${name}"` : name));
  const more = names.length - shown.length;
  return shown.join(', ') + (more > 0 ? `, and ${more} more` : '');
};

const count = (n: number, one: string, many: string) => (n === 1 ? `1 ${one}` : `${n} ${many}`);

/**
 * The confirm text for deleting the selection: `personNames` and
 * `noteTitles` in selection order. Each list shows ten, then "and N more".
 */
export const deleteSelectionConfirmMessage = (personNames: string[], noteTitles: string[] = []): string => {
  const people = personNames.length
    ? `${count(personNames.length, 'person', 'people')}: ${listNames(personNames, '(unnamed)', false)}`
    : '';
  const notes = noteTitles.length
    ? `${count(noteTitles.length, 'page note', 'page notes')}: ${listNames(noteTitles, 'untitled', true)}`
    : '';
  const what = people && notes ? `${people}; and ${notes}` : people || notes;
  const cascade = personNames.length
    ? `${notes ? (personNames.length === 1 ? "The person's" : "The people's") : 'Their'} partnerships, emotional lines and triangles are deleted too. `
    : '';
  return `Delete ${what}?\n\n${cascade}This cannot be undone.`;
};
