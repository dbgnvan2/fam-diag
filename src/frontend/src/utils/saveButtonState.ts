export type SaveButtonVisualState = 'clean' | 'dirty' | 'critical';

export const TEN_MINUTES_MS = 10 * 60 * 1000;

export const getSaveButtonState = (
  isDirty: boolean,
  lastDirtyTimestamp: number | null,
  now: number
): SaveButtonVisualState => {
  if (!isDirty) {
    return 'clean';
  }
  if (!lastDirtyTimestamp) {
    return 'dirty';
  }
  return now - lastDirtyTimestamp >= TEN_MINUTES_MS ? 'critical' : 'dirty';
};
