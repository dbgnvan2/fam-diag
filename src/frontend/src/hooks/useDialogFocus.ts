import { useEffect, useRef } from 'react';

/**
 * The open dialogs, oldest first. Escape closes only the newest one: an event
 * dialog opened from the Timeline must not close the Timeline too.
 */
const openDialogs: symbol[] = [];

/**
 * Keyboard and screen-reader basics for a dialog: when it opens, focus moves
 * into it (so it is announced and reachable without tabbing through the
 * ribbon); Escape closes it when it is the topmost open dialog; when it
 * closes, focus goes back to where it was.
 *
 * Call it before any early `return null`, and put the returned ref, with
 * tabIndex={-1}, on the element that has role="dialog".
 */
export const useDialogFocus = <T extends HTMLElement = HTMLDivElement>(open: boolean, onClose: () => void) => {
  const dialogRef = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const token = Symbol('dialog');
    openDialogs.push(token);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    // Focus moves in only if it is not already inside (a field the dialog
    // focused itself keeps it).
    if (!dialogRef.current?.contains(document.activeElement)) dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || openDialogs[openDialogs.length - 1] !== token) return;
      onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      const index = openDialogs.indexOf(token);
      if (index >= 0) openDialogs.splice(index, 1);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  return dialogRef;
};
