/**
 * Purpose: the status rows each relationship type offers, and the label each
 *          status date is written under.
 * Spec:    n/a — extracted 2026-09-20
 * Tests:   src/frontend/src/utils/partnershipStatusEvents.test.ts
 *
 * Editorial vocabulary, shared by the Properties panel that writes these
 * labels and the recogniser that has to identify them exactly. Matching them
 * loosely hid real events: "Marriage counselling" and "Separation anxiety"
 * are the user's own records, not status dates.
 */
export const RELATIONSHIP_TYPE_STATUS_ROWS: Record<string, { status: string; dateLabel: string }[]> = {
  married: [
    { status: 'married', dateLabel: 'Married' },
    { status: 'divorce', dateLabel: 'Divorced' },
    { status: 'separated', dateLabel: 'Separated' },
    { status: 'widowed', dateLabel: 'Widowed' },
  ],
  engaged: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  friendship: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  affair: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  'living-together': [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
  'common-law': [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ended', dateLabel: 'Ended' },
    { status: 'separated', dateLabel: 'Separated' },
    { status: 'widowed', dateLabel: 'Widowed' },
  ],
  dating: [
    { status: 'start', dateLabel: 'Start' },
    { status: 'ongoing', dateLabel: 'Ongoing' },
    { status: 'ended', dateLabel: 'Ended' },
  ],
};

/** Every label a status date can be written under, lower-cased. */
export const RELATIONSHIP_STATUS_DATE_LABELS: ReadonlySet<string> = new Set(
  Object.values(RELATIONSHIP_TYPE_STATUS_ROWS)
    .flat()
    .map((row) => row.dateLabel.trim().toLowerCase())
);
