/**
 * Regression tests: what the editor restores from localStorage on load must
 * be what was stored.
 *
 * - A mount effect applied the DEFAULT indicator definitions over the stored
 *   ones, and sanitising people against them deleted every indicator that
 *   referenced a custom definition. Autosave then persisted the loss.
 * - The people and partnerships initializers ignored a stored empty array,
 *   so an emptied diagram (File > New, or deleting every partnership) came
 *   back as the default family after a reload.
 *
 * Each test lets autosave run, then reads what was written back.
 */
import { render, act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import DiagramEditor from './DiagramEditor';
import { STORAGE_KEYS } from '../utils/storage';
import { DEFAULT_DIAGRAM_STATE } from '../data/defaultDiagramState';
import type { Partnership, Person } from '../types';

const readStored = <T,>(key: keyof typeof STORAGE_KEYS): T =>
  JSON.parse(localStorage.getItem(STORAGE_KEYS[key]) as string) as T;

const mountAndLetAutosaveRun = async () => {
  render(<DiagramEditor />);
  // Past the default autosave delay, in steps so any re-render timers run.
  for (let i = 0; i < 20; i += 1) {
    await act(async () => {
      vi.advanceTimersByTime(10_000);
    });
  }
};

describe('DiagramEditor — state restored on load', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it('keeps custom indicator definitions and the indicators that use them', async () => {
    localStorage.setItem(
      STORAGE_KEYS.userSettings,
      JSON.stringify({
        functionalIndicatorDefinitions: [{ id: 'custom-ind', label: 'Custom Indicator', group: 'emotional' }],
      })
    );
    localStorage.setItem(
      STORAGE_KEYS.people,
      JSON.stringify([
        {
          id: 'p1',
          name: 'P One',
          x: 100,
          y: 100,
          partnerships: [],
          functionalIndicators: [{ definitionId: 'custom-ind', status: 'current', impact: 3 }],
        },
      ])
    );
    localStorage.setItem(STORAGE_KEYS.partnerships, '[]');

    await mountAndLetAutosaveRun();

    const settings = readStored<{ functionalIndicatorDefinitions: Array<{ id: string }> }>('userSettings');
    expect(settings.functionalIndicatorDefinitions.map((d) => d.id)).toEqual(['custom-ind']);
    const people = readStored<Person[]>('people');
    expect(people[0].functionalIndicators?.map((entry) => entry.definitionId)).toEqual(['custom-ind']);
  });

  it('an emptied diagram stays empty (File > New, then reload)', async () => {
    for (const key of ['people', 'partnerships', 'emotionalLines', 'triangles', 'pageNotes'] as const) {
      localStorage.setItem(STORAGE_KEYS[key], '[]');
    }
    await mountAndLetAutosaveRun();
    expect(readStored<Person[]>('people')).toEqual([]);
    expect(readStored<Partnership[]>('partnerships')).toEqual([]);
  });

  it('stored people with no partnerships do not get the default partnerships back', async () => {
    localStorage.setItem(
      STORAGE_KEYS.people,
      JSON.stringify([{ id: 'solo', name: 'Solo Person', x: 100, y: 100, partnerships: [] }])
    );
    localStorage.setItem(STORAGE_KEYS.partnerships, '[]');
    await mountAndLetAutosaveRun();
    expect(readStored<Person[]>('people').map((p) => p.id)).toEqual(['solo']);
    expect(readStored<Partnership[]>('partnerships')).toEqual([]);
  });

  it('with nothing stored, the product default diagram is used', async () => {
    await mountAndLetAutosaveRun();
    // The same people and partnerships as the product default, not merely
    // "some people" (a bound would pass on any non-empty diagram).
    expect(readStored<Person[]>('people').map((p) => p.id).sort()).toEqual(
      DEFAULT_DIAGRAM_STATE.people.map((p) => p.id).sort()
    );
    expect(readStored<Partnership[]>('partnerships').map((p) => p.id).sort()).toEqual(
      DEFAULT_DIAGRAM_STATE.partnerships.map((p) => p.id).sort()
    );
  });
});

describe('DiagramEditor — opening a file is clean', () => {
  beforeEach(() => localStorage.clear());

  it('opening a file without relationship types, with custom ones stored, is not dirty', async () => {
    // replaceDiagramState keeps the current types when the file has none, but
    // recorded the DEFAULT types as the saved baseline, so the diagram showed
    // unsaved changes the moment it was opened.
    localStorage.setItem(
      STORAGE_KEYS.userSettings,
      JSON.stringify({ relationshipTypes: ['custom-type'], relationshipStatuses: ['custom-status'] })
    );
    const { container } = render(<DiagramEditor />);
    const loadInput = container.querySelectorAll<HTMLInputElement>('input[type="file"][accept=".json"]')[0];
    const file = new File(
      [JSON.stringify({ people: [], partnerships: [], emotionalLines: [] })],
      'plain.json',
      { type: 'application/json' }
    );
    await act(async () => {
      fireEvent.change(loadInput, { target: { files: [file] } });
    });
    await waitFor(() => expect(screen.getByText('Save')).toBeInTheDocument());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const bg = (screen.getByText('Save').closest('button') as HTMLButtonElement).style.backgroundColor;
    expect(bg).not.toBe('rgb(198, 40, 40)');
    expect(bg).not.toBe('rgb(255, 82, 82)');
  });
});
