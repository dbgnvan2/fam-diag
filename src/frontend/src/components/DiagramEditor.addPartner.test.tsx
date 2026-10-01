/**
 * Add › Partner on a person creates a partnership with the same status as
 * every other new partnership: "ongoing". It used to set "married", a status
 * the user never chose (review 2026-09-30 DE1-15).
 */
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Konva from 'konva';
import DiagramEditor from './DiagramEditor';
import { STORAGE_KEYS } from '../utils/storage';
import type { Partnership } from '../types';

const rightClickPerson = (personId: string) => {
  const stage = Konva.stages[Konva.stages.length - 1];
  const node = stage.findOne(`#${personId}`);
  expect(node).toBeTruthy();
  act(() => {
    node!.fire('contextmenu', { evt: new MouseEvent('contextmenu', { clientX: 120, clientY: 120, button: 2 }) }, true);
  });
};

describe('DiagramEditor — Add › Partner', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEYS.autoSave, '1');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates an "ongoing" dating partnership, not a married one', async () => {
    vi.useFakeTimers();
    render(<DiagramEditor />);
    rightClickPerson('demo-dad');
    fireEvent.click(screen.getByText('Add'));
    fireEvent.click(screen.getByText('Partner'));
    // Wait past the browser-storage write (and the autosave delay).
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * 60_000);
    });
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEYS.partnerships) ?? '[]') as Partnership[];
    const added = stored.find(
      (p) => (p.partner1_id === 'demo-dad' || p.partner2_id === 'demo-dad') && p.relationshipType === 'dating'
    );
    expect(added).toBeTruthy();
    expect(added!.relationshipStatus).toBe('ongoing');
  });
});
