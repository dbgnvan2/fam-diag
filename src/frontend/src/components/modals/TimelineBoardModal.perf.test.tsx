/**
 * The relatives' events on each lane are computed once per diagram, not on
 * every render (review 2026-09-30 struct-02): hover, the lane filter and the
 * unsaved-changes tick re-render the board without changing the diagram.
 */
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { Partnership, Person } from '../../types';

vi.mock('../../utils/systemEvents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../utils/systemEvents')>();
  return { ...actual, collectSystemEvents: vi.fn(actual.collectSystemEvents) };
});

import TimelineBoardModal from './TimelineBoardModal';
import { collectSystemEvents } from '../../utils/systemEvents';

const people: Person[] = [
  { id: 'a', name: 'A', x: 0, y: 0, partnerships: ['pr'], birthSex: 'male' },
  { id: 'b', name: 'B', x: 0, y: 0, partnerships: ['pr'], birthSex: 'female' },
];
const partnerships: Partnership[] = [
  { id: 'pr', partner1_id: 'a', partner2_id: 'b', horizontalConnectorY: 0, relationshipType: 'married', relationshipStatus: 'married', children: [] },
];

const noLines: [] = [];
const noCategories: string[] = [];
const board = (list: Person[]) => (
  <TimelineBoardModal
    people={list}
    partnerships={partnerships}
    allEmotionalLines={noLines}
    eventCategories={noCategories}
    timelineSelectionIds={['a', 'b']}
    open
    onUpdatePerson={() => {}}
    onUpdatePartnership={() => {}}
    onUpdateEmotionalLine={() => {}}
    onClose={() => {}}
  />
);

describe('TimelineBoardModal — system events are cached per diagram', () => {
  it('a re-render with the same diagram does not recompute them; a changed diagram does', () => {
    const spy = vi.mocked(collectSystemEvents);
    const { rerender } = render(board(people));
    const afterFirst = spy.mock.calls.length;
    expect(afterFirst).toBeGreaterThan(0);
    rerender(board(people));
    rerender(board(people));
    expect(spy.mock.calls.length).toBe(afterFirst);
    rerender(board([...people]));
    expect(spy.mock.calls.length).toBeGreaterThan(afterFirst);
  });
});
