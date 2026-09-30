import { describe, it, expect } from 'vitest';
import { normalizePredictionSets } from './predictionSets';

describe('normalizePredictionSets', () => {
  it('wraps an old flat list of predictions in one set (regression: only migrated from localStorage)', () => {
    const sets = normalizePredictionSets([{ id: 'p1', title: 'T', conditions: [] }], '2026-09-30');
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ name: 'Migrated Predictions', createdDate: '2026-09-30' });
    expect(sets[0].predictions[0]).toMatchObject({ id: 'p1', outcomes: [], conditions: [] });
  });

  it('fills missing arrays so the panel cannot crash on .length / .map', () => {
    const [set] = normalizePredictionSets([{ id: 's1', name: 'S', predictions: [{ id: 'p', conditions: [{ id: 'c' }] }] }]);
    expect(set.predictions[0].conditions[0].evidence).toEqual([]);
    expect(set.predictions[0].outcomes).toEqual([]);
    expect(normalizePredictionSets([{ id: 's2' }])[0].predictions).toEqual([]);
  });

  it('drops what is not a list of objects', () => {
    expect(normalizePredictionSets('nope')).toEqual([]);
    expect(normalizePredictionSets([null, 3])).toEqual([]);
  });
});
