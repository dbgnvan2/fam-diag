/**
 * Purpose: which page notes a group drag should move.
 * Spec:    n/a — REVIEW-unread-areas-2026-09-30.md (stale page-note selection)
 * Tests:   src/frontend/src/utils/pageNoteSelection.test.ts
 *
 * Only the marquee selects page notes, and nothing else cleared them, so a
 * later click or shift-click selection still dragged notes the user no
 * longer saw as selected. The marquee's notes now count only while the
 * people selection is still the exact array that marquee set: every other
 * selection change makes a new array.
 */
export type MarqueePageNoteSelection = { peopleIds: string[]; pageNoteIds: string[] };

export const activeMarqueePageNoteIds = (
  selectedPeopleIds: string[],
  marquee: MarqueePageNoteSelection
): string[] => (selectedPeopleIds === marquee.peopleIds ? marquee.pageNoteIds : []);
