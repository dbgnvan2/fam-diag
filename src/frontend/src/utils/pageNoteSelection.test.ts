import { describe, it, expect } from 'vitest';
import { activeMarqueePageNoteIds, allSelectedPageNoteIds } from './pageNoteSelection';

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

describe('allSelectedPageNoteIds (CMD-X)', () => {
  it('joins the open note and an active marquee\'s notes, each once', () => {
    const peopleIds = ['a'];
    expect(allSelectedPageNoteIds('n1', peopleIds, { peopleIds, pageNoteIds: ['n1', 'n2'] })).toEqual(['n1', 'n2']);
  });

  it('a stale marquee adds nothing; the open note still counts', () => {
    expect(allSelectedPageNoteIds('n3', ['a'], { peopleIds: ['a'], pageNoteIds: ['n1'] })).toEqual(['n3']);
    expect(allSelectedPageNoteIds(null, [], { peopleIds: ['a'], pageNoteIds: ['n1'] })).toEqual([]);
  });
});
