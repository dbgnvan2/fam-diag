export type RatingOption = {
  value: number;
  label: string;
};

const clampDimensionValue = (value: number) => {
  if (Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(5, Math.round(value)));
};

export const FREQUENCY_OPTIONS: RatingOption[] = [
  { value: 0, label: '0 — Absent' },
  { value: 1, label: '1 — Rare (Minimum)' },
  { value: 2, label: '2 — Occasional (Mild)' },
  { value: 3, label: '3 — Regular (Moderate)' },
  { value: 4, label: '4 — Frequent (Major)' },
  { value: 5, label: '5 — Continuous (Maximal)' },
];

export const INTENSITY_OPTIONS: RatingOption[] = [
  { value: 0, label: '0 — Absent' },
  { value: 1, label: '1 — Faint (Minimum)' },
  { value: 2, label: '2 — Noticeable (Mild)' },
  { value: 3, label: '3 — Evident (Moderate)' },
  { value: 4, label: '4 — Marked (Major)' },
  { value: 5, label: '5 — Extreme (Maximal)' },
];

export const IMPACT_OPTIONS: RatingOption[] = [
  { value: 0, label: '0 — None' },
  { value: 1, label: '1 — Not Limiting (Minimum)' },
  { value: 2, label: '2 — Minor Interference (Mild)' },
  { value: 3, label: '3 — Manageable (Moderate)' },
  { value: 4, label: '4 — Significant · Daily (Major)' },
  { value: 5, label: '5 — Dictates Daily Choices (Maximal)' },
];

export const FREQUENCY_LABELS = new Map(FREQUENCY_OPTIONS.map((opt) => [opt.value, opt.label]));
export const INTENSITY_LABELS = new Map(INTENSITY_OPTIONS.map((opt) => [opt.value, opt.label]));
export const IMPACT_LABELS = new Map(IMPACT_OPTIONS.map((opt) => [opt.value, opt.label]));

export const clampIndicatorDimension = (value: number | undefined | null) =>
  clampDimensionValue(typeof value === 'number' ? value : 0);
