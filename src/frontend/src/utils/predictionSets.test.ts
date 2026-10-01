import { describe, it, expect } from 'vitest';
import {
  conditionDescriptionPlaceholder,
  normalizePredictionSets,
  predictionDeleteMessage,
  predictionSetDeleteMessage,
  renamedSetName,
  withConditionUpdate,
} from './predictionSets';
import type { PredictionCondition, PredictionSet } from '../types';

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

describe('normalizePredictionSets — partial conditions, outcomes and evidence (F-15)', () => {
  it('evidence with no type or direction renders instead of crashing; null entries are dropped', () => {
    const [set] = normalizePredictionSets([
      { id: 's', name: 'S', predictions: [{ id: 'p', conditions: [{ id: 'c', evidence: [{ notes: 'n' }, null] }] }] },
    ]);
    const evidence = set.predictions[0].conditions[0].evidence;
    expect(evidence).toHaveLength(1);
    expect(evidence[0]).toMatchObject({ type: 'observation', direction: 'neutral', notes: 'n', date: '' });
    expect(typeof evidence[0].id).toBe('string');
  });

  it('conditions and outcomes without ids get distinct ids, so one edit cannot change both', () => {
    const [set] = normalizePredictionSets([
      { id: 's', name: 'S', predictions: [{ id: 'p', conditions: [{ description: 'a' }, { description: 'b' }], outcomes: [{}, {}] }] },
    ]);
    const [c1, c2] = set.predictions[0].conditions;
    expect(c1.id).toBeTruthy();
    expect(c1.id).not.toBe(c2.id);
    expect(c1.type).toBe('custom');
    const [o1, o2] = set.predictions[0].outcomes;
    expect(o1.id).not.toBe(o2.id);
    expect(o1.description).toBe('');
  });

  it('a condition with no description gets an empty one (controlled input)', () => {
    const [set] = normalizePredictionSets([{ id: 's', name: 'S', predictions: [{ id: 'p', conditions: [{ id: 'c' }] }] }]);
    expect(set.predictions[0].conditions[0].description).toBe('');
  });
});

describe('prediction rules', () => {
  const set: PredictionSet = {
    id: 's',
    name: 'Client A',
    createdDate: '',
    predictions: [
      {
        id: 'p',
        title: 'Calmer',
        status: 'active',
        createdDate: '',
        notes: '',
        conditions: [{ id: 'c', type: 'custom', description: '', evidence: [{ id: 'e', date: '', type: 'observation', direction: 'supports', notes: '' }] }],
        outcomes: [],
      },
    ],
  };

  it('delete messages name the item and what goes with it (F-3)', () => {
    expect(predictionSetDeleteMessage(set)).toBe(
      'Delete the prediction set "Client A"? This removes 1 prediction and 1 evidence entry. It cannot be undone.'
    );
    expect(predictionDeleteMessage(set.predictions[0])).toBe(
      'Delete the prediction "Calmer" with 1 condition and 0 outcomes? It cannot be undone.'
    );
  });

  it('a blank rename keeps the old name; a real one is trimmed (F-17)', () => {
    expect(renamedSetName('Client A', '   ')).toBe('Client A');
    expect(renamedSetName('Client A', '  Client B ')).toBe('Client B');
  });

  const linked: PredictionCondition = {
    id: 'c',
    type: 'sir',
    personId: 'p1',
    description: 'mine',
    linkedSIRCategory: 'Resource to Other',
    linkedEventId: 'ev-of-p1',
    evidence: [],
  };

  it('changing the person drops the link to the old person\'s entry (F-13)', () => {
    const next = withConditionUpdate(linked, { personId: 'p2' });
    expect(next.linkedEventId).toBeUndefined();
    expect(next.linkedSIRCategory).toBe('Resource to Other');
    expect(next.description).toBe('mine');
  });

  it('changing the type drops every link (F-13)', () => {
    const next = withConditionUpdate({ ...linked, linkedPaperoKey: 'k' }, { type: 'papero' });
    expect(next).toMatchObject({ linkedEventId: undefined, linkedSIRCategory: undefined, linkedPaperoKey: undefined });
  });

  it('an edit that sets the link itself, or touches nothing linked, keeps it', () => {
    expect(withConditionUpdate(linked, { description: 'new' }).linkedEventId).toBe('ev-of-p1');
    expect(withConditionUpdate(linked, { personId: 'p1' }).linkedEventId).toBe('ev-of-p1');
    expect(withConditionUpdate(linked, { linkedEventId: 'other' }).linkedEventId).toBe('other');
  });

  it('the description suggestion is a placeholder built from the topic', () => {
    expect(conditionDescriptionPlaceholder({ ...linked, type: 'papero', linkedPaperoKey: 'resourceful_engagement' })).toBe(
      'e.g. Improve Engagement with Issue'
    );
    expect(conditionDescriptionPlaceholder({ ...linked, type: 'custom' })).toBe('Describe the condition...');
  });
});
