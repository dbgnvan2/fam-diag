import { describe, expect, it } from 'vitest';
import type { Person, Partnership } from '../types';
import { removeOrphanedMiscarriages } from './dataCleanup';

const basePartnership: Partnership = {
  id: 'p1',
  partner1_id: 'a',
  partner2_id: 'b',
  horizontalConnectorY: 100,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: [],
};

describe('removeOrphanedMiscarriages', () => {
  it('removes miscarriages that are not attached to a partnership', () => {
    const people: Person[] = [
      { id: 'child1', name: 'Child', x: 0, y: 0, partnerships: [], parentPartnership: 'p1' },
      { id: 'mc1', name: 'Miscarriage', x: 10, y: 10, partnerships: [], lifeStatus: 'miscarriage' },
    ];
    const partnerships = [{ ...basePartnership, children: ['child1', 'mc1'] }];

    const result = removeOrphanedMiscarriages(people, partnerships);

    expect(result.people.map((p) => p.id)).toEqual(['child1']);
    expect(result.partnerships[0].children).toEqual(['child1']);
  });

  it('keeps miscarriages that belong to an existing partnership', () => {
    const people: Person[] = [
      {
        id: 'mc1',
        name: 'Miscarriage',
        x: 10,
        y: 10,
        partnerships: [],
        lifeStatus: 'miscarriage',
        parentPartnership: 'p1',
      },
    ];
    const partnerships = [{ ...basePartnership, children: ['mc1'] }];

    const result = removeOrphanedMiscarriages(people, partnerships);

    expect(result.people).toHaveLength(1);
    expect(result.people[0].id).toBe('mc1');
    expect(result.partnerships[0].children).toEqual(['mc1']);
  });
});
