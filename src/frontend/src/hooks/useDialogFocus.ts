import { useEffect, useRef } from 'react';

/**
 * Keyboard and screen-reader basics for a dialog: when it opens, focus moves
 * into it (so it is announced and reachable without tabbing through the
 * ribbon); Escape closes it; when it closes, focus goes back to where it was.
 * The hint and the two help dialogs had none of this.
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
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      if (previous && document.contains(previous)) previous.focus();
    };
  }, [open]);

  return dialogRef;
};
