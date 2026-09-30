import { describe, it, expect } from 'vitest';
import { activeMarqueePageNoteIds } from './pageNoteSelection';

describe('activeMarqueePageNoteIds', () => {
  it('keeps the marquee\'s notes while its people selection stands', () => {
    const peopleIds = ['a', 'b'];
    expect(activeMarqueePageNoteIds(peopleIds, { peopleIds, pageNoteIds: ['n1'] })).toEqual(['n1']);
  });

  it('drops them once the selection is replaced, even with the same people (regression: dragged stale notes)', () => {
    const marquee = { peopleIds: ['a', 'b'], pageNoteIds: ['n1'] };
    expect(activeMarqueePageNoteIds(['a', 'b'], marquee)).toEqual([]);
    expect(activeMarqueePageNoteIds([], marquee)).toEqual([]);
  });
});
