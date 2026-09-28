import { describe, it, expect } from 'vitest';
import type { Partnership, Person } from '../types';
import { alignMultipleBirthAnchors } from './multipleBirthAnchors';

const parents = (): Person[] => [
  { id: 'pa', name: 'Pa', x: 100, y: 0, partnerships: ['fam'] },
  { id: 'ma', name: 'Ma', x: 300, y: 0, partnerships: ['fam'] },
];
const fam: Partnership = {
  id: 'fam',
  partner1_id: 'pa',
  partner2_id: 'ma',
  horizontalConnectorY: 60,
  relationshipType: 'married',
  relationshipStatus: 'married',
  children: ['t1', 't2', 'solo'],
};
const kid = (id: string, x: number, extra: Partial<Person> = {}): Person => ({
  id,
  name: id,
  x,
  y: 200,
  partnerships: [],
  parentPartnership: 'fam',
  ...extra,
});

describe('alignMultipleBirthAnchors', () => {
  it('gives twins one shared anchor at their mean x', () => {
    const people = [...parents(), kid('t1', 180, { multipleBirthGroupId: 'g' }), kid('t2', 220, { multipleBirthGroupId: 'g' })];
    const result = alignMultipleBirthAnchors(people, [fam]);
    expect(result.find((p) => p.id === 't1')?.connectionAnchorX).toBe(200);
    expect(result.find((p) => p.id === 't2')?.connectionAnchorX).toBe(200);
  });

  it('clamps the shared anchor between the parents', () => {
    const people = [...parents(), kid('t1', 380, { multipleBirthGroupId: 'g' }), kid('t2', 420, { multipleBirthGroupId: 'g' })];
    const result = alignMultipleBirthAnchors(people, [fam]);
    expect(result.find((p) => p.id === 't1')?.connectionAnchorX).toBe(300);
  });

  it('removes a stale anchor from a single child and from a person with no parents', () => {
    const people = [
      ...parents(),
      kid('solo', 150, { connectionAnchorX: 999 }),
      { id: 'orphan', name: 'orphan', x: 0, y: 0, partnerships: [], connectionAnchorX: 5 },
    ];
    const result = alignMultipleBirthAnchors(people, [fam]);
    expect(result.find((p) => p.id === 'solo')?.connectionAnchorX).toBeUndefined();
    expect(result.find((p) => p.id === 'orphan')?.connectionAnchorX).toBeUndefined();
  });

  it('returns the same array when nothing changes, and does not modify its input', () => {
    const people = [...parents(), kid('solo', 150)];
    const snapshot = structuredClone(people);
    expect(alignMultipleBirthAnchors(people, [fam])).toBe(people);
    const twins = [...parents(), kid('t1', 180, { multipleBirthGroupId: 'g' }), kid('t2', 220, { multipleBirthGroupId: 'g' })];
    const twinsSnapshot = structuredClone(twins);
    alignMultipleBirthAnchors(twins, [fam]);
    expect(twins).toEqual(twinsSnapshot);
    expect(people).toEqual(snapshot);
  });
});
