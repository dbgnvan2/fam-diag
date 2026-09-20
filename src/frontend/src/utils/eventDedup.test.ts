/**
 * Regression: a person's Timeline lane listed each of their partnership's
 * events twice — once as the `-p1` clone stored on the person, once as the
 * partnership's own original, because the lane only compared exact ids.
 */
import { describe, it, expect } from 'vitest';
import { baseEventId, hasSameEvent } from './eventDedup';

describe('eventDedup', () => {
  it('test_dedup_strips_the_clone_suffix', () => {
    expect(baseEventId('evt-1-p1')).toBe('evt-1');
    expect(baseEventId('evt-1-p2')).toBe('evt-1');
    expect(baseEventId('evt-1')).toBe('evt-1');
    // Only the trailing marker is a clone suffix.
    expect(baseEventId('evt-p1-more')).toBe('evt-p1-more');
  });

  it('test_dedup_matches_the_original_against_a_clone_already_held', () => {
    // Peter Doe's case: the person holds `<id>-p1`, the partnership offers
    // `<id>` — the same marriage, not two.
    const own = new Set(['1789853310593-a33193f5d8f1f-p1']);
    expect(hasSameEvent('1789853310593-a33193f5d8f1f', own)).toBe(true);
  });

  it('test_dedup_matches_a_clone_against_the_original_already_held', () => {
    const own = new Set(['evt-9']);
    expect(hasSameEvent('evt-9-p2', own)).toBe(true);
  });

  it('test_dedup_matches_the_other_partners_clone', () => {
    const own = new Set(['evt-9-p1']);
    expect(hasSameEvent('evt-9-p2', own)).toBe(true);
  });

  it('test_dedup_leaves_unrelated_events_alone', () => {
    const own = new Set(['evt-9-p1']);
    expect(hasSameEvent('evt-8', own)).toBe(false);
    expect(hasSameEvent('evt-90', own)).toBe(false);
  });
});
