/**
 * Deletes ask first, and edits apply the prediction rules
 * (REVIEW-gap-areas-2026-09-30 F-3, F-13, F-17).
 */
import { renderHook, act } from '@testing-library/react';
import { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { usePredictionHandlers } from './usePredictionHandlers';
import type { PredictionSet } from '../types';

const initialSets = (): PredictionSet[] => [
  {
    id: 's1',
    name: 'Client A',
    createdDate: '',
    predictions: [
      {
        id: 'p1',
        title: 'Calmer',
        status: 'active',
        createdDate: '',
        notes: '',
        conditions: [
          { id: 'c1', type: 'sir', personId: 'a', linkedSIRCategory: 'Cat', linkedEventId: 'ev-a', description: '', evidence: [] },
        ],
        outcomes: [],
      },
    ],
  },
];

const setup = (confirmFn: (message: string) => boolean) =>
  renderHook(() => {
    const [predictionSets, setPredictionSets] = useState<PredictionSet[]>(initialSets);
    return usePredictionHandlers({ predictionSets, setPredictionSets, confirmFn });
  });

describe('usePredictionHandlers', () => {
  it('deleting a set asks first; cancelling keeps it (regression F-3: deleted on one click)', () => {
    const confirmFn = vi.fn(() => false);
    const { result } = setup(confirmFn);
    let deleted = true;
    act(() => {
      deleted = result.current.deleteSet('s1');
    });
    expect(confirmFn).toHaveBeenCalledWith(expect.stringContaining('"Client A"'));
    expect(deleted).toBe(false);
    expect(result.current.predictionSets).toHaveLength(1);
  });

  it('deleting a set after confirming removes it', () => {
    const { result } = setup(() => true);
    act(() => {
      result.current.deleteSet('s1');
    });
    expect(result.current.predictionSets).toEqual([]);
  });

  it('deleting a prediction asks first; cancelling keeps it (regression F-3)', () => {
    const confirmFn = vi.fn(() => false);
    const { result } = setup(confirmFn);
    act(() => {
      result.current.deletePrediction('s1', 'p1');
    });
    expect(confirmFn).toHaveBeenCalledWith(expect.stringContaining('"Calmer"'));
    expect(result.current.predictionSets[0].predictions).toHaveLength(1);
  });

  it('a blank rename keeps the name (regression F-17)', () => {
    const { result } = setup(() => true);
    act(() => {
      result.current.renameSet('s1', '   ');
    });
    expect(result.current.predictionSets[0].name).toBe('Client A');
  });

  it('switching a condition to another person drops the stale link (regression F-13)', () => {
    const { result } = setup(() => true);
    act(() => {
      result.current.updateCondition('s1', 'p1', 'c1', { personId: 'b' });
    });
    const condition = result.current.predictionSets[0].predictions[0].conditions[0];
    expect(condition.personId).toBe('b');
    expect(condition.linkedEventId).toBeUndefined();
  });

  it('evidence is stored exactly as given (no date filled in)', () => {
    const { result } = setup(() => true);
    act(() => {
      result.current.addEvidence('s1', 'p1', 'condition', 'c1', { date: '', type: 'observation', direction: 'neutral', notes: 'n' });
    });
    const [evidence] = result.current.predictionSets[0].predictions[0].conditions[0].evidence;
    expect(evidence).toMatchObject({ date: '', direction: 'neutral', notes: 'n' });
  });
});
