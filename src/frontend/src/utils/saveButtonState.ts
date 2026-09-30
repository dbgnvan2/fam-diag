export type SaveButtonVisualState = 'clean' | 'dirty' | 'critical';

export const TEN_MINUTES_MS = 10 * 60 * 1000;

export const getSaveButtonState = (
  isDirty: boolean,
  lastDirtyTimestamp: number | null,
  now: number,
  /** The browser refused an autosave write: only a file save keeps the work. */
  storageWriteFailed = false
): SaveButtonVisualState => {
  if (storageWriteFailed) return 'critical';
  if (!isDirty) {
    return 'clean';
  }
  if (!lastDirtyTimestamp) {
    return 'dirty';
  }
  return now - lastDirtyTimestamp >= TEN_MINUTES_MS ? 'critical' : 'dirty';
};
