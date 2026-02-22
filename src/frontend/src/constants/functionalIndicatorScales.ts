export type RatingOption = {
  value: number;
  label: string;
};

const clampDimensionValue = (value: number) => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
};

export const FREQUENCY_OPTIONS: RatingOption[] = [
  { value: 0, label: 'Absent · 0 — Absent' },
  { value: 1, label: 'Minimum · 1 — Rare' },
  { value: 2, label: 'Mild · 2 — Occasional' },
  { value: 3, label: 'Moderate · 3 — Regular' },
  { value: 4, label: 'Major · 4 — Frequent' },
  { value: 5, label: 'Maximal · 5 — Continuous' },
];

export const INTENSITY_OPTIONS: RatingOption[] = [
  { value: 0, label: 'Absent · 0 — Absent' },
  { value: 1, label: 'Minimum · 1 — Faint' },
  { value: 2, label: 'Mild · 2 — Noticeable' },
  { value: 3, label: 'Moderate · 3 — Evident' },
  { value: 4, label: 'Major · 4 — Marked' },
  { value: 5, label: 'Maximal · 5 — Extreme' },
];

export const IMPACT_OPTIONS: RatingOption[] = [
  { value: 0, label: 'Absent · 0 — None' },
  { value: 1, label: 'Minimum · 1 — Not Limiting' },
  { value: 2, label: 'Mild · 2 — Minor Interference' },
  { value: 3, label: 'Moderate · 3 — Manageable' },
  { value: 4, label: 'Major · 4 — Significant-Daily' },
  { value: 5, label: 'Maximal · 5 — Dictates Daily Choices' },
];

export const FREQUENCY_LABELS = new Map(FREQUENCY_OPTIONS.map((opt) => [opt.value, opt.label]));
export const INTENSITY_LABELS = new Map(INTENSITY_OPTIONS.map((opt) => [opt.value, opt.label]));
export const IMPACT_LABELS = new Map(IMPACT_OPTIONS.map((opt) => [opt.value, opt.label]));

export const clampIndicatorDimension = (value: number | undefined | null) =>
  clampDimensionValue(typeof value === 'number' ? value : 0);
