/**
 * Guard for actions that replace the whole diagram (Open, Reopen, backup
 * restore, import in "replace" mode).
 *
 * Returns true when it is safe to proceed: nothing is unsaved, or the user
 * confirmed. Call it just before the replace, not before a file picker or a
 * permission request — those need the click's user activation, which a
 * blocking confirm dialog can use up.
 */
export const confirmDiscardUnsavedChanges = (
  isDirty: boolean,
  actionLabel: string,
  confirmFn: (message: string) => boolean = (message) => window.confirm(message)
): boolean => {
  if (!isDirty) return true;
  return confirmFn(`${actionLabel}? Unsaved changes to the current diagram will be lost.`);
};
