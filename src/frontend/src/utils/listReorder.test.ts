import { describe, it, expect } from 'vitest';
import { moveItemUp, moveItemDown, reorderItem } from './listReorder';

describe('moveItemUp', () => {
  it('swaps index N with index N-1', () => {
    expect(moveItemUp(['a', 'b', 'c'], 1)).toEqual(['b', 'a', 'c']);
    expect(moveItemUp(['a', 'b', 'c'], 2)).toEqual(['a', 'c', 'b']);
  });

  it('returns same array reference when index is 0 (no-op)', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItemUp(items, 0)).toBe(items);
  });

  it('returns same array when index is out of range', () => {
    const items = ['a', 'b'];
    expect(moveItemUp(items, 5)).toBe(items);
    expect(moveItemUp(items, -1)).toBe(items);
  });

  it('does not mutate the input array', () => {
    const items = ['a', 'b', 'c'];
    moveItemUp(items, 1);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('moveItemDown', () => {
  it('swaps index N with index N+1', () => {
    expect(moveItemDown(['a', 'b', 'c'], 0)).toEqual(['b', 'a', 'c']);
    expect(moveItemDown(['a', 'b', 'c'], 1)).toEqual(['a', 'c', 'b']);
  });

  it('returns same array when index is the last (no-op)', () => {
    const items = ['a', 'b', 'c'];
    expect(moveItemDown(items, 2)).toBe(items);
  });

  it('returns same array when index is out of range', () => {
    const items = ['a', 'b'];
    expect(moveItemDown(items, 5)).toBe(items);
    expect(moveItemDown(items, -1)).toBe(items);
  });
});

describe('reorderItem', () => {
  it('moves an item from one index to another', () => {
    expect(reorderItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(reorderItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('returns same array when from === to', () => {
    const items = ['a', 'b', 'c'];
    expect(reorderItem(items, 1, 1)).toBe(items);
  });

  it('returns same array for out-of-range indices', () => {
    const items = ['a', 'b'];
    expect(reorderItem(items, 5, 0)).toBe(items);
    expect(reorderItem(items, 0, 5)).toBe(items);
    expect(reorderItem(items, -1, 0)).toBe(items);
  });

  it('handles object items by reference', () => {
    const a = { id: 1 };
    const b = { id: 2 };
    const c = { id: 3 };
    expect(reorderItem([a, b, c], 0, 2)).toEqual([b, c, a]);
  });
});
