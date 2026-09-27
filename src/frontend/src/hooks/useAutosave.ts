import { useEffect, useRef } from 'react';

/**
 * Debounced save: calls onSave(data) once `delay` ms after `data` last changed.
 *
 * The timer is keyed on `data` and `delay` only. onSave is read from a ref so
 * that a caller passing an inline arrow (new identity every render) does not
 * restart the timer on every re-render — DiagramEditor re-renders every 500 ms
 * while dirty, which previously meant the save never fired.
 */
export const useAutosave = <T,>(data: T, onSave: (data: T) => void, delay = 1000) => {
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  useEffect(() => {
    const timeout = setTimeout(() => {
      onSaveRef.current(data);
    }, delay);
    return () => clearTimeout(timeout);
  }, [data, delay]);
};
